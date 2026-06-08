from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from star_itsm_api.core.security import (
    ROLE_ADMIN,
    ROLE_AGENT,
    ROLE_KUNDEPORTAL_2,
    ROLE_STARDESK_REVIEWER,
    ROLE_SUBMITTER,
    ROLE_SUPPORTER,
    USER_ROLE_PATTERN,
)
from star_itsm_api.schemas.auth import ROLE_LABELS
from star_itsm_api.schemas.ticket import TicketRead

ASSIGNABLE_ROLES = (
    ROLE_SUBMITTER,
    ROLE_AGENT,
    ROLE_ADMIN,
    ROLE_SUPPORTER,
    ROLE_STARDESK_REVIEWER,
    ROLE_KUNDEPORTAL_2,
)


class UserTeamSummary(BaseModel):
    id: UUID
    name: str


class UserTicketsGroupedRead(BaseModel):
    """Tickets linked to a user by reporter, assignee, or stakeholder role."""

    reported: list[TicketRead] = Field(default_factory=list)
    assigned: list[TicketRead] = Field(default_factory=list)
    affected: list[TicketRead] = Field(default_factory=list)
    interested: list[TicketRead] = Field(default_factory=list)
    mentioned: list[TicketRead] = Field(default_factory=list)


class UserAdminRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role: str
    role_label: str
    roles: list[str] = Field(default_factory=list)
    role_labels: list[str] = Field(default_factory=list)
    is_active: bool
    password_policy_exempt: bool = False
    organization_id: UUID | None = None
    organization_name: str | None = None
    teams: list[UserTeamSummary] = Field(default_factory=list)
    created_at: datetime | None = None


class UserAdminListItem(BaseModel):
    id: UUID
    email: str
    display_name: str
    role: str
    role_label: str
    roles: list[str] = Field(default_factory=list)
    role_labels: list[str] = Field(default_factory=list)
    is_active: bool
    organization_name: str | None = None
    team_ids: list[UUID] = Field(default_factory=list)
    team_names: list[str] = Field(default_factory=list)


class UserAdminListResponse(BaseModel):
    items: list[UserAdminListItem]
    total: int
    page: int
    page_size: int


class UserAdminUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: str | None = Field(default=None, min_length=3, max_length=255)
    role: str | None = Field(default=None, pattern=USER_ROLE_PATTERN)
    roles: list[str] | None = Field(default=None, min_length=1)
    is_active: bool | None = None
    password_policy_exempt: bool | None = None
    organization_id: UUID | None = None
    team_ids: list[UUID] | None = None


class UserAdminPasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class UserAdminCreate(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    display_name: str = Field(min_length=1, max_length=255)
    role: str | None = Field(default=None, pattern=USER_ROLE_PATTERN)
    roles: list[str] | None = Field(default=None, min_length=1)
    is_active: bool = True
    organization_id: UUID | None = None
    team_ids: list[UUID] = Field(default_factory=list)
    initial_password: str | None = Field(default=None, min_length=8, max_length=128)
    clone_from_user_id: UUID | None = None


class UserAdminCreated(BaseModel):
    user: UserAdminRead
    temporary_password: str | None = None


class OrganizationOption(BaseModel):
    id: UUID
    name: str


class RoleOption(BaseModel):
    value: str
    label: str


class UserAdminMeta(BaseModel):
    roles: list[RoleOption]
    organizations: list[OrganizationOption]


class UserImportRow(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    display_name: str = Field(min_length=1, max_length=255)
    role: str | None = None
    is_active: str | bool | None = None
    teams: str | None = Field(
        default=None,
        description="Comma- or semicolon-separated team names",
    )
    organization: str | None = Field(
        default=None,
        description="Organization name (must match an active org)",
    )


class UserImportRequest(BaseModel):
    rows: list[UserImportRow] = Field(min_length=1, max_length=500)
    default_role: str = Field(default=ROLE_SUBMITTER, pattern=USER_ROLE_PATTERN)
    on_duplicate: str = Field(default="skip", pattern="^(skip|update)$")


class UserImportRowError(BaseModel):
    row: int
    email: str | None = None
    message: str


class UserImportResult(BaseModel):
    total: int
    created: int
    updated: int
    skipped: int
    failed: int
    errors: list[UserImportRowError] = Field(default_factory=list)


def user_to_admin_read(
    user,
    *,
    organization_name: str | None,
    teams: list[UserTeamSummary],
    roles: list[str] | None = None,
) -> UserAdminRead:
    role_values = roles if roles is not None else [user.role]
    role_labels = [ROLE_LABELS.get(r, r) for r in role_values]
    primary = user.role
    return UserAdminRead(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=primary,
        role_label=ROLE_LABELS.get(primary, primary),
        roles=role_values,
        role_labels=role_labels,
        is_active=user.is_active,
        password_policy_exempt=bool(getattr(user, "password_policy_exempt", False)),
        organization_id=getattr(user, "organization_id", None),
        organization_name=organization_name,
        teams=teams,
        created_at=getattr(user, "created_at", None),
    )
