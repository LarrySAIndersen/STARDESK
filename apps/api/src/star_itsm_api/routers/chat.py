import contextlib
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import get_user_by_email
from star_itsm_api.db import get_db
from star_itsm_api.deps import require_db
from star_itsm_api.models.chatbot_message import ChatbotMessage
from star_itsm_api.routers.mcp import (
    create_ticket,
    get_ticket_by_number,
    get_ticket_categories,
    get_user_tickets,
    search_historical_solutions,
    search_knowledge_articles,
    update_ticket_status,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

TICKET_NUMBER_RE = re.compile(r"\b(INC|REQ|PRB|SR)-\d{4}-\d+\b", re.IGNORECASE)
TICKET_REF_RE = re.compile(r"\b(INC|REQ|PRB|SR)-\d{4}-\d+\b", re.IGNORECASE)

SUMMARY_PHRASES = (
    "opsummer",
    "opsummering",
    "resumé",
    "resume",
    "kort fortalt",
    "hvad handler",
    "forklar sagen",
    "fortæl om sagen",
    "denne sag",
)

STATUS_PHRASES = (
    "forklar status",
    "status på denne",
    "status på sagen",
    "hvad er status",
    "sla",
    "prioritet",
    "næste skridt",
    "naeste skridt",
)


class ChatPageContext(BaseModel):
    page_path: str | None = None
    page_label: str | None = None
    ticket_id: str | None = None
    ticket_number: str | None = None
    ticket_title: str | None = None


def build_chat_system_prompt(request: "ChatRequest") -> str:
    base = (
        "Du er STARdesk AI-assistenten (kaldet 'Help-a-bot' for medarbejdere og 'Sag-assistent' for eksterne brugere). "
        f"Den aktuelle bruger, du taler med, hedder: {request.user_name or 'Bruger'}. "
        f"Det er MEGET vigtigt, at du hilser på brugeren ved navn ({request.user_name or 'Bruger'}) og titulerer dem med navn på en personlig og høflig måde under jeres samtale! "
        "Du hjælper brugere med at finde svar på deres IT-spørgsmål, tjekke status på deres sager, og vælge de rigtige kategorier. "
        "For medarbejdere kan du også slå sager op via sagsnummer, opdatere status (fx luk eller løs en sag) og tilføje interne noter — bekræft altid før du ændrer noget. "
        "Korte kommandoer virker direkte uden lange sætninger: bare sagsnummer (fx INC-2026-00118), 'luk INC-…', 'løs INC-…', 'mine sager', 'opret Titel - Beskrivelse'. "
        "Svar altid venligt, professionelt og på dansk."
    )

    page_context = request.page_context
    if not page_context:
        return base

    context_parts: list[str] = []
    if page_context.page_label:
        context_parts.append(f"Brugeren sidder på siden «{page_context.page_label}».")
    if page_context.ticket_number:
        title_suffix = f" «{page_context.ticket_title}»" if page_context.ticket_title else ""
        context_parts.append(
            "Brugeren kigger på sagen "
            f"**{page_context.ticket_number}**{title_suffix}. "
            "Antag at spørgsmål om «denne sag», «opsummering» og lignende handler om denne sag, "
            "medmindre brugeren angiver et andet sagsnummer."
        )
    if context_parts:
        base += " " + " ".join(context_parts)
    return base


async def try_page_context_command(
    user_msg: str,
    page_context: ChatPageContext | None,
) -> str | None:
    if not page_context or not page_context.ticket_number:
        return None

    lower = user_msg.strip().lower()
    ticket_number = page_context.ticket_number.upper()

    if any(phrase in lower for phrase in SUMMARY_PHRASES):
        detail = await get_ticket_by_number(ticket_number)
        return f"Her er en opsummering af **{ticket_number}**:\n\n{detail}"

    if any(phrase in lower for phrase in STATUS_PHRASES) and not TICKET_NUMBER_RE.search(user_msg):
        return await get_ticket_by_number(ticket_number)

    return None


def _parse_short_create_payload(msg: str) -> tuple[str, str] | None:
    if ":" in msg:
        payload = msg.split(":", 1)[1].strip()
    elif " " in msg:
        payload = msg.split(" ", 1)[1].strip()
    else:
        return None
    if not payload:
        return None
    if " - " in payload:
        title, description = payload.split(" - ", 1)
    elif "-" in payload and not TICKET_NUMBER_RE.search(payload):
        title, description = payload.split("-", 1)
    else:
        title, description = payload, f"Oprettet via Help-a-bot: {payload}"
    title = title.strip()
    description = description.strip()
    if len(title) < 3 or len(description) < 10:
        return None
    return title, description


async def _short_command_close(msg: str, lower: str, ticket_number: str, email: str) -> str | None:
    for prefix in ("luk sag ", "luk ", "close "):
        if not lower.startswith(prefix):
            continue
        remainder = msg[len(prefix):].strip()
        note = remainder[len(ticket_number):].strip() if remainder.upper().startswith(ticket_number) else remainder
        note = note.lstrip("-:").strip() or None
        return await update_ticket_status(
            ticket_number=ticket_number,
            status="closed",
            actor_email=email,
            note=note,
        )
    return None


async def _short_command_resolve(lower: str, ticket_number: str, email: str) -> str | None:
    for prefix in ("løs ", "los ", "resolve "):
        if lower.startswith(prefix):
            return await update_ticket_status(
                ticket_number=ticket_number,
                status="resolved",
                actor_email=email,
                note=None,
            )
    return None


async def _short_command_ticket_number(
    msg: str, lower: str, ticket_number: str, email: str,
) -> str | None:
    closed = await _short_command_close(msg, lower, ticket_number, email)
    if closed:
        return closed
    resolved = await _short_command_resolve(lower, ticket_number, email)
    if resolved:
        return resolved
    if len(msg.split()) <= 2 or any(k in lower for k in ("find", "sag", "vis", "status", "sla")):
        return await get_ticket_by_number(ticket_number)
    return None


async def try_short_command(
    user_msg: str,
    user_email: str | None,
    _user_name: str | None,
) -> str | None:
    """Handle ultra-short Danish commands without calling the LLM."""
    msg = user_msg.strip()
    if not msg:
        return None

    lower = msg.lower()
    email = user_email or "sf01@example.dk"
    ticket_match = TICKET_NUMBER_RE.search(msg)
    ticket_number = ticket_match.group(0).upper() if ticket_match else None

    if ticket_number:
        ticket_result = await _short_command_ticket_number(msg, lower, ticket_number, email)
        if ticket_result:
            return ticket_result

    if lower in {"mine sager", "sager", "mine", "status"} or lower.startswith("mine sager"):
        tickets_res = await get_user_tickets(email)
        return f"Her er dine seneste sager:\n\n{tickets_res}"

    if lower.startswith("opret") or lower.startswith("ny sag"):
        parsed = _parse_short_create_payload(msg)
        if parsed:
            title, description = parsed
            return await create_ticket(user_email=email, title=title, description=description)

    return None


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant" or "system"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_email: str | None = None
    user_name: str | None = None
    model_override: str | None = None
    custom_router_url: str | None = None
    custom_router_key: str | None = None
    custom_router_model: str | None = None
    custom_router_header_type: str | None = "Bearer"
    session_id: str | None = None
    openai_key: str | None = None
    anthropic_key: str | None = None
    google_key: str | None = None
    page_context: ChatPageContext | None = None


class ChatResponse(BaseModel):
    response: str


# Define the tools schema in Gemini's format
GEMINI_TOOLS = [
    {
        "functionDeclarations": [
            {
                "name": "search_knowledge_articles",
                "description": "Søg efter offentliggjorte eksterne vidensartikler i STARdesk. Hjælper med at løse problemer eller guide oprettelse af sager.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "query": {
                            "type": "STRING",
                            "description": "Søgetekst (fx 'mitid', 'vpn', 'adgangskode').",
                        }
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "search_historical_solutions",
                "description": "Søg efter anonymiserede historiske løsninger på tværs af tidligere afsluttede supportsager. Hjælper med at finde ud af, hvordan andre har fået løst lignende problemer ud fra anonyme resuméer.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "query": {
                            "type": "STRING",
                            "description": "Søgetekst (fx 'mitid', 'vpn', 'adgangskode').",
                        }
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "get_ticket_categories",
                "description": "Hent listen over aktive sagskategorier og underkategorier i STARdesk. Bruges til at guide brugeren til at vælge den rigtige kategori ved oprettelse af en sag.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "get_user_tickets",
                "description": "Hent de seneste supportsager for en specifik bruger baseret på deres e-mailadresse. Bruges til at tjekke status eller give opdateringer.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "user_email": {
                            "type": "STRING",
                            "description": "Brugerens e-mailadresse (fx 'jan.hansen@star.dk').",
                        }
                    },
                    "required": ["user_email"],
                },
            },
            {
                "name": "create_ticket",
                "description": "Opret en ny supportsag (ticket) i STARdesk på vegne af en bruger, når de beder om det. Spørg først efter titel og detaljeret beskrivelse, og bekræft før oprettelse.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "user_email": {
                            "type": "STRING",
                            "description": "Brugerens e-mailadresse (fx 'sf01@example.dk').",
                        },
                        "title": {
                            "type": "STRING",
                            "description": "Sagens kortfattede titel (fx 'MitID virker ikke'). Mindst 3 tegn.",
                        },
                        "description": {
                            "type": "STRING",
                            "description": "Detaljeret beskrivelse af problemet. Mindst 10 tegn.",
                        },
                        "category_id": {
                            "type": "STRING",
                            "description": "Valgfrit UUID på sagens kategori.",
                        },
                        "subcategory_id": {
                            "type": "STRING",
                            "description": "Valgfrit UUID på sagens underkategori.",
                        },
                        "priority": {
                            "type": "STRING",
                            "description": "Sagens prioritet ('critical', 'high', 'medium', 'low'). Standard er 'medium'.",
                        },
                        "ticket_type": {
                            "type": "STRING",
                            "description": "Sags-type ('incident', 'service_request', 'problem'). Standard er 'incident'.",
                        }
                    },
                    "required": ["user_email", "title", "description"],
                },
            },
            {
                "name": "get_ticket_by_number",
                "description": "Hent detaljer om en specifik supportsag via sagsnummer. Bruges af medarbejdere til at slå en sag op.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "ticket_number": {
                            "type": "STRING",
                            "description": "Sagsnummeret (fx 'INC-2026-00118').",
                        }
                    },
                    "required": ["ticket_number"],
                },
            },
            {
                "name": "update_ticket_status",
                "description": "Opdater status på en supportsag (fx luk, løs eller sæt i gang). Kun for medarbejdere — bekræft altid med brugeren før opdatering.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "ticket_number": {
                            "type": "STRING",
                            "description": "Sagsnummeret (fx 'INC-2026-00118').",
                        },
                        "status": {
                            "type": "STRING",
                            "description": "Ny status: 'new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed', 'cancelled'.",
                        },
                        "actor_email": {
                            "type": "STRING",
                            "description": "Medarbejderens e-mailadresse der udfører handlingen.",
                        },
                        "note": {
                            "type": "STRING",
                            "description": "Valgfri intern kommentar (fx lukningsnote).",
                        },
                    },
                    "required": ["ticket_number", "status", "actor_email"],
                },
            },
        ]
    }
]


