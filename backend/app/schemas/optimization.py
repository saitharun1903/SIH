from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class OptimizationWeights(BaseModel):
    energy_weight: float = Field(0.40, ge=0.0, le=1.0, description="Weight for consolidating spaces to save energy")
    utilization_weight: float = Field(0.35, ge=0.0, le=1.0, description="Weight for maximizing seat fill rate")
    stability_weight: float = Field(0.25, ge=0.0, le=1.0, description="Weight for minimizing reassignment disruption")


class OptimizationRequest(BaseModel):
    building_id: Optional[int] = None
    day_of_week: Optional[str] = None
    excluded_days: Optional[List[str]] = None
    deactivated_resource_ids: Optional[List[int]] = None
    enrollment_multiplier: float = Field(1.0, ge=0.5, le=2.5)
    weights: OptimizationWeights = Field(default_factory=OptimizationWeights)
    max_solve_seconds: int = Field(5, ge=1, le=30)


class ReallocatedEvent(BaseModel):
    schedule_id: int
    subject_name: str
    department: str
    day_of_week: str
    time_slot: str
    expected_occupancy: int
    original_resource_id: int
    original_resource_name: str
    original_capacity: int
    optimized_resource_id: int
    optimized_resource_name: str
    optimized_capacity: int
    was_moved: bool
    reason: str


class OptimizationMetrics(BaseModel):
    total_events: int
    displaced_events_count: int
    active_rooms_before: int
    active_rooms_after: int
    rooms_freed_count: int
    avg_utilization_before: float
    avg_utilization_after: float
    weekly_energy_kwh_before: float
    weekly_energy_kwh_after: float
    weekly_energy_savings_kwh: float
    weekly_cost_savings_inr: float


class OptimizationResponse(BaseModel):
    solver_status: str  # OPTIMAL, FEASIBLE, INFEASIBLE
    feasibility: str    # FEASIBLE, NOT FEASIBLE
    solve_duration_ms: float
    objective_score: float
    metrics: OptimizationMetrics
    reallocations: List[ReallocatedEvent]
    violations: List[str]
    algorithmic_decisions: List[str]


# Scenario Schemas for Simulator
class ScenarioChangeCreate(BaseModel):
    change_type: str  # deactivate_resource, deactivate_building, change_enrollment, shift_schedule
    target_resource_id: Optional[int] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)


class ScenarioCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    base_period: str = "Fall 2026"
    changes: List[ScenarioChangeCreate] = Field(default_factory=list)


class ScenarioChangeResponse(BaseModel):
    id: int
    change_type: str
    target_resource_id: Optional[int] = None
    parameters: Dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScenarioResultResponse(BaseModel):
    id: int
    status: str
    feasibility: str
    objective_score: float
    before_metrics: Dict[str, Any]
    after_metrics: Dict[str, Any]
    delta_metrics: Dict[str, Any]
    reallocations: List[ReallocatedEvent]
    violations: List[str]
    recommendations: List[str]
    created_at: datetime


class ScenarioResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    description: Optional[str] = None
    base_period: str
    status: str
    created_by: int
    created_at: datetime
    changes: List[ScenarioChangeResponse] = Field(default_factory=list)
    results: List[ScenarioResultResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ScenarioTemplate(BaseModel):
    template_id: str
    title: str
    description: str
    category: str
    icon: str
    default_changes: List[ScenarioChangeCreate]
