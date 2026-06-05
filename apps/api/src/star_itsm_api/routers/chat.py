import logging
import os
import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from star_itsm_api.routers.mcp import (
    search_knowledge_articles,
    get_ticket_categories,
    get_user_tickets
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant" or "system"
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_email: Optional[str] = None

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
                            "description": "Søgetekst (fx 'mitid', 'vpn', 'adgangskode')."
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "get_ticket_categories",
                "description": "Hent listen over aktive sagskategorier og underkategorier i STARdesk. Bruges til at guide brugeren til at vælge den rigtige kategori ved oprettelse af en sag.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {}
                }
            },
            {
                "name": "get_user_tickets",
                "description": "Hent de seneste supportsager for en specifik bruger baseret på deres e-mailadresse. Bruges til at tjekke status eller give opdateringer.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "user_email": {
                            "type": "STRING",
                            "description": "Brugerens e-mailadresse (fx 'jan.hansen@star.dk')."
                        }
                    },
                    "required": ["user_email"]
                }
            }
        ]
    }
]

async def execute_tool(name: str, args: Dict[str, Any]) -> str:
    """Execute the local python function matching the Gemini function call."""
    try:
        if name == "search_knowledge_articles":
            query = args.get("query", "")
            return await search_knowledge_articles(query)
        elif name == "get_ticket_categories":
            return await get_ticket_categories()
        elif name == "get_user_tickets":
            email = args.get("user_email", "")
            return await get_user_tickets(email)
        else:
            return f"Fejl: Værktøjet '{name}' findes ikke."
    except Exception as e:
        logger.exception(f"Error executing tool {name}")
        return f"Fejl under kørsel af værktøj: {str(e)}"

@router.post("", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    # Retrieve the Google Gemini API key from the environment
    api_key = os.getenv("GOOGLE_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        # Fallback to mock behavior if no API key is set
        logger.warning("GOOGLE_KEY or GEMINI_API_KEY not found in environment. Falling back to mock responses.")
        return ChatResponse(response="Hej! Jeg er din STARdesk-assistent. For at kunne svare rigtigt på dine spørgsmål via Gemini, skal administratoren konfigurere `GOOGLE_KEY` i miljøet. Hvordan kan jeg hjælpe dig i dag?")

    # Format the messages history for Gemini API
    # Gemini uses "user" and "model" roles (instead of "assistant")
    contents = []
    for msg in request.messages:
        role = "user" if msg.role == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg.content}]
        })

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
    payload = {
        "contents": contents,
        "systemInstruction": system_instruction,
        "tools": GEMINI_TOOLS
    }

    # We use gemini-1.5-flash as the fast, free-tier model
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"

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
                return ChatResponse(response="Undskyld, jeg modtog ikke et gyldigt svar fra min sprogmodel.")

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
                contents.append({
                    "role": "model",
                    "parts": [{"functionCall": function_call}]
                })
                contents.append({
                    "role": "user",
                    "parts": [
                        {
                            "functionResponse": {
                                "name": tool_name,
                                "response": {"output": tool_result}
                            }
                        }
                    ]
                })

                # Call Gemini again with the tool result included in the history
                second_payload = {
                    "contents": contents,
                    "systemInstruction": system_instruction,
                    "tools": GEMINI_TOOLS
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
            raise HTTPException(status_code=500, detail=f"Fejl under behandling af svar fra sprogmodel: {str(e)}")
