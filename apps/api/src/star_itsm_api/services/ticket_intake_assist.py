"""Rule-based mock intake assistant (no external LLM)."""

from __future__ import annotations

import re
from typing import Literal

from star_itsm_api.schemas.ticket_intake_assist import IntakeAssistMessage, IntakeAssistResponse

Priority = Literal["critical", "high", "medium", "low"]
TicketType = Literal["service_request", "incident", "problem"]

_RULES: tuple[tuple[re.Pattern[str], dict], ...] = (
    (
        re.compile(r"\bvpn\b|hjemmefra|fjernarbejde|remote", re.I),
        {
            "topic": "VPN / fjernarbejde",
            "title": "VPN-forbindelse virker ikke hjemmefra",
            "emoji": "🔒",
            "tags": ["vpn", "fjernarbejde", "netværk"],
            "priority": "high",
            "ticket_type": "incident",
            "intake": {"vpn_remote": "ja", "device_type": "laptop"},
            "reply": (
                "Det lyder som et VPN- eller fjernarbejdsproblem. Jeg foreslår titel om VPN "
                "og spørger ind til enhed og hastighed."
            ),
        },
    ),
    (
        re.compile(r"\bprinter|print|udskrift", re.I),
        {
            "topic": "Printer",
            "title": "Printer udskriver ikke",
            "emoji": "🖨️",
            "tags": ["printer", "hardware"],
            "priority": "medium",
            "ticket_type": "incident",
            "intake": {"device_type": "printer"},
            "reply": (
                "Printerproblemer noteres — jeg foreslår enhedstype printer og relevante tags."
            ),
        },
    ),
    (
        re.compile(r"\blogin|logge\s*ind|adgangskode|password|kodeord|konto", re.I),
        {
            "topic": "Login / adgang",
            "title": "Kan ikke logge ind på system",
            "emoji": "🔑",
            "tags": ["adgang", "login", "konto"],
            "priority": "high",
            "ticket_type": "incident",
            "intake": {},
            "reply": (
                "Login- eller adgangsproblemer prioriteres ofte højt. "
                "Bekræft gerne hvilket system det gælder."
            ),
        },
    ),
    (
        re.compile(r"\bmail|outlook|exchange|e-?mail", re.I),
        {
            "topic": "E-mail",
            "title": "E-mail / Outlook problem",
            "emoji": "📧",
            "tags": ["mail", "outlook", "microsoft365"],
            "priority": "medium",
            "ticket_type": "incident",
            "intake": {},
            "reply": "E-mail relaterede sager tager jeg med Outlook/Microsoft 365 i beskrivelsen.",
        },
    ),
    (
        re.compile(r"\bmøde|deadline|akut|straks|haster|kritisk", re.I),
        {
            "topic": "Haster",
            "title": "Akut IT-hændelse — behøver hurtig hjælp",
            "emoji": "⚡",
            "tags": ["akut"],
            "priority": "critical",
            "ticket_type": "incident",
            "intake": {"urgency": "møde_snart"},
            "reply": (
                "Jeg markerer sagen som hastende med høj prioritet og urgency-spørgsmål udfyldt."
            ),
        },
    ),
    (
        re.compile(r"\bwifi|wi-fi|netværk|internet", re.I),
        {
            "topic": "Netværk",
            "title": "Netværks- eller Wi-Fi problem",
            "emoji": "📶",
            "tags": ["netværk", "wifi"],
            "priority": "medium",
            "ticket_type": "incident",
            "intake": {"device_type": "laptop"},
            "reply": "Netværksproblemer kortlægges med relevante tags og enhedstype.",
        },
    ),
)


def _conversation_text(messages: list[IntakeAssistMessage]) -> str:
    parts: list[str] = []
    for msg in messages:
        parts.append(msg.content.strip())
    return "\n".join(parts)


def mock_assistant_reply(user_text: str) -> str:
    """Short Danish reply for chat UI (keyword mock)."""
    for pattern, cfg in _RULES:
        if pattern.search(user_text):
            return str(cfg["reply"])
    return (
        "Tak — jeg har noteret beskrivelsen. Gennemgå forslaget nedenfor og brug "
        "«Overfør til sag» når det passer, eller «Generer igen» for et nyt udkast."
    )


def build_intake_assist_draft(messages: list[IntakeAssistMessage]) -> IntakeAssistResponse:
    blob = _conversation_text(messages)
    matched: dict | None = None
    for pattern, cfg in _RULES:
        if pattern.search(blob):
            matched = cfg
            break

    user_lines = [m.content.strip() for m in messages if m.role == "user" and m.content.strip()]
    summary = user_lines[-1] if user_lines else blob[:500]

    if matched:
        topic = str(matched["topic"])
        title = str(matched["title"])
        emoji = matched.get("emoji")
        tags = list(matched.get("tags") or [])
        priority: Priority = matched.get("priority", "medium")  # type: ignore[assignment]
        ticket_type: TicketType = matched.get("ticket_type", "incident")  # type: ignore[assignment]
        intake = dict(matched.get("intake") or {})
        description = (
            f"**{topic}** (AI-assistent mock)\n\n"
            f"Brugerens beskrivelse:\n{summary}\n\n"
            f"Samlet dialog:\n{blob[:2000]}"
        )
    else:
        title = _fallback_title(summary)
        emoji = "💬"
        tags = ["generel", "it-support"]
        priority = "medium"
        ticket_type = "incident"
        intake = {"device_type": "andet"}
        description = (
            "**Generel IT-support** (AI-assistent mock)\n\n"
            f"{summary}\n\n"
            f"Yderligere detaljer fra dialog:\n{blob[:2000]}"
        )

    return IntakeAssistResponse(
        title=title[:256],
        description=description[:8000],
        intake_answers=intake,
        suggested_priority=priority,
        suggested_ticket_type=ticket_type,
        tags=tags[:10],
        emoji=emoji if isinstance(emoji, str) else None,
    )


def _fallback_title(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if len(cleaned) <= 80:
        return cleaned or "IT-support henvendelse"
    return f"{cleaned[:77]}…"
