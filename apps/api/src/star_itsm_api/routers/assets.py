import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.core.security import get_current_user, require_admin, require_db, require_staff
from star_itsm_api.models.user import User
from star_itsm_api.schemas.asset import AssetSubsystemRead, AssetSystemRead
from star_itsm_api.schemas.cmdb import (
    CmdbAuditCreate,
    CmdbAuditEntryRead,
    CmdbAuditLogPage,
    CmdbCatalogRead,
    CmdbCatalogWrite,
)
from star_itsm_api.services.cmdb_audit import append_audit_entry, list_audit_log
from star_itsm_api.services.cmdb_catalog import get_catalog, save_catalog

router = APIRouter(prefix="/assets", tags=["assets"])

_MOCK_ASSETS: list[AssetSystemRead] = [
    AssetSystemRead(
        id="sys-star-platform",
        name="STAR Platform",
        code="STAR",
        subsystems=[
            AssetSubsystemRead(id="sub-auth", system_id="sys-star-platform", name="Auth", code="AUTH"),
            AssetSubsystemRead(id="sub-portal", system_id="sys-star-platform", name="Portal", code="PORTAL"),
            AssetSubsystemRead(id="sub-api", system_id="sys-star-platform", name="API", code="API"),
        ],
    ),
    AssetSystemRead(
        id="sys-infrastruktur",
        name="Infrastruktur",
        code="INFRA",
        subsystems=[
            AssetSubsystemRead(id="sub-netvaerk", system_id="sys-infrastruktur", name="Netværk", code="NET"),
            AssetSubsystemRead(id="sub-database", system_id="sys-infrastruktur", name="Database", code="DB"),
            AssetSubsystemRead(id="sub-dns", system_id="sys-infrastruktur", name="DNS", code="DNS"),
        ],
    ),
    AssetSystemRead(
        id="sys-integration",
        name="Integration",
        code="INT",
        subsystems=[
            AssetSubsystemRead(id="sub-teams", system_id="sys-integration", name="Microsoft Teams", code="TEAMS"),
            AssetSubsystemRead(id="sub-slack", system_id="sys-integration", name="Slack", code="SLACK"),
            AssetSubsystemRead(id="sub-email", system_id="sys-integration", name="E-mail gateway", code="MAIL"),
        ],
    ),
    AssetSystemRead(
        id="sys-forretning",
        name="Forretningsapplikationer",
        code="BIZ",
        subsystems=[
            AssetSubsystemRead(id="sub-erp", system_id="sys-forretning", name="ERP", code="ERP"),
            AssetSubsystemRead(id="sub-crm", system_id="sys-forretning", name="CRM", code="CRM"),
            AssetSubsystemRead(id="sub-rapportering", system_id="sys-forretning", name="Rapportering", code="BI"),
            AssetSubsystemRead(id="sub-dokument", system_id="sys-forretning", name="Dokumenthåndtering", code="DOC"),
        ],
    ),
    AssetSystemRead(
        id="sys-sikkerhed",
        name="Sikkerhed",
        code="SEC",
        subsystems=[
            AssetSubsystemRead(id="sub-iam", system_id="sys-sikkerhed", name="IAM", code="IAM"),
            AssetSubsystemRead(id="sub-overvaagning", system_id="sys-sikkerhed", name="Overvågning", code="MON"),
        ],
    ),
    AssetSystemRead(
        id="sys-drift",
        name="Drift & overvågning",
        code="OPS",
        subsystems=[
            AssetSubsystemRead(id="sub-backup", system_id="sys-drift", name="Backup", code="BKP"),
            AssetSubsystemRead(id="sub-logging", system_id="sys-drift", name="Logning", code="LOG"),
            AssetSubsystemRead(id="sub-alerting", system_id="sys-drift", name="Alerting", code="ALRT"),
        ],
    ),
]


@router.get("")
async def list_assets(
    _current_user: User = Depends(get_current_user),
) -> list[AssetSystemRead]:
    """Default CMDB hierarchy (merged with /catalog on the client)."""
    return _MOCK_ASSETS


@router.get("/catalog")
async def read_cmdb_catalog(
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(require_staff()),
) -> CmdbCatalogRead:
    return await get_catalog(db)


@router.put("/catalog")
async def write_cmdb_catalog(
    body: CmdbCatalogWrite,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> CmdbCatalogRead:
    return await save_catalog(db, actor=current_user, body=body)


@router.post("/audit-log", status_code=201)
async def create_cmdb_audit_entry(
    body: CmdbAuditCreate,
    db: AsyncSession = Depends(require_db),
    current_user: User = Depends(require_admin()),
) -> CmdbAuditEntryRead:
    row = await append_audit_entry(db, actor=current_user, payload=body)
    return CmdbAuditEntryRead(
        id=row.id,
        created_at=row.created_at,
        actor_user_id=row.actor_user_id,
        actor_display_name=row.actor_display_name,
        action=row.action,
        entity_type=row.entity_type,
        entity_id=row.entity_id,
        entity_label=row.entity_label,
        changes=row.changes,
        summary_da=row.summary_da,
    )


@router.get("/audit-log")
async def read_cmdb_audit_log(
    before_id: uuid.UUID | None = None,
    byte_budget: int = Query(default=1_048_576, ge=64_000, le=4_194_304),
    q: str | None = Query(default=None, max_length=200),
    db: AsyncSession = Depends(require_db),
    _current_user: User = Depends(require_admin()),
) -> CmdbAuditLogPage:
    try:
        return await list_audit_log(
            db,
            before_id=before_id,
            byte_budget=byte_budget,
            search=q,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Could not load audit log") from exc
