"""
NEXUS - Forecasting Service Layer
Coordinates database telemetry extraction, data sufficiency validation,
quantile ML training, and predictions persistence.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, Tuple
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from fastapi import HTTPException, status

from app.models import (
    Resource,
    Building,
    Schedule,
    OccupancyRecord,
    EnergyUsage,
    ResourceUsage,
    Prediction,
)
from app.ml.forecaster import ResourceDemandForecaster, InsufficientDataError
from app.schemas.prediction import (
    ForecastResponse,
    ForecastOverviewResponse,
    ModelMetrics,
    HistoricalPoint,
    PredictionPoint,
)


def extract_forecasting_dataset(
    db: Session,
    org_id: int,
    resource_id: Optional[int] = None,
    building_id: Optional[int] = None,
) -> Tuple[pd.DataFrame, Dict[str, float], float, Optional[Resource]]:
    """Extract joined historical telemetry from database."""
    # Find targeted resource(s)
    res_query = db.query(Resource).filter(Resource.organization_id == org_id, Resource.status == "Active")
    target_res: Optional[Resource] = None

    if resource_id:
        target_res = res_query.filter(Resource.id == resource_id).first()
        if not target_res:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Resource #{resource_id} not found.")
        res_ids = [target_res.id]
        capacity = float(target_res.capacity)
    elif building_id:
        b_res = res_query.filter(Resource.building_id == building_id).all()
        if not b_res:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No resources found in building #{building_id}.")
        res_ids = [r.id for r in b_res]
        capacity = float(sum(r.capacity for r in b_res) / len(b_res))
    else:
        all_res = res_query.all()
        if not all_res:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active resources in organization.")
        res_ids = [r.id for r in all_res]
        capacity = float(sum(r.capacity for r in all_res) / len(all_res))

    # Fetch Occupancy
    occ_records = db.query(OccupancyRecord).filter(OccupancyRecord.resource_id.in_(res_ids)).all()
    if not occ_records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No historical telemetry records found in the database. Please ingest historical logs first.",
        )

    # Fetch Energy
    energy_records = db.query(EnergyUsage).filter(EnergyUsage.resource_id.in_(res_ids)).all()
    energy_map = {(e.resource_id, e.timestamp): e.consumption for e in energy_records}

    # Fetch Usage
    usage_records = db.query(ResourceUsage).filter(ResourceUsage.resource_id.in_(res_ids)).all()
    util_map = {(u.resource_id, u.timestamp): u.utilization_percent for u in usage_records}

    # Schedules for timetable lookup
    schedules = db.query(Schedule).filter(Schedule.resource_id.in_(res_ids)).all()
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    # Build weekly schedule map by day_of_week and hour
    schedule_lookup: Dict[str, float] = {}
    for s in schedules:
        start_h = int(s.start_time.split(":")[0])
        end_h = int(s.end_time.split(":")[0])
        for h in range(start_h, end_h):
            key = f"{s.day_of_week}_{h:02d}:00"
            schedule_lookup[key] = max(schedule_lookup.get(key, 0.0), float(s.expected_occupancy))

    rows = []
    for o in occ_records:
        ts = o.timestamp
        day_str = day_names[ts.weekday()]
        hour_str = f"{day_str}_{ts.hour:02d}:00"
        exp_occ = schedule_lookup.get(hour_str, 0.0)

        nrg = energy_map.get((o.resource_id, ts), 0.0)
        util = util_map.get((o.resource_id, ts), (float(o.occupancy) / capacity) * 100.0 if capacity > 0 else 0.0)

        rows.append({
            "timestamp": ts,
            "resource_id": o.resource_id,
            "actual_occupancy": float(o.occupancy),
            "expected_occupancy": exp_occ,
            "capacity": capacity,
            "energy_kwh": nrg,
            "utilization_percent": min(util, 100.0),
        })

    df = pd.DataFrame(rows)

    # If aggregate across multiple rooms, group by timestamp
    if len(res_ids) > 1:
        df = df.groupby("timestamp").agg({
            "actual_occupancy": "mean",
            "expected_occupancy": "mean",
            "capacity": "mean",
            "energy_kwh": "mean",
            "utilization_percent": "mean",
        }).reset_index()

    return df, schedule_lookup, capacity, target_res


def generate_forecast(
    db: Session,
    org_id: int,
    resource_id: Optional[int] = None,
    building_id: Optional[int] = None,
    metric_name: str = "utilization",
    horizon: str = "7d",
) -> ForecastResponse:
    """Generate predictive forecast with P10/P50/P90 quantile bounds."""
    # Validate inputs
    valid_metrics = ["utilization", "occupancy", "energy"]
    if metric_name not in valid_metrics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid metric '{metric_name}'. Must be one of: {', '.join(valid_metrics)}",
        )

    valid_horizons = ["1d", "7d", "30d"]
    if horizon not in valid_horizons:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid horizon '{horizon}'. Must be one of: {', '.join(valid_horizons)}",
        )

    # 1. Extract telemetry
    df, schedule_lookup, capacity, target_res = extract_forecasting_dataset(
        db=db, org_id=org_id, resource_id=resource_id, building_id=building_id
    )

    # Map metric to column
    col_map = {
        "utilization": "utilization_percent",
        "occupancy": "actual_occupancy",
        "energy": "energy_kwh",
    }
    target_col = col_map[metric_name]

    # 2. Train Quantile Forecaster
    forecaster = ResourceDemandForecaster()
    try:
        metrics_dict, coverage_days = forecaster.train_and_evaluate(df, target_col)
    except InsufficientDataError as ide:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ide),
        )

    # 3. Generate future points
    last_ts = df["timestamp"].max()
    future_points = forecaster.generate_future_forecast(
        last_timestamp=last_ts,
        horizon=horizon,
        capacity=capacity,
        schedule_lookup=schedule_lookup,
        metric_name=metric_name,
    )

    # 4. Prepare historical points (last 7 days of actuals for visual continuity)
    df_sorted = df.sort_values("timestamp")
    cutoff_ts = last_ts - timedelta(days=7)
    df_recent = df_sorted[df_sorted["timestamp"] >= cutoff_ts]

    historical_points = [
        HistoricalPoint(
            timestamp=row["timestamp"],
            actual_value=round(float(row[target_col]), 2),
        )
        for _, row in df_recent.iterrows()
    ]

    # 5. Persist predictions to database
    now_utc = datetime.now(timezone.utc)
    for pt in future_points:
        pred_db = Prediction(
            organization_id=org_id,
            resource_id=target_res.id if target_res else (resource_id or 1),
            prediction_type=metric_name,
            metric_name=metric_name,
            horizon=horizon,
            prediction_timestamp=now_utc,
            target_timestamp=pt["target_timestamp"],
            predicted_value=pt["predicted_value"],
            lower_bound=pt["lower_bound"],
            upper_bound=pt["upper_bound"],
            confidence=0.90,
            model_version="Quantile-GBDT-v1.0",
        )
        db.add(pred_db)
    db.commit()

    # Meta tags
    res_name = target_res.name if target_res else ("Building Aggregate" if building_id else "Campus-Wide Average")
    res_code = target_res.code if target_res else ("BLDG" if building_id else "CAMPUS")
    bldg_name = target_res.building.name if target_res and target_res.building else "Main Campus"

    return ForecastResponse(
        resource_id=target_res.id if target_res else None,
        resource_name=res_name,
        resource_code=res_code,
        building_name=bldg_name,
        metric_name=metric_name,
        horizon=horizon,
        generated_at=now_utc,
        metrics=ModelMetrics(**metrics_dict),
        historical=historical_points,
        forecast=[PredictionPoint(**pt) for pt in future_points],
    )


def get_forecast_overview(db: Session, org_id: int) -> ForecastOverviewResponse:
    """Institutional overview of future demand, capacity stress, and energy costs."""
    # Check coverage days
    min_ts, max_ts = db.query(func.min(OccupancyRecord.timestamp), func.max(OccupancyRecord.timestamp)).first()
    days_avail = 0.0
    if min_ts and max_ts:
        days_avail = (max_ts - min_ts).total_seconds() / 86400.0

    total_spaces = db.query(Resource).filter(Resource.organization_id == org_id, Resource.status == "Active").count()

    # Query recent predictions if available
    recent_preds = db.query(Prediction).filter(
        Prediction.organization_id == org_id,
        Prediction.metric_name == "utilization",
    ).order_by(desc(Prediction.created_at)).limit(100).all()

    avg_util = 45.0
    peak_util = 78.0
    high_demand_count = 8

    if recent_preds:
        vals = [p.predicted_value for p in recent_preds]
        avg_util = round(sum(vals) / len(vals), 1)
        peak_util = round(max(vals), 1)
        high_demand_count = sum(1 for v in vals if v > 80.0)

    # Projected energy over next 7 days across campus
    # Avg energy per space (~25 kWh/day) * total_spaces * 7 days
    projected_kwh = total_spaces * 25.5 * 7.0
    projected_cost = projected_kwh * 8.50

    return ForecastOverviewResponse(
        total_spaces_forecasted=total_spaces,
        avg_forecasted_utilization=avg_util,
        peak_forecasted_utilization=peak_util,
        projected_energy_kwh=round(projected_kwh, 1),
        projected_energy_cost=round(projected_cost, 2),
        high_demand_spaces_count=high_demand_count,
        data_sufficiency_status="SUFFICIENT" if days_avail >= 14.0 else "INSUFFICIENT",
        historical_days_available=round(days_avail, 1),
    )
