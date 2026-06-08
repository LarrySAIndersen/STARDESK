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


async def _tool_search_knowledge(args: dict[str, Any]) -> str:
    return await search_knowledge_articles(args.get("query", ""))


async def _tool_search_solutions(args: dict[str, Any]) -> str:
    return await search_historical_solutions(args.get("query", ""))


async def _tool_create_ticket(args: dict[str, Any]) -> str:
    return await create_ticket(
        user_email=args.get("user_email", ""),
        title=args.get("title", ""),
        description=args.get("description", ""),
        category_id=args.get("category_id"),
        subcategory_id=args.get("subcategory_id"),
        priority=args.get("priority", "medium"),
        ticket_type=args.get("ticket_type", "incident"),
    )


async def _tool_update_status(args: dict[str, Any]) -> str:
    return await update_ticket_status(
        ticket_number=args.get("ticket_number", ""),
        status=args.get("status", ""),
        actor_email=args.get("actor_email", ""),
        note=args.get("note"),
    )


_TOOL_HANDLERS: dict[str, Any] = {
    "search_knowledge_articles": _tool_search_knowledge,
    "search_historical_solutions": _tool_search_solutions,
    "get_ticket_categories": lambda _a: get_ticket_categories(),
    "get_user_tickets": lambda a: get_user_tickets(a.get("user_email", "")),
    "create_ticket": _tool_create_ticket,
    "get_ticket_by_number": lambda a: get_ticket_by_number(a.get("ticket_number", "")),
    "update_ticket_status": _tool_update_status,
}


async def execute_tool(name: str, args: dict[str, Any]) -> str:
    """Execute the local python function matching the Gemini function call."""
    handler = _TOOL_HANDLERS.get(name)
    if handler is None:
        return f"Fejl: Værktøjet '{name}' findes ikke."
    try:
        result = handler(args)
        if hasattr(result, "__await__"):
            return await result
        return result
    except Exception as e:
        logger.exception("Error executing tool %s", name)
        return f"Fejl under kørsel af værktøj: {str(e)}"


_MOCK_STOP_WORDS = {
    "jeg", "har", "med", "det", "den", "der", "her", "mig", "kan", "ikke", "en", "et", "til",
    "af", "at", "og", "om", "for", "på", "som", "de", "vi", "du", "hjælp", "hjælpe", "mig",
    "emd", "ost", "hej", "goddag", "davs",
}


def _extract_last_user_message(messages: list[ChatMessage]) -> str:
    for msg in reversed(messages):
        if msg.role == "user":
            return msg.content
    return ""


def _mock_create_help(user_name: str) -> str:
    return (
        f"Hej {user_name}! **[Mock-assistent]** Jeg kan hjælpe dig med at oprette en sag direkte fra chatten!\n\n"
        "Siden der ikke er nogen aktiv `GOOGLE_KEY` i miljøet, kører jeg i en **smart simulations-tilstand**. Du kan oprette en sag ved at skrive i følgende format:\n"
        "`opret sag: [Titel] - [Beskrivelse]`\n\n"
        "F.eks.: `opret sag: Problemer med printeren - Jeg kan ikke printe mine dokumenter, den melder fejl 404.`"
    )


async def _mock_try_create(user_msg: str, user_email: str, user_name: str) -> str | None:
    if ":" not in user_msg:
        return None
    try:
        parts = user_msg.split(":", 1)[1].split("-", 1)
        title = parts[0].strip()
        desc = parts[1].strip() if len(parts) > 1 else "Oprettet via STARdesk-assistenten."
        if len(title) >= 3 and len(desc) >= 10:
            res = await create_ticket(user_email=user_email, title=title, description=desc)
            return f"**[Mock-assistent]** {res}"
    except Exception:
        return None
    return None


