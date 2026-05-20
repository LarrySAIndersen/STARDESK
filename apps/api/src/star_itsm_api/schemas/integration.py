import uuid

from pydantic import BaseModel


class IntegrationScopeRead(BaseModel):
    organization_id: uuid.UUID
    organization_name: str
