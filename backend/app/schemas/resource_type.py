from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ResourceTypeBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    category: str = Field("Space", max_length=100)  # Space, Hardware, Facility
    unit: str = Field("seats", max_length=50)
    description: Optional[str] = None
    config_json: Optional[str] = None


class ResourceTypeCreate(ResourceTypeBase):
    organization_id: Optional[int] = None


class ResourceTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    config_json: Optional[str] = None


class ResourceTypeResponse(ResourceTypeBase):
    id: int
    organization_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
