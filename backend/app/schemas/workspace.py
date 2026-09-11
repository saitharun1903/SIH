from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class WorkspaceBase(BaseModel):
    name: str
    code: str
    workspace_type: str = "custom"  # factory, hospital, warehouse, office, education, custom
    description: Optional[str] = None
    location: str = "Main Facility"
    timezone: str = "Asia/Kolkata"
    is_active: bool = True
    is_demo: bool = False
    settings_json: Optional[str] = "{}"


class WorkspaceCreate(WorkspaceBase):
    organization_id: Optional[int] = None
    template_types: Optional[List[str]] = []
    primary_goals: Optional[List[str]] = []


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    workspace_type: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None
    settings_json: Optional[str] = None


class WorkspaceResponse(WorkspaceBase):
    id: int
    organization_id: int
    created_at: datetime
    updated_at: datetime
    resource_count: Optional[int] = 0
    active_issue_count: Optional[int] = 0
    goal_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class WorkspaceTemplate(BaseModel):
    template_id: str
    name: str
    category: str
    description: str
    icon: str
    suggested_resource_types: List[str]
    suggested_metrics: List[str]
    suggested_capabilities: List[str]
    default_goals: List[str]
