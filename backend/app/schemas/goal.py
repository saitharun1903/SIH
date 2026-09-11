from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class GoalBase(BaseModel):
    title: str
    goal_type: str  # reduce_cost, improve_utilization, increase_capacity, reduce_downtime, avoid_shortage, custom
    target_value: float
    unit: str = "%"
    baseline_value: Optional[float] = None
    current_value: Optional[float] = None
    timeframe: str = "Q4 2026"
    status: str = "In Progress"
    priority: str = "High"
    description: Optional[str] = None


class GoalCreate(GoalBase):
    workspace_id: Optional[int] = None
    organization_id: Optional[int] = None


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    goal_type: Optional[str] = None
    target_value: Optional[float] = None
    unit: Optional[str] = None
    current_value: Optional[float] = None
    timeframe: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    description: Optional[str] = None


class GoalResponse(GoalBase):
    id: int
    organization_id: int
    workspace_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
