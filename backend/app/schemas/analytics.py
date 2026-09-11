from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class AnalyticsSummaryResponse(BaseModel):
    overall_utilization_percent: float
    total_energy_kwh: float
    total_energy_cost: float
    average_daily_energy_kwh: float
    energy_per_occupied_hour: float
    energy_per_student: float
    total_spaces_analyzed: int
    underutilized_count: int
    overloaded_count: int
    optimal_count: int
    underutilized_threshold: float
    overloaded_threshold: float
    total_scheduled_hours: Optional[int] = 0
    total_capacity_seats: Optional[int] = 0
    date_range_start: Optional[datetime] = None
    date_range_end: Optional[datetime] = None


class UtilizationTrendPoint(BaseModel):
    timestamp: str
    avg_utilization: float
    peak_utilization: float
    avg_occupancy: float
    total_capacity: int


class EnergyTrendPoint(BaseModel):
    timestamp: str
    consumption_kwh: float
    cost: float
    occupied_spaces_count: int


class ResourceUtilizationRank(BaseModel):
    resource_id: int
    resource_code: str
    resource_name: str
    building_name: str
    resource_type_name: str
    capacity: int
    avg_utilization: float
    peak_utilization: float
    status_category: str  # Underutilized, Optimal, Overloaded
    total_occupied_hours: float
    total_energy_kwh: float
    total_cost: float


class BuildingAnalytics(BaseModel):
    building_id: int
    building_code: str
    building_name: str
    avg_utilization: float
    total_energy_kwh: float
    total_cost: float
    resource_count: int


class PeakDemandPoint(BaseModel):
    day_of_week: str
    time_slot: str
    avg_occupancy: float
    utilization_percent: float
    classes_count: int
