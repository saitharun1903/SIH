from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class BuildingBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    location: str = Field("Main Campus", max_length=255)
    floor_count: int = Field(4, ge=1, le=100)


class BuildingCreate(BuildingBase):
    organization_id: Optional[int] = None


class BuildingUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    location: Optional[str] = Field(None, max_length=255)
    floor_count: Optional[int] = Field(None, ge=1, le=100)


class BuildingResponse(BuildingBase):
    id: int
    organization_id: int
    resource_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