async def execute_tool(name: str, args: dict[str, Any]) -> str:
    """Execute the local python function matching the Gemini function call."""
    try:
        if name == "search_knowledge_articles":
            query = args.get("query", "")
            return await search_knowledge_articles(query)
        if name == "search_historical_solutions":
            query = args.get("query", "")
            return await search_historical_solutions(query)
        if name == "get_ticket_categories":
            return await get_ticket_categories()
        if name == "get_user_tickets":
            email = args.get("user_email", "")
            return await get_user_tickets(email)
        if name == "create_ticket":
            user_email = args.get("user_email", "")
            title = args.get("title", "")
            description = args.get("description", "")
            category_id = args.get("category_id")
            subcategory_id = args.get("subcategory_id")
            priority = args.get("priority", "medium")
            ticket_type = args.get("ticket_type", "incident")
            return await create_ticket(
                user_email=user_email,
                title=title,
                description=description,
                category_id=category_id,
                subcategory_id=subcategory_id,
                priority=priority,
                ticket_type=ticket_type,
            )
        if name == "get_ticket_by_number":
            ticket_number = args.get("ticket_number", "")
            return await get_ticket_by_number(ticket_number)
        if name == "update_ticket_status":
            ticket_number = args.get("ticket_number", "")
            status = args.get("status", "")
            actor_email = args.get("actor_email", "")
            note = args.get("note")
            return await update_ticket_status(
                ticket_number=ticket_number,
                status=status,
                actor_email=actor_email,
                note=note,
            )
        return f"Fejl: Værktøjet '{name}' findes ikke."
    except Exception as e:
        logger.exception(f"Error executing tool {name}")
        return f"Fejl under kørsel af værktøj: {str(e)}"


