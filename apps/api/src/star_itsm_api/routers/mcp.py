import logging

from fastapi import APIRouter, Request
from mcp.server.fastmcp import FastMCP
from mcp.server.sse import SseServerTransport
from sqlalchemy import or_, select

from star_itsm_api.core.security import is_staff
from star_itsm_api.db import async_session_factory
from star_itsm_api.models.category import Category, Subcategory
from star_itsm_api.models.comment import TicketComment
from star_itsm_api.models.ticket import Ticket
from star_itsm_api.models.ticket_event import TicketEvent
from star_itsm_api.models.user import User
from star_itsm_api.services.org_access import user_can_access_ticket
from star_itsm_api.services.ticket_timestamps import apply_status_milestone_timestamps

logger = logging.getLogger(__name__)

# Initialize FastMCP server
mcp = FastMCP("STARdesk Knowledge Base")

# Initialize SSE Server Transport
# Note: we use a relative path /messages/ for posting messages
transport = SseServerTransport("/api/v1/mcp/messages")

router = APIRouter(prefix="/mcp", tags=["mcp"])

@router.get("/sse")
async def handle_sse(request: Request):
    async with transport.connect_sse(
        request.scope,
        request.receive,
        request._send
    ) as (in_stream, out_stream):
        await mcp._mcp_server.run(
            in_stream,
            out_stream,
            mcp._mcp_server.create_initialization_options()
        )

# Mount the message post handler onto the router
router.mount("/messages", transport.handle_post_message)


@mcp.tool()
async def search_knowledge_articles(query: str) -> str:
    """Søg efter offentliggjorte eksterne vidensartikler i STARdesk.
    
    Hjælper med at løse problemer eller guide oprettelse af sager.
    
    Args:
        query: Søgetekst (fx "mitid", "vpn", "adgangskode").
    """
    if not async_session_factory:
        return "Database er ikke konfigureret."
    
    async with async_session_factory() as db:
        stmt = (
            select(Ticket)
            .where(
                Ticket.is_knowledge_article.is_(True),
                Ticket.knowledge_status == "published",
                Ticket.knowledge_visibility == "external",
                Ticket.deleted_at.is_(None),
                or_(
                    Ticket.title.ilike(f"%{query}%"),
                    Ticket.description.ilike(f"%{query}%")
                )
            )
            .limit(5)
        )
        result = await db.execute(stmt)
        articles = result.scalars().all()
        
        if not articles:
            return f"Ingen vidensartikler fundet for søgningen '{query}'."
        
        output = []
        for a in articles:
            output.append(
                f"### {a.title} (Sagsnr: {a.ticket_number})\n"
                f"**Beskrivelse:** {a.description}\n"
                f"**Tags:** {', '.join(a.tags) if a.tags else 'ingen'}\n"
            )
        return "\n\n".join(output)


@mcp.tool()
async def get_ticket_categories() -> str:
    """Hent listen over aktive sagskategorier og underkategorier i STARdesk.
    
    Bruges til at guide brugeren til at vælge den rigtige kategori ved oprettelse af en sag.
    """
    if not async_session_factory:
        return "Database er ikke konfigureret."
        
    async with async_session_factory() as db:
        # Fetch active categories
        cat_stmt = (
            select(Category)
            .where(Category.is_active.is_(True))
            .order_by(Category.sort_order)
        )
        cat_result = await db.execute(cat_stmt)
        categories = cat_result.scalars().all()
        
        # Fetch active subcategories
        sub_stmt = (
            select(Subcategory)
            .where(Subcategory.is_active.is_(True))
            .order_by(Subcategory.sort_order)
        )
        sub_result = await db.execute(sub_stmt)
        subcategories = sub_result.scalars().all()
        
        # Group subcategories by category_id
        subs_by_cat = {}
        for sub in subcategories:
            subs_by_cat.setdefault(sub.category_id, []).append(sub)
            
        output = ["Her er de tilgængelige sagskategorier og underkategorier i STARdesk:"]
        for cat in categories:
            output.append(f"- **{cat.name_da}** (ID: {cat.id})")
            cat_subs = subs_by_cat.get(cat.id, [])
            if cat_subs:
                for sub in cat_subs:
                    output.append(f"  - {sub.name_da} (ID: {sub.id})")
            else:
                output.append("  - Ingen underkategorier")
                
        return "\n".join(output)


