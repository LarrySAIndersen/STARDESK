from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from star_itsm_api.core.password_policy import effective_must_change_password


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class AvatarUpdateRequest(BaseModel):
    avatar_url: str | None = None
    avatar_preset_id: str | None = None


class ChangePasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role: str
    role_label: str
    roles: list[str] = Field(default_factory=list)
    role_labels: list[str] = Field(default_factory=list)
    organization_id: UUID | None = None
    organization_name: str | None = None
    must_change_password: bool = False
    password_policy_exempt: bool = False
    avatar_url: str | None = None
    avatar_preset_id: str | None = None
    ui_mode: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


ROLE_LABELS: dict[str, str] = {
    "end_user": "Slutbruger",
    "agent": "Agent",
    "admin": "Administrator",
    "top_admin": "Topadministrator",
    "supporter": "Supporter",
    "stardesk_reviewer": "Stardesk Reviewer",
    "kundeportal_2": "Kundeportal #2",
}


def user_to_read(
    user,  # noqa: ANN001
    *,
    organization_name: str | None = None,
    roles: list[str] | None = None,
) -> UserRead:
    org_id = getattr(user, "organization_id", None)
    role_values = roles if roles is not None else [user.role]
    role_labels = [ROLE_LABELS.get(r, r) for r in role_values]
    primary = user.role
    return UserRead(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=primary,
        role_label=ROLE_LABELS.get(primary, primary),
        roles=role_values,
        role_labels=role_labels,
        organization_id=org_id,
        organization_name=organization_name,
        must_change_password=effective_must_change_password(user),
        password_policy_exempt=bool(getattr(user, "password_policy_exempt", False)),
        avatar_url=getattr(user, "avatar_url", None),
        avatar_preset_id=getattr(user, "avatar_preset_id", None),
        ui_mode=getattr(user, "ui_mode", None),
    )