async def get_smart_mock_response(request: ChatRequest) -> str:
    """Generate a highly helpful mock response based on actual database contents."""
    user_email = request.user_email or "sf01@example.dk"
    user_name = request.user_name or "Bruger"

    # Extract last user message
    user_msg = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_msg = msg.content
            break

    if not user_msg:
        return (
            f"Hej {user_name}! Jeg er din STARdesk-assistent (Help-a-bot).\n\n"
            "Jeg kører i lokal simulations-tilstand. Hvordan kan jeg hjælpe dig i dag?"
        )

    user_msg_lower = user_msg.lower()

    short = await try_short_command(user_msg, user_email, user_name)
    if short:
        prefix = f"Hej {user_name}! **[Mock-assistent]**\n\n" if not short.startswith("Hej") else ""
        return f"{prefix}{short}" if prefix else short

    # 1. Check for explicit request to create a ticket in mock mode
    create_keywords = ["opret sag", "opret billet", "lav en sag", "opret incident"]
    if any(k in user_msg_lower for k in create_keywords):
        if ":" in user_msg:
            try:
                parts = user_msg.split(":", 1)[1].split("-", 1)
                title = parts[0].strip()
                desc = parts[1].strip() if len(parts) > 1 else "Oprettet via STARdesk-assistenten."
                if len(title) >= 3 and len(desc) >= 10:
                    res = await create_ticket(
                        user_email=user_email,
                        title=title,
                        description=desc,
                    )
                    return f"**[Mock-assistent]** {res}"
            except Exception:
                pass
        return (
            f"Hej {user_name}! **[Mock-assistent]** Jeg kan hjælpe dig med at oprette en sag direkte fra chatten!\n\n"
            f"Siden der ikke er nogen aktiv `GOOGLE_KEY` i miljøet, kører jeg i en **smart simulations-tilstand**. Du kan oprette en sag ved at skrive i følgende format:\n"
            f"`opret sag: [Titel] - [Beskrivelse]`\n\n"
            f"F.eks.: `opret sag: Problemer med printeren - Jeg kan ikke printe mine dokumenter, den melder fejl 404.`"
        )

    # 1b. Check for ticket/status/sager queries
    ticket_keywords = ["sag", "sager", "status", "billet", "ticket", "mine", "mine sager"]
    if any(k in user_msg_lower for k in ticket_keywords):
        tickets_res = await get_user_tickets(user_email)
        return (
            f"Hej {user_name}! **[Mock-assistent]** Her er status på dine seneste sager i systemet (for e-mail: `{user_email}`):\n\n"
            f"{tickets_res}\n\n"
            "Hvis du har brug for at oprette en ny sag, kan du gøre det via 'Opret ny sag'-knappen."
        )

    # 2. Check for categories queries
    cat_keywords = ["kategori", "kategorier", "hvilken kategori", "oprette sag", "opret"]
    if any(k in user_msg_lower for k in cat_keywords):
        cats_res = await get_ticket_categories()
        return (
            f"Hej {user_name}! **[Mock-assistent]** Når du opretter en sag, er det vigtigt at vælge den rigtige kategori. Her er de tilgængelige kategorier og underkategorier:\n\n"
            f"{cats_res}\n\n"
            "Du kan vælge den kategori, der passer bedst til din situation, når du opretter sagen."
        )

    # 3. Clean message and search knowledge articles
    clean_msg = "".join(c if c.isalnum() or c.isspace() else " " for c in user_msg_lower)
    # Stop words to filter out
    stop_words = {
        "jeg", "har", "med", "det", "den", "der", "her", "mig", "kan", "ikke", "en", "et", "til",
        "af", "at", "og", "om", "for", "på", "som", "de", "vi", "du", "hjælp", "hjælpe", "mig",
        "emd", "ost", "hej", "goddag", "davs"
    }
    words = [w for w in clean_msg.split() if len(w) >= 3 and w not in stop_words]

    # Try searching for each word
    found_articles = []
    found_solutions = []
    for word in words[:3]:  # limit to top 3 words to avoid too many DB queries
        articles_res = await search_knowledge_articles(word)
        if "Ingen vidensartikler fundet" not in articles_res and "Database er ikke konfigureret" not in articles_res:
            found_articles.append(articles_res)

        solutions_res = await search_historical_solutions(word)
        if "Ingen historiske løsninger fundet" not in solutions_res and "Database er ikke konfigureret" not in solutions_res:
            found_solutions.append(solutions_res)

    if found_articles or found_solutions:
        response_parts = [f"Hej {user_name}! **[Mock-assistent]** Jeg har søgt i vores lokale vidensbase og historiske sager:"]
        if found_articles:
            response_parts.append("### 📚 Relevante Vidensartikler:\n" + "\n\n---\n\n".join(found_articles))
        if found_solutions:
            response_parts.append("### 💡 Tidligere Løsninger fra andre sager:\n" + "\n\n---\n\n".join(found_solutions))
        response_parts.append("Hvis dette ikke løser dit problem, kan du beskrive det nærmere eller oprette en sag.")
        return "\n\n".join(response_parts)

    # 4. Default fallback response if no match
    return (
        f"Hej {user_name}! Jeg er din STARdesk-assistent (Help-a-bot).\n\n"
        f"Da der ikke er konfigureret en aktiv `GOOGLE_KEY` i miljøet, kører jeg i en **smart simulations-tilstand** ved hjælp af direkte database-opslag.\n\n"
        f"Jeg forstod ikke helt din besked: *\"{user_msg}\"*\n\n"
        f"Prøv at spørge mig om:\n"
        f"- **Find sag**: Skriv bare sagsnummeret, fx `INC-2026-00118`\n"
        f"- **Luk sag**: `luk INC-2026-00118` eller med note: `luk INC-2026-00118 printer virker`\n"
        f"- **Opret sag**: `opret Printer fejl - Kan ikke printe`\n"
        f"- **Dine sager**: Skriv `mine sager`\n"
        f"- **Vidensartikler**: Skriv fx `vpn`, `mitid`, `adgangskode`."
    )


