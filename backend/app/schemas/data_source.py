from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class DataSourceBase(BaseModel):
    name: str = Field(..., max_length=255)
    provider: str = Field(..., max_length=100)
    dataset_url: str = Field(..., max_length=500)
    version: str = Field("1.0", max_length=50)
    license: str = Field("Unknown", max_length=100)
    description: Optional[str] = None
    file_name: Optional[str] = None
    row_count: int = Field(0, ge=0)
    schema_hash: Optional[str] = None
    status: str = Field("Registered", max_length=50)
    coverage_start: Optional[datetime] = None
    coverage_end: Optional[datetime] = None


class DataSourceCreate(DataSourceBase):
    pass


class DataSourceUpdate(BaseModel):
    status: Optional[str] = None
    row_count: Optional[int] = None
    downloaded_at: Optional[datetime] = None
    coverage_start: Optional[datetime] = None
    coverage_end: Optional[datetime] = None
    description: Optional[str] = None


class DataSourceResponse(DataSourceBase):
    id: int
    downloaded_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
