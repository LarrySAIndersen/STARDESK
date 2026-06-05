import contextlib
import logging
import os
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
    get_ticket_categories,
    get_user_tickets,
    search_knowledge_articles,
    search_historical_solutions,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


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

    # 1. Check for ticket/status/sager queries
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
        f"- **Vidensartikler**: Skriv f.eks. 'vpn', 'mitid', 'adgangskode' eller lignende.\n"
        f"- **Dine sager**: Skriv f.eks. 'mine sager' eller 'status' (viser sager tilknyttet `{user_email}`).\n"
        f"- **Kategorier**: Skriv f.eks. 'kategorier' eller 'opret' for at se tilgængelige sagskategorier."
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

        # Look for ticket ref like SAG-123
        import re
        ticket_match = re.search(r"SAG-\d+", body_lower)
        ticket_ref = ticket_match.group(0).upper() if ticket_match else None

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
        system_text = (
            "Du er STARdesk AI-assistenten (kaldet 'Help-a-bot' for medarbejdere og 'Sag-assistent' for eksterne brugere). "
            f"Den aktuelle bruger, du taler med, hedder: {request.user_name or 'Bruger'}. "
            f"Det er MEGET vigtigt, at du hilser på brugeren ved navn ({request.user_name or 'Bruger'}) og titulerer dem med navn på en personlig og høflig måde under jeres samtale! "
            "Du hjælper brugere med at finde svar på deres IT-spørgsmål, tjekke status på deres sager, og vælge de rigtige kategorier. "
            "Svar altid venligt, professionelt og på dansk."
        )
        
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

    # Retrieve the Google Gemini API key from the environment
    api_key = os.getenv("GOOGLE_KEY") or os.getenv("GEMINI_API_KEY")
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

    # System instruction to define the bot's identity and behavior
    user_display_name = request.user_name or "Bruger"
    system_instruction = {
        "parts": [
            {
                "text": (
                    "Du er STARdesk AI-assistenten (kaldet 'Help-a-bot' for medarbejdere og 'Sag-assistent' for eksterne brugere). "
                    f"Den aktuelle bruger, du taler med, hedder: {user_display_name}. "
                    f"Det er MEGET vigtigt, at du hilser på brugeren ved navn ({user_display_name}) og titulerer dem med navn på en personlig og høflig måde under jeres samtale! "
                    "Du hjælper brugere med at finde svar på deres IT-spørgsmål, tjekke status på deres sager, og vælge de rigtige kategorier. "
                    "Svar altid venligt, professionelt og på dansk. "
                    "Du har adgang til værktøjer til at søge i vidensartikler, hente kategorier og finde sager. Brug dem aktivt, når det er relevant! "
                    f"Hvis du leder efter sager for den aktuelle bruger, kan du bruge deres e-mail: {request.user_email or 'ikke angivet'}."
                )
            }
        ]
    }

    # Prepare the payload for Gemini API
    payload = {"contents": contents, "systemInstruction": system_instruction, "tools": GEMINI_TOOLS}

    # Use selected or overridden model
    model = request.model_override or "gemini-2.5-flash"
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
        conditions.append(ChatbotMessage.user_id is None)

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