async def log_chatbot_message(
    db: AsyncSession | None,
    session_str: str | None,
    user_email: str | None,
    sender: str,
    sender_name: str,
    body: str,
    category: str | None = None,
    ticket_ref: str | None = None,
):
    if db is None:
        return
    try:
        user_id = None
        if user_email:
            user = await get_user_by_email(db, user_email)
            if user:
                user_id = user.id
        
        session_id = None
        if session_str:
            with contextlib.suppress(ValueError):
                session_id = uuid.UUID(session_str)
        if not session_id:
            session_id = uuid.uuid4()

        msg = ChatbotMessage(
            session_id=session_id,
            user_id=user_id,
            sender=sender,
            sender_name=sender_name,
            body=body,
            category=category,
            ticket_ref=ticket_ref,
            is_bookmarked=False,
            created_at=datetime.utcnow()
        )
        db.add(msg)
        await db.commit()
    except Exception as e:
        logger.error(f"Error logging chatbot message: {str(e)}")


@router.post("", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, db: AsyncSession | None = Depends(get_db)):
    # Extract last user message for logging
    last_user_msg = None
    for msg in reversed(request.messages):
        if msg.role == "user":
            last_user_msg = msg.content
            break

    # Helper to return response AND log it in the database
    async def make_response(final_response: str) -> ChatResponse:
        if last_user_msg:
            await log_chatbot_message(
                db=db,
                session_str=request.session_id,
                user_email=request.user_email,
                sender="user",
                sender_name=request.user_name or "Bruger",
                body=last_user_msg,
            )
        # Determine category based on content keywords
        category = "Generelt"
        body_lower = final_response.lower()
        if "vpn" in body_lower or (last_user_msg and "vpn" in last_user_msg.lower()):
            category = "VPN"
        elif "mitid" in body_lower or (last_user_msg and "mitid" in last_user_msg.lower()):
            category = "MitID"
        elif "sla" in body_lower or (last_user_msg and "sla" in last_user_msg.lower()):
            category = "SLA"
        elif "adgangskode" in body_lower or "password" in body_lower or (last_user_msg and ("adgangskode" in last_user_msg.lower() or "password" in last_user_msg.lower())):
            category = "Adgangskode"

        # Look for ticket ref like INC-2026-00118
        ticket_match = TICKET_REF_RE.search(final_response)
        ticket_ref = ticket_match.group(0).upper() if ticket_match else None
        if not ticket_ref and last_user_msg:
            user_ticket_match = TICKET_REF_RE.search(last_user_msg)
            ticket_ref = user_ticket_match.group(0).upper() if user_ticket_match else None

        await log_chatbot_message(
            db=db,
            session_str=request.session_id,
            user_email=request.user_email,
            sender="bot",
            sender_name="Help-a-bot" if "staff" in (request.user_email or "") else "Sag-assistent",
            body=final_response,
            category=category,
            ticket_ref=ticket_ref
        )
        return ChatResponse(response=final_response)

    if last_user_msg:
        short_response = await try_short_command(
            last_user_msg,
            request.user_email,
            request.user_name,
        )
        if short_response:
            return await make_response(short_response)

        context_response = await try_page_context_command(
            last_user_msg,
            request.page_context,
        )
        if context_response:
            return await make_response(context_response)

    # 1. Check if we should call a custom router (OpenRouter, Azure AI Foundry, standard custom)
    if request.model_override == "custom-router" or (request.custom_router_url and request.model_override in ["custom-router", "openrouter", "azure"]):
        url_str = request.custom_router_url
        if not url_str:
            url = "https://openrouter.ai/api/v1/chat/completions"
        else:
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(url_str)
            if parsed.scheme not in ["http", "https"] or not parsed.netloc:
                raise HTTPException(status_code=400, detail="Ugyldig router-URL")
            
            path = parsed.path
            if not path.endswith("/chat/completions") and "api-key" not in url_str.lower() and "azure" not in url_str.lower():
                path = path.rstrip("/") + "/chat/completions"
                
            # Reconstruct the URL safely using standard components
            # NOSONAR pythonsecurity:S5144 — custom router URL is fully validated and parsed.
            url = urlunparse((
                parsed.scheme,
                parsed.netloc,
                path,
                parsed.params,
                parsed.query,
                parsed.fragment
            ))

        # Format messages for OpenAI format
        system_text = build_chat_system_prompt(request)
        
        openai_messages = [{"role": "system", "content": system_text}]
        for msg in request.messages:
            role_map = {"user": "user", "assistant": "assistant", "system": "system", "model": "assistant"}
            openai_messages.append({"role": role_map.get(msg.role, "user"), "content": msg.content})

        headers = {}
        key = request.custom_router_key
        if key:
            if request.custom_router_header_type == "api-key" or "api-key" in url.lower() or "azure" in url.lower():
                headers["api-key"] = key
            else:
                headers["Authorization"] = f"Bearer {key}"

        model_name = request.custom_router_model or "meta-llama/llama-3-70b-instruct"
        payload = {
            "model": model_name,
            "messages": openai_messages,
            "temperature": 0.3
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                res_data = response.json()
                choices = res_data.get("choices", [])
                if choices:
                    text = choices[0].get("message", {}).get("content", "")
                    return await make_response(text)
                return await make_response("Undskyld, jeg modtog ikke et gyldigt svar fra den tilpassede sprogmodel.")
            except Exception as e:
                logger.error(f"Error calling custom router API: {str(e)}. Falling back to smart mock response.")
                mock_resp = await get_smart_mock_response(request)
                return await make_response(f"⚠️ **Bemærk**: Kunne ikke forbinde til din tilpassede udbyder ({str(e)}).\n\nJeg har i stedet slået over på lokal simulations-tilstand:\n\n{mock_resp}")

    # 2. Check if we should call OpenAI API (gpt-4o)
    if request.model_override == "gpt-4o":
        openai_key = request.openai_key or os.getenv("OPENAI_API_KEY")
        if not openai_key:
            logger.warning("OPENAI_API_KEY not found in environment or request. Falling back to mock responses.")
            mock_resp = await get_smart_mock_response(request)
            return await make_response(mock_resp)

        system_text = build_chat_system_prompt(request)

        openai_messages = [{"role": "system", "content": system_text}]
        for msg in request.messages:
            role_map = {"user": "user", "assistant": "assistant", "system": "system", "model": "assistant"}
            openai_messages.append({"role": role_map.get(msg.role, "user"), "content": msg.content})

        headers = {
            "Authorization": f"Bearer {openai_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "gpt-4o",
            "messages": openai_messages,
            "temperature": 0.3
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers)
                response.raise_for_status()
                res_data = response.json()
                choices = res_data.get("choices", [])
                if choices:
                    text = choices[0].get("message", {}).get("content", "")
                    return await make_response(text)
                return await make_response("Undskyld, jeg modtog ikke et gyldigt svar fra OpenAI-modellen.")
            except Exception as e:
                logger.error(f"Error calling OpenAI API: {str(e)}. Falling back to smart mock response.")
                mock_resp = await get_smart_mock_response(request)
                return await make_response(f"⚠️ **Bemærk**: Kunne ikke forbinde til OpenAI-tjenesten ({str(e)}).\n\nJeg har i stedet slået over på lokal simulations-tilstand:\n\n{mock_resp}")

    # 3. Check if we should call Anthropic API (claude-3-5-sonnet-20241022)
    if request.model_override == "claude-3-5-sonnet-20241022":
        anthropic_key = request.anthropic_key or os.getenv("ANTHROPIC_API_KEY")
        if not anthropic_key:
            logger.warning("ANTHROPIC_API_KEY not found in environment or request. Falling back to mock responses.")
            mock_resp = await get_smart_mock_response(request)
            return await make_response(mock_resp)

        system_text = build_chat_system_prompt(request)

        anthropic_messages = []
        for msg in request.messages:
            role = "user" if msg.role == "user" else "assistant"
            anthropic_messages.append({"role": role, "content": msg.content})

        headers = {
            "x-api-key": anthropic_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 1024,
            "messages": anthropic_messages,
            "system": system_text,
            "temperature": 0.3
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
                response.raise_for_status()
                res_data = response.json()
                content_parts = res_data.get("content", [])
                if content_parts:
                    text = content_parts[0].get("text", "")
                    return await make_response(text)
                return await make_response("Undskyld, jeg modtog ikke et gyldigt svar fra Anthropic-modellen.")
            except Exception as e:
                logger.error(f"Error calling Anthropic API: {str(e)}. Falling back to smart mock response.")
                mock_resp = await get_smart_mock_response(request)
                return await make_response(f"⚠️ **Bemærk**: Kunne ikke forbinde til Anthropic-tjenesten ({str(e)}).\n\nJeg har i stedet slået over på lokal simulations-tilstand:\n\n{mock_resp}")

    # Retrieve the Google Gemini API key from the environment
    api_key = request.google_key or os.getenv("GOOGLE_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        # Fallback to mock behavior if no API key is set
        logger.warning(
            "GOOGLE_KEY or GEMINI_API_KEY not found in environment. Falling back to mock responses."
        )
        mock_resp = await get_smart_mock_response(request)
        return await make_response(mock_resp)

    # Format the messages history for Gemini API
    # Gemini uses "user" and "model" roles (instead of "assistant")
    contents = []
    for msg in request.messages:
        role = "user" if msg.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.content}]})

    system_instruction = {
        "parts": [
            {
                "text": (
                    build_chat_system_prompt(request)
                    + " Du har adgang til værktøjer til at søge i vidensartikler, hente kategorier og finde sager. "
                    "Brug dem aktivt, når det er relevant! "
                    f"Hvis du leder efter sager for den aktuelle bruger, kan du bruge deres e-mail: {request.user_email or 'ikke angivet'}."
                )
            }
        ]
    }

    # Prepare the payload for Gemini API
    payload = {"contents": contents, "systemInstruction": system_instruction, "tools": GEMINI_TOOLS}

    # Use selected or overridden model
    model = request.model_override or "gemini-1.5-flash"
    # Ensure model matches a safe alphanumeric pattern to prevent SSRF path traversal / manipulation
    import re
    if not re.match(r"^[a-zA-Z0-9.\-_]+$", model):
        raise HTTPException(status_code=400, detail="Ugyldigt modelnavn")
        
    from urllib.parse import quote
    safe_model = quote(model, safe="")
    # NOSONAR pythonsecurity:S2083 — safe_model is strictly alphanumeric and URL-encoded.
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{safe_model}:generateContent?key={api_key}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(url, json=payload)
            # Check for 404 specifically to support seamless fallback from newer to 1.5 stable models
            if response.status_code == 404 and model in ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"]:
                fallback_model = "gemini-1.5-pro" if "pro" in model else "gemini-1.5-flash"
                logger.warning(f"Model {model} returned 404. Retrying with fallback model {fallback_model}...")
                model = fallback_model
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                response = await client.post(url, json=payload)

            response.raise_for_status()
            res_data = response.json()
        except Exception as e:
            logger.error(f"Error calling Gemini API: {str(e)}. Falling back to smart mock response.")
            mock_resp = await get_smart_mock_response(request)
            
            error_msg = str(e)
            if "429" in error_msg:
                user_friendly_error = (
                    "⚠️ **Bemærk**: Sprogmodellen er midlertidigt overbelastet (Googles rate-limit/kvote for denne gratis-nøgle er overskredet).\n\n"
                    "For at undgå afbrydelser har jeg slået over på min **smarte simulations-tilstand** via direkte database-opslag, så jeg stadig kan hjælpe dig:\n\n"
                )
            else:
                user_friendly_error = (
                    f"⚠️ **Bemærk**: Der opstod en midlertidig fejl under kommunikationen med Google Gemini-tjenesten ({error_msg}).\n\n"
                    "Jeg har derfor slået over på min **smarte simulations-tilstand** via direkte database-opslag, så jeg stadig kan hjælpe dig:\n\n"
                )
            
            clean_mock_resp = mock_resp.replace(
                "Da der ikke er konfigureret en aktiv `GOOGLE_KEY` i miljøet, kører jeg",
                "Da Google Gemini-tjenesten er midlertidigt utilgængelig, kører jeg"
            )
            return await make_response(f"{user_friendly_error}{clean_mock_resp}")

        # Check if the model wants to call a function
        try:
            candidates = res_data.get("candidates", [])
            if not candidates:
                return await make_response("Undskyld, jeg modtog ikke et gyldigt svar fra min sprogmodel.")

            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            if not parts:
                return await make_response("Undskyld, jeg modtog et tomt svar.")

            # Look for a functionCall in the parts
            function_call = None
            text_response = ""
            for part in parts:
                if "functionCall" in part:
                    function_call = part["functionCall"]
                    break
                if "text" in part:
                    text_response += part["text"]

            if function_call:
                tool_name = function_call.get("name")
                tool_args = function_call.get("args", {})
                logger.info(f"Gemini requested function call: {tool_name} with args {tool_args}")

                # Execute the local tool
                tool_result = await execute_tool(tool_name, tool_args)

                # Send the tool execution result back to Gemini for the final answer
                # To do this, we append the model's functionCall part and then the tool response part
                contents.append({"role": "model", "parts": [{"functionCall": function_call}]})
                contents.append(
                    {
                        "role": "user",
                        "parts": [
                            {
                                "functionResponse": {
                                    "name": tool_name,
                                    "response": {"output": tool_result},
                                }
                            }
                        ],
                    }
                )

                # Call Gemini again with the tool result included in the history
                second_payload = {
                    "contents": contents,
                    "systemInstruction": system_instruction,
                    "tools": GEMINI_TOOLS,
                }

                second_res = await client.post(url, json=second_payload)
                second_res.raise_for_status()
                second_data = second_res.json()

                second_candidates = second_data.get("candidates", [])
                if second_candidates:
                    second_content = second_candidates[0].get("content", {})
                    second_parts = second_content.get("parts", [])
                    final_text = "".join([p.get("text", "") for p in second_parts if "text" in p])
                    return await make_response(final_text)

            return await make_response(text_response)

        except Exception as e:
            logger.exception("Error parsing Gemini API response")
            raise HTTPException(
                status_code=500, detail=f"Fejl under behandling af svar fra sprogmodel: {str(e)}"
            )


