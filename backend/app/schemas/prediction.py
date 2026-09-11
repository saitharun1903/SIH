from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class PredictionPoint(BaseModel):
    target_timestamp: datetime
    predicted_value: float  # P50 (median)
    lower_bound: float      # P10 (80% CI lower)
    upper_bound: float      # P90 (80% CI upper)


class HistoricalPoint(BaseModel):
    timestamp: datetime
    actual_value: float


class ModelMetrics(BaseModel):
    mape: float
    rmse: float
    mae: float
    r2: float
    samples_trained: int
    data_coverage_days: float
    model_name: str = "HistGradientBoosting-Quantile (v1.0)"


class ForecastResponse(BaseModel):
    resource_id: Optional[int] = None
    resource_name: Optional[str] = "Institutional Campus Average"
    resource_code: Optional[str] = "ALL"
    building_name: Optional[str] = "All Campus Blocks"
    metric_name: str = "utilization"  # utilization, occupancy, energy
    horizon: str = "7d"               # 1d, 7d, 30d
    generated_at: datetime
    metrics: ModelMetrics
    historical: List[HistoricalPoint]
    forecast: List[PredictionPoint]

    model_config = ConfigDict(from_attributes=True)


class ForecastRequest(BaseModel):
    resource_id: Optional[int] = None
    building_id: Optional[int] = None
    metric_name: str = Field("utilization", description="utilization, occupancy, or energy")
    horizon: str = Field("7d", description="1d, 7d, or 30d")


class ForecastOverviewResponse(BaseModel):
    total_spaces_forecasted: int
    avg_forecasted_utilization: float
    peak_forecasted_utilization: float
    projected_energy_kwh: float
    projected_energy_cost: float
    high_demand_spaces_count: int
    data_sufficiency_status: str
    historical_days_available: float
