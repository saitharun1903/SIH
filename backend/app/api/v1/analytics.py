from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import User
from app.api.deps import require_viewer, require_analyst
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    UtilizationTrendPoint,
    EnergyTrendPoint,
    ResourceUtilizationRank,
    BuildingAnalytics,
    PeakDemandPoint,
)
from app.services.analytics_service import (
    get_analytics_summary,
    get_utilization_trends,
    get_energy_trends,
    get_resource_rankings,
    get_building_comparison,
    get_peak_demand,
)

router = APIRouter()


@router.get("/analytics/summary", response_model=AnalyticsSummaryResponse, summary="Get Institutional Utilization & Efficiency KPIs")
def summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
    building_id: Optional[int] = Query(None, description="Filter by building ID"),
    resource_type_id: Optional[int] = Query(None, description="Filter by resource type ID"),
    resource_id: Optional[int] = Query(None, description="Filter by specific resource ID"),
    start_date: Optional[datetime] = Query(None, description="Start date ISO"),
    end_date: Optional[datetime] = Query(None, description="End date ISO"),
):
    """Returns database-computed analytics metrics: overall utilization, underutilized/overloaded counts,
    energy per occupied hour, and total billed cost."""
    return get_analytics_summary(
        db=db,
        org_id=current_user.organization_id,
        building_id=building_id,
        resource_type_id=resource_type_id,
        resource_id=resource_id,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/analytics/utilization-trends", response_model=List[UtilizationTrendPoint], summary="Time-Series Utilization Trends")
def utilization_trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
    building_id: Optional[int] = Query(None),
    resource_type_id: Optional[int] = Query(None),
    resource_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
):
    return get_utilization_trends(
        db=db,
        org_id=current_user.organization_id,
        building_id=building_id,
        resource_type_id=resource_type_id,
        resource_id=resource_id,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/analytics/energy-trends", response_model=List[EnergyTrendPoint], summary="Time-Series Energy Trends")
def energy_trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
    building_id: Optional[int] = Query(None),
    resource_type_id: Optional[int] = Query(None),
    resource_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
):
    return get_energy_trends(
        db=db,
        org_id=current_user.organization_id,
        building_id=building_id,
        resource_type_id=resource_type_id,
        resource_id=resource_id,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/analytics/resource-rankings", response_model=List[ResourceUtilizationRank], summary="Resource Utilization Rankings")
def resource_rankings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
    category: Optional[str] = Query(None, description="Filter: underutilized, overloaded, optimal"),
    building_id: Optional[int] = Query(None),
    resource_type_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    return get_resource_rankings(
        db=db,
        org_id=current_user.organization_id,
        category_filter=category,
        building_id=building_id,
        resource_type_id=resource_type_id,
        limit=limit,
    )


@router.get("/analytics/building-comparison", response_model=List[BuildingAnalytics], summary="Campus Block Comparison")
def building_comparison(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    return get_building_comparison(db=db, org_id=current_user.organization_id)


@router.get("/analytics/peak-demand", response_model=List[PeakDemandPoint], summary="Campus Peak Demand Distribution")
def peak_demand(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    return get_peak_demand(db=db, org_id=current_user.organization_id)


@router.get("/analytics/macro-grid-trends", summary="PJM Regional Macro Grid Demand & Weather Covariates")
def macro_grid_trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Returns 24-hour diurnal regional grid load profile, outdoor temperature covariates,
    cooling degree days, and peak grid demand hours from the PJM Hourly Energy dataset."""
    from app.services.macro_energy_service import get_macro_grid_trends
    return get_macro_grid_trends(db=db)


@router.get("/analytics/multi-source-intelligence", summary="Multi-Source Hybrid Intelligence & Co-Optimization Profile")
def multi_source_intelligence(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
    threshold: float = Query(0.50, ge=0.0, le=1.0, description="CSSI collision detection threshold"),
):
    """
    Fuses Academic Timetable Density, Building Physics, Metered Micro-Energy,
    and Macro-Grid PJM Telemetry. Returns empirical correlation matrix, 24-hour diurnal
    multi-layer curves, and high-stress timetable collisions with swap candidates.
    """
    from datetime import timezone
    from app.services.multi_source_intelligence_service import (
        check_multi_source_data_availability,
        get_multi_source_cross_correlation,
        get_diurnal_multi_layer_profile,
        detect_timetable_stress_collisions,
    )
    availability = check_multi_source_data_availability(db)
    correlation = get_multi_source_cross_correlation(db)
    diurnal_profile = get_diurnal_multi_layer_profile(db)
    collisions = detect_timetable_stress_collisions(db, threshold=threshold)

    return {
        "data_availability": availability,
        "cross_source_correlation": correlation,
        "diurnal_multi_layer_profile": diurnal_profile,
        "timetable_stress_collisions": collisions,
        "metadata": {
            "calculation_timestamp": datetime.now(timezone.utc).isoformat(),
            "algorithm": "Cross-Source Stress Index (CSSI) & Bivariate Pearson Correlation",
            "weights": {"grid_stress": 0.35, "thermal_stress": 0.35, "spatial_mismatch": 0.30},
            "data_sources": [
                "SQLite.schedules",
                "SQLite.resources",
                "SQLite.buildings",
                "SQLite.energy_usage",
                "SQLite.occupancy_records",
                "Kaggle.PJM_Hourly",
                "Kaggle.NOAA_Weather",
            ],
        },
    }


@router.post("/analytics/multi-source/dispatch", summary="Dispatch Load-Shifting Recommendations to Action Center")
def dispatch_recommendations(
    payload: Optional[dict] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """
    Commits high-stress timetable load-shifting opportunities into the
    action center recommendations table for administrative review and optimization.
    """
    from app.services.multi_source_intelligence_service import dispatch_multi_source_recommendations
    collision_ids = payload.get("collision_ids") if payload else None
    return dispatch_multi_source_recommendations(db, collision_ids=collision_ids)