async def _mock_search_knowledge(user_msg_lower: str) -> tuple[list[str], list[str]]:
    clean_msg = "".join(c if c.isalnum() or c.isspace() else " " for c in user_msg_lower)
    words = [w for w in clean_msg.split() if len(w) >= 3 and w not in _MOCK_STOP_WORDS]
    articles: list[str] = []
    solutions: list[str] = []
    for word in words[:3]:
        articles_res = await search_knowledge_articles(word)
        if "Ingen vidensartikler fundet" not in articles_res and "Database er ikke konfigureret" not in articles_res:
            articles.append(articles_res)
        solutions_res = await search_historical_solutions(word)
        if "Ingen historiske løsninger fundet" not in solutions_res and "Database er ikke konfigureret" not in solutions_res:
            solutions.append(solutions_res)
    return articles, solutions


def _mock_fallback(user_name: str, user_msg: str) -> str:
    return (
        f"Hej {user_name}! Jeg er din STARdesk-assistent (Help-a-bot).\n\n"
        "Da der ikke er konfigureret en aktiv `GOOGLE_KEY` i miljøet, kører jeg i en **smart simulations-tilstand** ved hjælp af direkte database-opslag.\n\n"
        f"Jeg forstod ikke helt din besked: *\"{user_msg}\"*\n\n"
        "Prøv at spørge mig om:\n"
        "- **Find sag**: Skriv bare sagsnummeret, fx `INC-2026-00118`\n"
        "- **Luk sag**: `luk INC-2026-00118` eller med note: `luk INC-2026-00118 printer virker`\n"
        "- **Opret sag**: `opret Printer fejl - Kan ikke printe`\n"
        "- **Dine sager**: Skriv `mine sager`\n"
        "- **Vidensartikler**: Skriv fx `vpn`, `mitid`, `adgangskode`."
    )


async def get_smart_mock_response(request: ChatRequest) -> str:
    """Generate a highly helpful mock response based on actual database contents."""
    user_email = request.user_email or "sf01@example.dk"
    user_name = request.user_name or "Bruger"
    user_msg = _extract_last_user_message(request.messages)

    if not user_msg:
        return (
            f"Hej {user_name}! Jeg er din STARdesk-assistent (Help-a-bot).\n\n"
            "Jeg kører i lokal simulations-tilstand. Hvordan kan jeg hjælpe dig i dag?"
        )

    short = await try_short_command(user_msg, user_email, user_name)
    if short:
        prefix = f"Hej {user_name}! **[Mock-assistent]**\n\n" if not short.startswith("Hej") else ""
        return f"{prefix}{short}" if prefix else short

    user_msg_lower = user_msg.lower()
    create_keywords = ["opret sag", "opret billet", "lav en sag", "opret incident"]
    if any(k in user_msg_lower for k in create_keywords):
        created = await _mock_try_create(user_msg, user_email, user_name)
        return created if created else _mock_create_help(user_name)

    ticket_keywords = ["sag", "sager", "status", "billet", "ticket", "mine", "mine sager"]
    if any(k in user_msg_lower for k in ticket_keywords):
        tickets_res = await get_user_tickets(user_email)
        return (
            f"Hej {user_name}! **[Mock-assistent]** Her er status på dine seneste sager i systemet (for e-mail: `{user_email}`):\n\n"
            f"{tickets_res}\n\n"
            "Hvis du har brug for at oprette en ny sag, kan du gøre det via 'Opret ny sag'-knappen."
        )

    cat_keywords = ["kategori", "kategorier", "hvilken kategori", "oprette sag", "opret"]
    if any(k in user_msg_lower for k in cat_keywords):
        cats_res = await get_ticket_categories()
        return (
            f"Hej {user_name}! **[Mock-assistent]** Når du opretter en sag, er det vigtigt at vælge den rigtige kategori. Her er de tilgængelige kategorier og underkategorier:\n\n"
            f"{cats_res}\n\n"
            "Du kan vælge den kategori, der passer bedst til din situation, når du opretter sagen."
        )

    articles, solutions = await _mock_search_knowledge(user_msg_lower)
    if articles or solutions:
        parts = [f"Hej {user_name}! **[Mock-assistent]** Jeg har søgt i vores lokale vidensbase og historiske sager:"]
        if articles:
            parts.append("### 📚 Relevante Vidensartikler:\n" + "\n\n---\n\n".join(articles))
        if solutions:
            parts.append("### 💡 Tidligere Løsninger fra andre sager:\n" + "\n\n---\n\n".join(solutions))
        parts.append("Hvis dette ikke løser dit problem, kan du beskrive det nærmere eller oprette en sag.")
        return "\n\n".join(parts)

    return _mock_fallback(user_name, user_msg)