async def get_user_tickets(user_email: str, *, caller: User) -> str:
    """Hent supportsager for den autentificerede bruger (eller anden bruger for staff)."""
    if not is_staff(caller):
        user_email = caller.email

    if not async_session_factory:
        return "Database er ikke konfigureret."
        
    async with async_session_factory() as db:
        # Find user by email
        user_stmt = select(User).where(User.email.ilike(user_email), User.deleted_at.is_(None))
        user_result = await db.execute(user_stmt)
        user = user_result.scalar_one_or_none()
        
        if not user:
            return (
                f"Brugeren med e-mail '{user_email}' "
                "blev ikke fundet i systemet."
            )
            
        # Fetch user's tickets
        ticket_stmt = (
            select(Ticket)
            .where(
                Ticket.reporter_user_id == user.id,
                Ticket.deleted_at.is_(None)
            )
            .order_by(Ticket.created_at.desc())
            .limit(5)
        )
        ticket_result = await db.execute(ticket_stmt)
        tickets = ticket_result.scalars().all()
        
        if not tickets:
            return (
                f"Brugeren '{user.display_name}' ({user_email}) "
                "har ingen supportsager i systemet."
            )
            
        output = [f"Her er de seneste supportsager for {user.display_name} ({user_email}):"]
        for t in tickets:
            created_str = (
                t.created_at.strftime('%Y-%m-%d %H:%M')
                if t.created_at else 'ukendt'
            )
            output.append(
                f"- **{t.title}** (Sagsnr: {t.ticket_number})\n"
                f"  - **Status:** {t.status}\n"
                f"  - **Prioritet:** {t.priority}\n"
                f"  - **Oprettet:** {created_str}\n"
            )
        return "\n".join(output)


@mcp.tool()
async def search_historical_solutions(query: str) -> str:
    """Søg efter anonymiserede historiske løsninger på tværs af tidligere afsluttede supportsager.
    
    Hjælper med at finde ud af, hvordan andre har fået løst lignende problemer ud fra anonyme resuméer.
    
    Args:
        query: Søgetekst (fx "vpn", "print", "adgangskode").
    """
    if not async_session_factory:
        return "Database er ikke konfigureret."
        
    async with async_session_factory() as db:
        stmt = (
            select(Ticket)
            .where(
                Ticket.is_knowledge_article.is_(False),
                Ticket.is_security_ticket.is_(False),
                Ticket.status.in_(["resolved", "closed"]),
                Ticket.llm_summary.isnot(None),
                Ticket.deleted_at.is_(None),
                or_(
                    Ticket.title.ilike(f"%{query}%"),
                    Ticket.llm_summary.ilike(f"%{query}%")
                )
            )
            .limit(5)
        )
        result = await db.execute(stmt)
        tickets = result.scalars().all()
        
        if not tickets:
            return f"Ingen historiske løsninger fundet for søgningen '{query}'."
            
        output = []
        for t in tickets:
            output.append(
                f"### {t.title} (Sagsnr: {t.ticket_number})\n"
                f"**Løsningsresumé:** {t.llm_summary}\n"
                f"**Emner:** {', '.join(t.semantic_topics) if t.semantic_topics else 'ingen'}\n"
            )
        return "\n\n".join(output)


