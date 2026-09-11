from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ScheduleBase(BaseModel):
    subject_name: str = Field(..., min_length=2, max_length=255)
    department: str = Field("Computer Science", max_length=100)
    day_of_week: str = Field(..., max_length=20)  # Monday, Tuesday, etc.
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")  # HH:MM format e.g. "09:00"
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")    # HH:MM format e.g. "10:00"
    expected_occupancy: int = Field(50, ge=1, le=5000)
    actual_occupancy: Optional[int] = Field(None, ge=0, le=5000)
    equipment_requirements: Optional[str] = None  # JSON or comma-separated


class ScheduleCreate(ScheduleBase):
    resource_id: int
    organization_id: Optional[int] = None


class ScheduleUpdate(BaseModel):
    resource_id: Optional[int] = None
    subject_name: Optional[str] = Field(None, min_length=2, max_length=255)
    department: Optional[str] = Field(None, max_length=100)
    day_of_week: Optional[str] = Field(None, max_length=20)
    start_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    end_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    expected_occupancy: Optional[int] = Field(None, ge=1, le=5000)
    actual_occupancy: Optional[int] = Field(None, ge=0, le=5000)
    equipment_requirements: Optional[str] = None


class ScheduleResponse(ScheduleBase):
    id: int
    organization_id: int
    resource_id: int
    resource_name: Optional[str] = None
    resource_code: Optional[str] = None
    building_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
