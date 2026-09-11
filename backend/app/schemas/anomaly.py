from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class ContributingFactor(BaseModel):
    factor: str
    impact: str  # Critical, High, Medium, Low
    detail: str


class AnomalyBase(BaseModel):
    resource_id: int
    metric_type: str  # energy, utilization, occupancy
    anomaly_type: str = "multivariate_anomaly"
    timestamp: datetime
    expected_value: float
    actual_value: float
    deviation_percent: float
    severity: str = "Medium"  # Low, Medium, High, Critical
    reason: str
    contributing_factors: Optional[List[ContributingFactor]] = None
    status: str = "Active"  # Active, Acknowledged, Resolved, Dismissed


class AnomalyCreate(AnomalyBase):
    organization_id: int


class AnomalyStatusUpdate(BaseModel):
    status: str = Field(..., description="Active, Acknowledged, Resolved, Dismissed")
    resolution_notes: Optional[str] = None


class AnomalyResponse(AnomalyBase):
    id: int
    organization_id: int
    resource_name: Optional[str] = None
    resource_code: Optional[str] = None
    building_name: Optional[str] = None
    resolved_by: Optional[int] = None
    resolution_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AnomalyDetectionTriggerRequest(BaseModel):
    resource_id: Optional[int] = None
    building_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    contamination: Optional[float] = Field(0.05, ge=0.01, le=0.25)


class AnomalySummaryResponse(BaseModel):
    total_anomalies: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    active_count: int
    acknowledged_count: int
    resolved_count: int
    dismissed_count: int
    by_type: Dict[str, int]
    estimated_wasted_kwh: float
    estimated_financial_loss: float