async def create_ticket(
    title: str,
    description: str,
    category_id: str | None = None,
    subcategory_id: str | None = None,
    priority: str = "medium",
    ticket_type: str = "incident",
    *,
    caller: User,
) -> str:
    """Opret en ny supportsag for den autentificerede bruger."""
    if not async_session_factory:
        return "Database er ikke konfigureret."
        
    if len(title.strip()) < 3:
        return "Fejl: Titlen skal være mindst 3 tegn lang."
        
    if len(description.strip()) < 10:
        return "Fejl: Beskrivelsen skal være mindst 10 tegn lang."

    user_email = caller.email

    # Validate priority and ticket_type values
    if priority not in ["critical", "high", "medium", "low"]:
        priority = "medium"
    if ticket_type not in ["incident", "service_request", "problem"]:
        ticket_type = "incident"

    import uuid
    from datetime import UTC, datetime

    from star_itsm_api.services.org_access import get_user_organization_id
    from star_itsm_api.services.routing import apply_routing
    from star_itsm_api.services.ticket_numbers import generate_ticket_number
    from star_itsm_api.services.ticket_security import resolve_create_security_flag

    async with async_session_factory() as db:
        # Find user by email
        user_stmt = select(User).where(User.email.ilike(user_email), User.deleted_at.is_(None))
        user_result = await db.execute(user_stmt)
        user = user_result.scalar_one_or_none()
        
        if not user:
            return f"Fejl: Brugeren med e-mail '{user_email}' blev ikke fundet i systemet."

        cat_uuid = None
        subcat_uuid = None
        if category_id:
            try:
                cat_uuid = uuid.UUID(category_id)
            except ValueError:
                return f"Fejl: Ugyldigt kategori UUID-format: '{category_id}'"
        if subcategory_id:
            try:
                subcat_uuid = uuid.UUID(subcategory_id)
            except ValueError:
                return f"Fejl: Ugyldigt underkategori UUID-format: '{subcategory_id}'"

        routing = await apply_routing(
            db,
            ticket_type=ticket_type,
            category_id=cat_uuid,
            subcategory_id=subcat_uuid,
            priority=priority,
        )

        is_security_ticket = resolve_create_security_flag(user, False)
        ticket_number = await generate_ticket_number(db, ticket_type)
        now = datetime.now(UTC)

        ticket = Ticket(
            id=uuid.uuid4(),
            ticket_number=ticket_number,
            ticket_type=ticket_type,
            title=title.strip(),
            description=description.strip(),
            status="new",
            priority=routing.priority,
            reporter_user_id=user.id,
            organization_id=get_user_organization_id(user),
            assigned_team_id=routing.assigned_team_id,
            assigned_user_id=routing.assigned_user_id,
            category_id=cat_uuid,
            subcategory_id=subcat_uuid,
            source="chat",
            escalation_level=0,
            gdpr_consent=True, # Chat consent is implied/collected during conversation
            gdpr_consent_at=now,
            is_major=False,
            is_security_ticket=is_security_ticket,
            created_at=now,
            updated_at=now,
        )

        db.add(ticket)
        await db.commit()
        await db.refresh(ticket)

        return (
            f"Sagen blev oprettet med succes!\n\n"
            f"**Sagsnummer:** {ticket.ticket_number}\n"
            f"**Titel:** {ticket.title}\n"
            f"**Type:** {ticket.ticket_type}\n"
            f"**Prioritet:** {ticket.priority}\n"
            f"**Status:** {ticket.status}"
        )