def _infer_chat_category(final_response: str, last_user_msg: str | None) -> str:
    body_lower = final_response.lower()
    user_lower = last_user_msg.lower() if last_user_msg else ""
    checks = (
        (("vpn",), "VPN"),
        (("mitid",), "MitID"),
        (("sla",), "SLA"),
        (("adgangskode", "password"), "Adgangskode"),
    )
    for keywords, label in checks:
        if any(k in body_lower or k in user_lower for k in keywords):
            return label
    return "Generelt"


def _extract_ticket_ref(final_response: str, last_user_msg: str | None) -> str | None:
    match = TICKET_REF_RE.search(final_response)
    if match:
        return match.group(0).upper()
    if last_user_msg:
        user_match = TICKET_REF_RE.search(last_user_msg)
        if user_match:
            return user_match.group(0).upper()
    return None


async def _build_logged_response(
    request: ChatRequest,
    db: AsyncSession | None,
    last_user_msg: str | None,
    final_response: str,
) -> ChatResponse:
    if last_user_msg:
        await log_chatbot_message(
            db=db,
            session_str=request.session_id,
            user_email=request.user_email,
            sender="user",
            sender_name=request.user_name or "Bruger",
            body=last_user_msg,
        )
    await log_chatbot_message(
        db=db,
        session_str=request.session_id,
        user_email=request.user_email,
        sender="bot",
        sender_name="Help-a-bot" if "staff" in (request.user_email or "") else "Sag-assistent",
        body=final_response,
        category=_infer_chat_category(final_response, last_user_msg),
        ticket_ref=_extract_ticket_ref(final_response, last_user_msg),
    )
    return ChatResponse(response=final_response)


def _openai_messages_for_request(request: ChatRequest) -> list[dict[str, str]]:
    system_text = build_chat_system_prompt(request)
    role_map = {"user": "user", "assistant": "assistant", "system": "system", "model": "assistant"}
    messages = [{"role": "system", "content": system_text}]
    for msg in request.messages:
        messages.append({"role": role_map.get(msg.role, "user"), "content": msg.content})
    return messages


def _resolve_custom_router_url(url_str: str | None) -> str:
    if not url_str:
        return "https://openrouter.ai/api/v1/chat/completions"
    from urllib.parse import urlparse, urlunparse
    parsed = urlparse(url_str)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Ugyldig router-URL")
    path = parsed.path
    if not path.endswith("/chat/completions") and "api-key" not in url_str.lower() and "azure" not in url_str.lower():
        path = path.rstrip("/") + "/chat/completions"
    return urlunparse((parsed.scheme, parsed.netloc, path, parsed.params, parsed.query, parsed.fragment))


def _router_auth_headers(request: ChatRequest, url: str) -> dict[str, str]:
    key = request.custom_router_key
    if not key:
        return {}
    if request.custom_router_header_type == "api-key" or "api-key" in url.lower() or "azure" in url.lower():
        return {"api-key": key}
    return {"Authorization": f"Bearer {key}"}


async def _post_openai_chat(url: str, headers: dict[str, str], messages: list[dict[str, str]], model: str) -> str:
    payload = {"model": model, "messages": messages, "temperature": 0.3}
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        choices = response.json().get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "")
        return ""


