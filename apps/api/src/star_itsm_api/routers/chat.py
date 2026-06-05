import logging
import os
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from star_itsm_api.routers.mcp import (
    get_ticket_categories,
    get_user_tickets,
    search_knowledge_articles,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant" or "system"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_email: str | None = None


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

    # Extract last user message
    user_msg = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_msg = msg.content
            break

    if not user_msg:
        return (
            "Hej! Jeg er din STARdesk-assistent (Help-a-bot).\n\n"
            "Jeg kører i lokal simulations-tilstand. Hvordan kan jeg hjælpe dig i dag?"
        )

    user_msg_lower = user_msg.lower()

    # 1. Check for ticket/status/sager queries
    ticket_keywords = ["sag", "sager", "status", "billet", "ticket", "mine", "mine sager"]
    if any(k in user_msg_lower for k in ticket_keywords):
        tickets_res = await get_user_tickets(user_email)
        return (
            f"**[Mock-assistent]** Her er status på dine seneste sager i systemet (for e-mail: `{user_email}`):\n\n"
            f"{tickets_res}\n\n"
            "Hvis du har brug for at oprette en ny sag, kan du gøre det via 'Opret ny sag'-knappen."
        )

    # 2. Check for categories queries
    cat_keywords = ["kategori", "kategorier", "hvilken kategori", "oprette sag", "opret"]
    if any(k in user_msg_lower for k in cat_keywords):
        cats_res = await get_ticket_categories()
        return (
            f"**[Mock-assistent]** Når du opretter en sag, er det vigtigt at vælge den rigtige kategori. Her er de tilgængelige kategorier og underkategorier:\n\n"
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
    for word in words[:3]:  # limit to top 3 words to avoid too many DB queries
        articles_res = await search_knowledge_articles(word)
        if "Ingen vidensartikler fundet" not in articles_res and "Database er ikke konfigureret" not in articles_res:
            found_articles.append(articles_res)

    if found_articles:
        combined_articles = "\n\n---\n\n".join(found_articles)
        return (
            f"**[Mock-assistent]** Jeg har søgt i vores lokale vidensbase efter emner relateret til din forespørgsel og fundet følgende artikler:\n\n"
            f"{combined_articles}\n\n"
            "Hvis disse artikler ikke løser dit problem, kan du beskrive det nærmere eller oprette en sag."
        )

    # 4. Default fallback response if no match
    return (
        f"Hej! Jeg er din STARdesk-assistent (Help-a-bot).\n\n"
        f"Da der ikke er konfigureret en aktiv `GOOGLE_KEY` i miljøet, kører jeg i en **smart simulations-tilstand** ved hjælp af direkte database-opslag.\n\n"
        f"Jeg forstod ikke helt din besked: *\"{user_msg}\"*\n\n"
        f"Prøv at spørge mig om:\n"
        f"- **Vidensartikler**: Skriv f.eks. 'vpn', 'mitid', 'adgangskode' eller lignende.\n"
        f"- **Dine sager**: Skriv f.eks. 'mine sager' eller 'status' (viser sager tilknyttet `{user_email}`).\n"
        f"- **Kategorier**: Skriv f.eks. 'kategorier' eller 'opret' for at se tilgængelige sagskategorier."
    )


@router.post("", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    # Retrieve the Google Gemini API key from the environment
    api_key = os.getenv("GOOGLE_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        # Fallback to mock behavior if no API key is set
        logger.warning(
            "GOOGLE_KEY or GEMINI_API_KEY not found in environment. Falling back to mock responses."
        )
        mock_resp = await get_smart_mock_response(request)
        return ChatResponse(response=mock_resp)

    # Format the messages history for Gemini API
    # Gemini uses "user" and "model" roles (instead of "assistant")
    contents = []
    for msg in request.messages:
        role = "user" if msg.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.content}]})

    # System instruction to define the bot's identity and behavior
    system_instruction = {
        "parts": [
            {
                "text": (
                    "Du er STARdesk AI-assistenten (kaldet 'Help-a-bot' for medarbejdere og 'Sag-assistent' for eksterne brugere). "
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

    # We use gemini-2.5-flash as the fast, free-tier model
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            res_data = response.json()
        except Exception as e:
            logger.error(f"Error calling Gemini API: {str(e)}")
            raise HTTPException(status_code=502, detail=f"Kunne ikke kontakte Gemini API: {str(e)}")

        # Check if the model wants to call a function
        try:
            candidates = res_data.get("candidates", [])
            if not candidates:
                return ChatResponse(
                    response="Undskyld, jeg modtog ikke et gyldigt svar fra min sprogmodel."
                )

            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            if not parts:
                return ChatResponse(response="Undskyld, jeg modtog et tomt svar.")

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
                    return ChatResponse(response=final_text)

            return ChatResponse(response=text_response)

        except Exception as e:
            logger.exception("Error parsing Gemini API response")
            raise HTTPException(
                status_code=500, detail=f"Fejl under behandling af svar fra sprogmodel: {str(e)}"
            )
