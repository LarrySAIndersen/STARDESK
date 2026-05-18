from pydantic import BaseModel


class AssetSubsystemRead(BaseModel):
    id: str
    system_id: str
    name: str
    code: str


class AssetSystemRead(BaseModel):
    id: str
    name: str
    code: str
    subsystems: list[AssetSubsystemRead]
