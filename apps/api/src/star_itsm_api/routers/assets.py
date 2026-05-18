from fastapi import APIRouter, Depends

from star_itsm_api.core.security import get_current_user
from star_itsm_api.models.user import User
from star_itsm_api.schemas.asset import AssetSubsystemRead, AssetSystemRead

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


@router.get("", response_model=list[AssetSystemRead])
async def list_assets(
    _current_user: User = Depends(get_current_user),
) -> list[AssetSystemRead]:
    """Mock CMDB hierarchy until assets are stored in the database."""
    return _MOCK_ASSETS