class MessageReadSchema(BaseModel):
    id: str
    session_id: str
    sender: str
    sender_name: str
    body: str
    category: str | None
    ticket_ref: str | None
    is_bookmarked: bool
    created_at: str


@router.get("/messages", response_model=list[MessageReadSchema])
async def get_messages(
    q: str | None = None,
    category: str | None = None,
    only_bookmarked: bool = False,
    user_email: str | None = None,
    db: AsyncSession = Depends(require_db)
):
    user_id = None
    if user_email:
        user = await get_user_by_email(db, user_email)
        if user:
            user_id = user.id

    query = select(ChatbotMessage)
    conditions = []
    
    if user_id:
        conditions.append(ChatbotMessage.user_id == user_id)
    elif user_email:
        # If user is not found, filter by None to return empty
        conditions.append(ChatbotMessage.user_id.is_(None))

    if category and category != "Alle":
        conditions.append(ChatbotMessage.category == category)

    if only_bookmarked:
        conditions.append(ChatbotMessage.is_bookmarked)

    if q:
        q_lower = f"%{q.lower()}%"
        conditions.append(
            or_(
                ChatbotMessage.body.ilike(q_lower),
                ChatbotMessage.sender_name.ilike(q_lower),
                ChatbotMessage.ticket_ref.ilike(q_lower)
            )
        )

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(ChatbotMessage.created_at.desc())
    result = await db.execute(query)
    messages = result.scalars().all()

    return [
        MessageReadSchema(
            id=str(m.id),
            session_id=str(m.session_id),
            sender=m.sender,
            sender_name=m.sender_name,
            body=m.body,
            category=m.category,
            ticket_ref=m.ticket_ref,
            is_bookmarked=m.is_bookmarked,
            created_at=m.created_at.isoformat()
        )
        for m in messages
    ]


@router.post("/messages/{msg_id}/bookmark")
async def toggle_bookmark(
    msg_id: str,
    db: AsyncSession = Depends(require_db)
):
    try:
        msg_uuid = uuid.UUID(msg_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Ugyldigt besked-ID")

    query = select(ChatbotMessage).where(ChatbotMessage.id == msg_uuid)
    result = await db.execute(query)
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Besked ikke fundet")

    msg.is_bookmarked = not msg.is_bookmarked
    await db.commit()
    await db.refresh(msg)
    return {"is_bookmarked": msg.is_bookmarked}


@router.delete("/messages/{msg_id}")
async def delete_message(
    msg_id: str,
    db: AsyncSession = Depends(require_db),
):
    try:
        msg_uuid = uuid.UUID(msg_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Ugyldigt besked-ID")

    query = select(ChatbotMessage).where(ChatbotMessage.id == msg_uuid)
    result = await db.execute(query)
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Besked ikke fundet")

    await db.delete(msg)
    await db.commit()
    return {"success": True}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(require_db)
):
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Ugyldigt session-ID")

    stmt = delete(ChatbotMessage).where(ChatbotMessage.session_id == session_uuid)
    await db.execute(stmt)
    await db.commit()
    return {"success": True}

