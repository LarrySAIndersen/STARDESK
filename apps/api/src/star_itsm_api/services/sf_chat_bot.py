"""Mock Sag-assistent replies for SF chat queue (chat service bot)."""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.user import User

BOT_SENDER_LABEL = "Sag-assistent"
TICKET_NUMBER_RE = re.compile(
    r"\b([A-Z]{2,}(?:-[A-Z0-9]+)+-\d{3,}|[A-Z]{2,}-\d{4,})\b",
    re.IGNORECASE,
)

_STATUS_DA = {
    "received": "Modtaget",
    "in_progress": "Igangsat",
    "resolved": "Løst",
    "closed": "Lukket",
}

_PRIORITY_DA = {
    "low": "Lav",
    "medium": "Mellem",
    "high": "Høj",
    "critical": "Kritisk",
}

_MOCK_SYSTEMS = [
    ("STAR Platform", "STAR", "Normal drift"),
    ("Infrastruktur", "INFRA", "Normal drift"),
    ("Integration", "INT", "Nedsat"),
    ("Forretningsapplikationer", "BIZ", "Normal drift"),
]


async def _customer_tickets(db: AsyncSession, customer_id) -> list[Ticket]:
    result = await db.execute(
        select(Ticket)
        .where(Ticket.reporter_user_id == customer_id)
        .order_by(Ticket.created_at.desc())
        .limit(20)
    )
    return list(result.scalars().all())


def _format_ticket(t: Ticket) -> str:
    status = _STATUS_DA.get(t.status, t.status)
    priority = _PRIORITY_DA.get(t.priority, t.priority)
    lines = [f"{t.ticket_number} — {t.title}", f"Status: {status} · Prioritet: {priority}"]
    if t.source:
        lines.append(f"Kilde: {t.source}")
    return "\n".join(lines)


def mock_bot_reply(text: str, tickets: list[Ticket], *, display_name: str | None) -> str:
    raw = text.strip()
    if not raw:
        return "Skriv dit spørgsmål — fx «vis mine sager» eller et sagsnummer."

    lower = raw.lower()
    first = (display_name or "").split()[0] if display_name else None

    if lower in {"hjælp", "help"} or "hvad kan du" in lower or lower.startswith(("hej", "hello")):
        greet = f"Hej {first}!" if first else "Hej!"
        return (
            f"{greet} Jeg er **Sag-assistenten** (chat service) mens du venter på en agent.\n\n"
            "Jeg kan hjælpe med:\n"
            "• **Mine sager** — dine egne sager\n"
            "• **En sag** — skriv sagsnummer\n"
            "• **Systemer** — overordnet IT-status (mock)\n\n"
            "En agent overtager chatten, når der er ledig kapacitet."
        )

    if "mine sager" in lower or "egne sager" in lower or "mine egne" in lower:
        mine = [t for t in tickets if not t.is_major]
        if not mine:
            return (
                "Du har ingen egne sager endnu. "
                "Opret en sag via portalen, hvis du har brug for hjælp."
            )
        lines = [f"Du har {len(mine)} sag(er):", ""]
        for t in mine[:8]:
            lines.append(f"• {t.ticket_number}: {t.title} ({_STATUS_DA.get(t.status, t.status)})")
        if len(mine) > 8:
            lines.append(f"… og {len(mine) - 8} mere.")
        lines.append("\nSkriv et sagsnummer for detaljer.")
        return "\n".join(lines)

    match = TICKET_NUMBER_RE.search(raw)
    if match:
        ref = match.group(1).upper()
        for t in tickets:
            if t.ticket_number.upper() == ref:
                return _format_ticket(t)
        return f"Jeg fandt ikke sagen {ref} blandt dine sager."

    if "system" in lower or "status på" in lower or "drift" in lower:
        lines = ["**IT-systemer (mock):**", ""]
        for name, code, st in _MOCK_SYSTEMS:
            lines.append(f"• {name} ({code}) — {st}")
        lines.append("\nSpørg fx «status på Integration».")
        return "\n".join(lines)

    return (
        "Det forstod jeg ikke helt. "
        "Prøv «vis mine sager», «systemer» eller et sagsnummer fra listen."
    )


async def build_bot_reply_for_customer(
    db: AsyncSession,
    *,
    customer: User,
    message_body: str,
) -> str:
    tickets = await _customer_tickets(db, customer.id)
    return mock_bot_reply(
        message_body,
        tickets,
        display_name=customer.display_name,
    )
