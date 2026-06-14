"""Stable integration API — narrow contract for external systems (TOPdesk, Jira, etc.)."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.integration_api_auth import IntegrationClient, get_integration_client
from star_itsm_api.deps import require_db
from star_itsm_api.schemas.integration_api import (
    IntegrationCaseTypeRead,
    IntegrationProfileRead,
    IntegrationTicketCreate,
    IntegrationTicketListRead,
    IntegrationTicketPatch,
    IntegrationTicketRead,
    IntegrationTicketStatus,
    IntegrationTicketType,
)
from star_itsm_api.services.integration_api import (
    CASE_TYPE_CATALOG,
    INTEGRATION_PROFILE_CAPABILITIES,
    create_integration_ticket,
    get_ticket_for_integration,
    list_integration_tickets,
    patch_integration_ticket,
    resolve_integration_organization_id,
    ticket_to_integration_read,
)

router = APIRouter(
    prefix="/integration",
    tags=["Integration API"],
)


@router.get(
    "/profile",
    response_model=IntegrationProfileRead,
    summary="Integration API profile",
    description=(
        "Describes the stable machine contract: auth headers, pagination, "
        "case types, and external reference format."
    ),
)
async def integration_profile(
    _client: IntegrationClient = Depends(get_integration_client),
) -> IntegrationProfileRead:
    return IntegrationProfileRead(
        openapi_url="/openapi.json",
        auth=["X-Integration-Key", "X-Integration-System (optional)"],
        capabilities=list(INTEGRATION_PROFILE_CAPABILITIES),
        case_types=[item.id for item in CASE_TYPE_CATALOG],
        pagination={"default_page_size": 50, "max_page_size": 100, "style": "page"},
    )


@router.get(
    "/case-types",
    response_model=list[IntegrationCaseTypeRead],
    summary="List sagstyper / case types",
    description="Stable catalog of supported ticket types for routing and SLA.",
)
async def integration_case_types(
    _client: IntegrationClient = Depends(get_integration_client),
) -> list[IntegrationCaseTypeRead]:
    return list(CASE_TYPE_CATALOG)


@router.get(
    "/tickets",
    response_model=IntegrationTicketListRead,
    summary="List tickets (paginated)",
    description="Page through tickets with optional delta sync via updated_since.",
)
async def integration_list_tickets(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    ticket_type: IntegrationTicketType | None = Query(default=None),
    status: IntegrationTicketStatus | None = Query(default=None, alias="status"),
    updated_since: datetime | None = Query(
        default=None,
        description="Return tickets updated at or after this UTC timestamp.",
    ),
    external_system: str | None = Query(
        default=None,
        description="Filter by integration source system slug.",
    ),
    db: AsyncSession = Depends(require_db),
    client: IntegrationClient = Depends(get_integration_client),
) -> IntegrationTicketListRead:
    organization_id = await resolve_integration_organization_id(db, client)
    return await list_integration_tickets(
        db,
        organization_id=organization_id,
        page=page,
        page_size=page_size,
        ticket_type=ticket_type,
        status_filter=status,
        updated_since=updated_since,
        external_system=external_system or client.system,
    )


@router.post(
    "/tickets",
    response_model=IntegrationTicketRead,
    status_code=201,
    summary="Create ticket from external system",
    description=(
        "Idempotent on external_ref: returns the existing ticket when the "
        "system+external_id pair is already linked."
    ),
)
async def integration_create_ticket(
    payload: IntegrationTicketCreate,
    db: AsyncSession = Depends(require_db),
    client: IntegrationClient = Depends(get_integration_client),
) -> IntegrationTicketRead:
    organization_id = await resolve_integration_organization_id(db, client)
    if not payload.external_ref.system.strip():
        payload.external_ref.system = client.system
    return await create_integration_ticket(
        db,
        client=client,
        organization_id=organization_id,
        payload=payload,
    )


@router.get(
    "/tickets/{ticket_ref}",
    response_model=IntegrationTicketRead,
    summary="Get ticket by UUID or external ref",
    description="Use ext:{system}:{external_id} for cross-system lookup.",
)
async def integration_get_ticket(
    ticket_ref: str,
    db: AsyncSession = Depends(require_db),
    client: IntegrationClient = Depends(get_integration_client),
) -> IntegrationTicketRead:
    organization_id = await resolve_integration_organization_id(db, client)
    ticket = await get_ticket_for_integration(
        db,
        ticket_ref=ticket_ref,
        organization_id=organization_id,
    )
    return ticket_to_integration_read(ticket)


@router.patch(
    "/tickets/{ticket_ref}",
    response_model=IntegrationTicketRead,
    summary="Update ticket from external system",
    description="Limited writable fields for bi-directional sync.",
)
async def integration_patch_ticket(
    ticket_ref: str,
    payload: IntegrationTicketPatch,
    db: AsyncSession = Depends(require_db),
    client: IntegrationClient = Depends(get_integration_client),
) -> IntegrationTicketRead:
    organization_id = await resolve_integration_organization_id(db, client)
    ticket = await get_ticket_for_integration(
        db,
        ticket_ref=ticket_ref,
        organization_id=organization_id,
    )
    return await patch_integration_ticket(db, ticket=ticket, payload=payload)
