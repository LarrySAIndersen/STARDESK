from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    role: str
    role_label: str
    organization_id: UUID | None = None
    organization_name: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


ROLE_LABELS: dict[str, str] = {
    "end_user": "Slutbruger",
    "agent": "Agent",
    "admin": "Administrator",
    "top_admin": "Topadministrator",
}


def user_to_read(
    user,  # noqa: ANN001
    *,
    organization_name: str | None = None,
) -> UserRead:
    org_id = getattr(user, "organization_id", None)
    return UserRead(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        role_label=ROLE_LABELS.get(user.role, user.role),
        organization_id=org_id,
        organization_name=organization_name,
    )
