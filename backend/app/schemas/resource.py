from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class ResourceBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    capacity: int = Field(60, ge=1, le=5000)
    status: str = Field("Active", max_length=50)  # Active, Inactive, Maintenance
    floor: int = Field(1, ge=-2, le=100)
    area: float = Field(750.0, ge=10.0, le=100000.0)
    location: str = Field("Wing A", max_length=255)
    metadata_json: Optional[str] = None


class ResourceCreate(ResourceBase):
    organization_id: Optional[int] = None
    building_id: Optional[int] = None
    resource_type_id: int


class ResourceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    capacity: Optional[int] = Field(None, ge=1, le=5000)
    status: Optional[str] = Field(None, max_length=50)
    floor: Optional[int] = Field(None, ge=-2, le=100)
    area: Optional[float] = Field(None, ge=10.0, le=100000.0)
    location: Optional[str] = Field(None, max_length=255)
    building_id: Optional[int] = None
    resource_type_id: Optional[int] = None
    metadata_json: Optional[str] = None


class ResourceResponse(ResourceBase):
    id: int
    organization_id: int
    building_id: Optional[int] = None
    resource_type_id: int
    building_name: Optional[str] = None
    building_code: Optional[str] = None
    resource_type_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
