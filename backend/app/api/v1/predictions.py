"""
NEXUS - Forecasting API Endpoints
Phase 6 Demand & Utilization Forecasting Engine (SIH26202)
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User
from app.api.deps import require_viewer, require_analyst
from app.schemas.prediction import (
    ForecastResponse,
    ForecastRequest,
    ForecastOverviewResponse,
)
from app.services.prediction_service import (
    generate_forecast,
    get_forecast_overview,
)

router = APIRouter()


@router.get(
    "/predictions/overview",
    response_model=ForecastOverviewResponse,
    summary="Get Institutional Demand Forecasting Overview & Data Sufficiency Status",
)
def overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Provides high-level projected demand, campus energy cost, and historical data sufficiency."""
    return get_forecast_overview(db=db, org_id=current_user.organization_id)


@router.post(
    "/predictions/forecast",
    response_model=ForecastResponse,
    summary="Generate Demand, Occupancy, or Energy Forecast with P10/P50/P90 Uncertainty Bounds",
)
def create_forecast(
    request: ForecastRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """
    Executes Quantile Gradient Boosted Trees model over historical telemetry,
    incorporates timetable schedule expectations, and predicts future demand
    with statistical P10 (lower bound) and P90 (upper bound) confidence intervals.
    """
    return generate_forecast(
        db=db,
        org_id=current_user.organization_id,
        resource_id=request.resource_id,
        building_id=request.building_id,
        metric_name=request.metric_name,
        horizon=request.horizon,
    )


@router.get(
    "/predictions",
    response_model=ForecastResponse,
    summary="Query Forecast by Parameters (GET)",
)
def get_forecast_by_query(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
    resource_id: Optional[int] = Query(None, description="Target room ID"),
    building_id: Optional[int] = Query(None, description="Target building ID"),
    metric_name: str = Query("utilization", description="utilization, occupancy, or energy"),
    horizon: str = Query("7d", description="1d, 7d, or 30d"),
):
    """Convenience GET endpoint for query-string forecasting."""
    return generate_forecast(
        db=db,
        org_id=current_user.organization_id,
        resource_id=resource_id,
        building_id=building_id,
        metric_name=metric_name,
        horizon=horizon,
    )