async def get_ticket_by_number(ticket_number: str, *, caller: User) -> str:
    """Hent detaljer om en supportsag; adgang håndhæves via caller."""
    if not async_session_factory:
        return "Database er ikke konfigureret."

    normalized = ticket_number.strip().upper()
    if not normalized:
        return "Fejl: Angiv et gyldigt sagsnummer."

    async with async_session_factory() as db:
        stmt = select(Ticket).where(
            Ticket.ticket_number.ilike(normalized),
            Ticket.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        ticket = result.scalar_one_or_none()

        if not ticket:
            return f"Ingen sag fundet med sagsnummer '{normalized}'."

        if not await user_can_access_ticket(db, caller, ticket):
            return "Fejl: Du har ikke adgang til denne sag."

        reporter_stmt = select(User).where(User.id == ticket.reporter_user_id)
        reporter_result = await db.execute(reporter_stmt)
        reporter = reporter_result.scalar_one_or_none()
        reporter_label = (
            f"{reporter.display_name} ({reporter.email})"
            if reporter
            else "Ukendt"
        )
        created_str = (
            ticket.created_at.strftime("%Y-%m-%d %H:%M")
            if ticket.created_at
            else "ukendt"
        )
        updated_str = (
            ticket.updated_at.strftime("%Y-%m-%d %H:%M")
            if ticket.updated_at
            else "ukendt"
        )

        return (
            f"**{ticket.title}** (Sagsnr: {ticket.ticket_number})\n"
            f"- **Status:** {ticket.status}\n"
            f"- **Prioritet:** {ticket.priority}\n"
            f"- **Type:** {ticket.ticket_type}\n"
            f"- **Indmelder:** {reporter_label}\n"
            f"- **Oprettet:** {created_str}\n"
            f"- **Sidst opdateret:** {updated_str}\n"
            f"- **Beskrivelse:** {ticket.description[:500]}{'…' if len(ticket.description) > 500 else ''}"
        )


ALLOWED_STATUSES = frozenset({
    "new",
    "assigned",
    "in_progress",
    "pending",
    "resolved",
    "closed",
    "cancelled",
})


async def update_ticket_status(
    ticket_number: str,
    status: str,
    note: str | None = None,
    *,
    caller: User,
) -> str:
    """Opdater status på en supportsag; kun staff med adgang til sagen."""
    if not async_session_factory:
        return "Database er ikke konfigureret."

    normalized_number = ticket_number.strip().upper()
    normalized_status = status.strip().lower()

    if normalized_status not in ALLOWED_STATUSES:
        allowed = ", ".join(sorted(ALLOWED_STATUSES))
        return f"Fejl: Ugyldig status '{status}'. Tilladte værdier: {allowed}."

    async with async_session_factory() as db:
        if not is_staff(caller):
            return (
                "Fejl: Kun medarbejdere kan opdatere sagsstatus via Help-a-bot. "
                "Log ind som agent for at udføre denne handling."
            )
        actor = caller

        ticket_stmt = select(Ticket).where(
            Ticket.ticket_number.ilike(normalized_number),
            Ticket.deleted_at.is_(None),
        )
        ticket_result = await db.execute(ticket_stmt)
        ticket = ticket_result.scalar_one_or_none()

        if not ticket:
            return f"Ingen sag fundet med sagsnummer '{normalized_number}'."

        if not await user_can_access_ticket(db, caller, ticket):
            return "Fejl: Du har ikke adgang til denne sag."

        import uuid
        from datetime import UTC, datetime

        previous_status = ticket.status
        now = datetime.now(UTC)
        ticket.status = normalized_status
        apply_status_milestone_timestamps(ticket, normalized_status, now=now)
        ticket.updated_at = now

        db.add(
            TicketEvent(
                id=uuid.uuid4(),
                ticket_id=ticket.id,
                actor_user_id=actor.id,
                event_type="ticket.status_changed",
                payload={
                    "status": normalized_status,
                    "previous_status": previous_status,
                    "source": "help-a-bot",
                },
                created_at=now,
            )
        )

        if note and note.strip():
            db.add(
                TicketComment(
                    id=uuid.uuid4(),
                    ticket_id=ticket.id,
                    author_user_id=actor.id,
                    body=note.strip(),
                    is_internal=True,
                    created_at=now,
                )
            )

        await db.commit()
        await db.refresh(ticket)

        note_line = f"\n- **Note:** {note.strip()}" if note and note.strip() else ""
        return (
            f"Sagsstatus opdateret!\n\n"
            f"**Sagsnummer:** {ticket.ticket_number}\n"
            f"**Titel:** {ticket.title}\n"
            f"**Tidligere status:** {previous_status}\n"
            f"**Ny status:** {ticket.status}{note_line}"
        )