async def _post_anthropic_chat(request: ChatRequest, anthropic_key: str) -> str:
    system_text = build_chat_system_prompt(request)
    anthropic_messages = [
        {"role": "user" if msg.role == "user" else "assistant", "content": msg.content}
        for msg in request.messages
    ]
    headers = {
        "x-api-key": anthropic_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 1024,
        "messages": anthropic_messages,
        "system": system_text,
        "temperature": 0.3,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
        response.raise_for_status()
        content_parts = response.json().get("content", [])
        if content_parts:
            return content_parts[0].get("text", "")
        return ""


async def _provider_fallback(request: ChatRequest, provider: str, error: Exception) -> str:
    logger.error("Error calling %s API: %s. Falling back to smart mock response.", provider, error)
    mock_resp = await get_smart_mock_response(request)
    return f"⚠️ **Bemærk**: Kunne ikke forbinde til {provider}-tjenesten ({error}).\n\nJeg har i stedet slået over på lokal simulations-tilstand:\n\n{mock_resp}"


def _gemini_system_instruction(request: ChatRequest) -> dict[str, Any]:
    return {"parts": [{"text": build_chat_system_prompt(request)}]}


def _gemini_contents(request: ChatRequest) -> list[dict[str, Any]]:
    return [
        {"role": "user" if msg.role == "user" else "model", "parts": [{"text": msg.content}]}
        for msg in request.messages
    ]


async def _gemini_followup_with_tool(
    client: httpx.AsyncClient,
    url: str,
    contents: list[dict[str, Any]],
    system_instruction: dict[str, Any],
    function_call: dict[str, Any],
) -> str:
    tool_name = function_call.get("name")
    tool_args = function_call.get("args", {})
    logger.info("Gemini requested function call: %s with args %s", tool_name, tool_args)
    tool_result = await execute_tool(tool_name, tool_args)
    contents.append({"role": "model", "parts": [{"functionCall": function_call}]})
    contents.append({
        "role": "user",
        "parts": [{"functionResponse": {"name": tool_name, "response": {"output": tool_result}}}],
    })
    second_payload = {"contents": contents, "systemInstruction": system_instruction, "tools": GEMINI_TOOLS}
    second_res = await client.post(url, json=second_payload)
    second_res.raise_for_status()
    second_candidates = second_res.json().get("candidates", [])
    if not second_candidates:
        return ""
    second_parts = second_candidates[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in second_parts if "text" in p)


async def _call_gemini_chat(request: ChatRequest) -> str:
    api_key = request.google_key or os.getenv("GOOGLE_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return await get_smart_mock_response(request)

    contents = _gemini_contents(request)
    system_instruction = _gemini_system_instruction(request)
    payload = {"contents": contents, "systemInstruction": system_instruction, "tools": GEMINI_TOOLS}
    model = request.model_override or "gemini-1.5-flash"
    if not re.match(r"^[a-zA-Z0-9.\-_]+$", model):
        raise HTTPException(status_code=400, detail="Ugyldigt modelnavn")

    from urllib.parse import quote
    safe_model = quote(model, safe="")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{safe_model}:generateContent?key={api_key}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(url, json=payload)
            if response.status_code == 404 and model in ("gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"):
                model = "gemini-1.5-pro" if "pro" in model else "gemini-1.5-flash"
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                response = await client.post(url, json=payload)
            response.raise_for_status()
            res_data = response.json()
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error calling Gemini API: %s. Falling back to smart mock response.", e)
            mock_resp = await get_smart_mock_response(request)
            prefix = (
                "⚠️ **Bemærk**: Sprogmodellen er midlertidigt overbelastet (Googles rate-limit/kvote for denne gratis-nøgle er overskredet).\n\n"
                "For at undgå afbrydelser har jeg slået over på min **smarte simulations-tilstand** via direkte database-opslag, så jeg stadig kan hjælpe dig:\n\n"
                if "429" in str(e)
                else f"⚠️ **Bemærk**: Der opstod en midlertidig fejl under kommunikationen med Google Gemini-tjenesten ({e}).\n\n"
                "Jeg har derfor slået over på min **smarte simulations-tilstand** via direkte database-opslag, så jeg stadig kan hjælpe dig:\n\n"
            )
            clean_mock = mock_resp.replace(
                "Da der ikke er konfigureret en aktiv `GOOGLE_KEY` i miljøet, kører jeg",
                "Da Google Gemini-tjenesten er midlertidigt utilgængelig, kører jeg",
            )
            return f"{prefix}{clean_mock}"

        candidates = res_data.get("candidates", [])
        if not candidates:
            return "Undskyld, jeg modtog ikke et gyldigt svar fra min sprogmodel."
        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts:
            return "Undskyld, jeg modtog et tomt svar."

        function_call = next((p.get("functionCall") for p in parts if "functionCall" in p), None)
        text_response = "".join(p.get("text", "") for p in parts if "text" in p)
        if function_call:
            followup = await _gemini_followup_with_tool(client, url, contents, system_instruction, function_call)
            return followup or text_response
        return text_response


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
    last_user_msg = _extract_last_user_message(request.messages) or None

    async def respond(final_response: str) -> ChatResponse:
        return await _build_logged_response(request, db, last_user_msg, final_response)

    if last_user_msg:
        short_response = await try_short_command(last_user_msg, request.user_email, request.user_name)
        if short_response:
            return await respond(short_response)
        context_response = await try_page_context_command(last_user_msg, request.page_context)
        if context_response:
            return await respond(context_response)

    uses_custom = request.model_override == "custom-router" or (
        request.custom_router_url and request.model_override in ("custom-router", "openrouter", "azure")
    )
    if uses_custom:
        try:
            url = _resolve_custom_router_url(request.custom_router_url)
            headers = _router_auth_headers(request, url)
            messages = _openai_messages_for_request(request)
            model = request.custom_router_model or "meta-llama/llama-3-70b-instruct"
            text = await _post_openai_chat(url, headers, messages, model)
            if not text:
                text = "Undskyld, jeg modtog ikke et gyldigt svar fra den tilpassede sprogmodel."
            return await respond(text)
        except HTTPException:
            raise
        except Exception as e:
            return await respond(await _provider_fallback(request, "din tilpassede udbyder", e))

    if request.model_override == "gpt-4o":
        openai_key = request.openai_key or os.getenv("OPENAI_API_KEY")
        if not openai_key:
            logger.warning("OPENAI_API_KEY not found in environment or request. Falling back to mock responses.")
            return await respond(await get_smart_mock_response(request))
        try:
            headers = {"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"}
            text = await _post_openai_chat(
                "https://api.openai.com/v1/chat/completions",
                headers,
                _openai_messages_for_request(request),
                "gpt-4o",
            )
            if not text:
                text = "Undskyld, jeg modtog ikke et gyldigt svar fra OpenAI-modellen."
            return await respond(text)
        except Exception as e:
            return await respond(await _provider_fallback(request, "OpenAI", e))

    if request.model_override == "claude-3-5-sonnet-20241022":
        anthropic_key = request.anthropic_key or os.getenv("ANTHROPIC_API_KEY")
        if not anthropic_key:
            logger.warning("ANTHROPIC_API_KEY not found in environment or request. Falling back to mock responses.")
            return await respond(await get_smart_mock_response(request))
        try:
            text = await _post_anthropic_chat(request, anthropic_key)
            if not text:
                text = "Undskyld, jeg modtog ikke et gyldigt svar fra Anthropic-modellen."
            return await respond(text)
        except Exception as e:
            return await respond(await _provider_fallback(request, "Anthropic", e))

    if not (request.google_key or os.getenv("GOOGLE_KEY") or os.getenv("GEMINI_API_KEY")):
        logger.warning("GOOGLE_KEY or GEMINI_API_KEY not found in environment. Falling back to mock responses.")
        return await respond(await get_smart_mock_response(request))

    return await respond(await _call_gemini_chat(request))

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

