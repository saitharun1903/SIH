from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models import (
    User,
    Dataset,
    ImportJob,
    Resource,
    Schedule,
    OccupancyRecord,
    EnergyUsage,
)
from app.schemas.dataset import DataQualitySummaryResponse, ImportJobResponse
from app.core.config import settings
from app.api.deps import require_viewer

router = APIRouter()


@router.get("/data-quality/summary", response_model=DataQualitySummaryResponse, summary="Get Institutional Data Quality Metrics")
def get_data_quality_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    org_id = current_user.organization_id

    # 1. Dataset & Import Totals
    total_datasets = db.query(func.count(Dataset.id)).filter(Dataset.organization_id == org_id).scalar() or 0

    processed_sum = db.query(func.sum(ImportJob.rows_processed)).join(Dataset).filter(Dataset.organization_id == org_id).scalar() or 0
    imported_sum = db.query(func.sum(ImportJob.rows_imported)).join(Dataset).filter(Dataset.organization_id == org_id).scalar() or 0
    rejected_sum = db.query(func.sum(ImportJob.rows_rejected)).join(Dataset).filter(Dataset.organization_id == org_id).scalar() or 0

    cleanliness_pct = round((imported_sum / processed_sum) * 100.0, 1) if processed_sum > 0 else 100.0

    # 2. Database Record Counts
    total_resources = db.query(func.count(Resource.id)).filter(Resource.organization_id == org_id).scalar() or 0
    total_schedules = db.query(func.count(Schedule.id)).filter(Schedule.organization_id == org_id).scalar() or 0

    # Count occupancy & energy records linked to resources in this org
    total_occ = db.query(func.count(OccupancyRecord.id)).join(Resource).filter(Resource.organization_id == org_id).scalar() or 0
    total_energy = db.query(func.count(EnergyUsage.id)).join(Resource).filter(Resource.organization_id == org_id).scalar() or 0

    # 3. Temporal Coverage
    min_occ = db.query(func.min(OccupancyRecord.timestamp)).join(Resource).filter(Resource.organization_id == org_id).scalar()
    max_occ = db.query(func.max(OccupancyRecord.timestamp)).join(Resource).filter(Resource.organization_id == org_id).scalar()

    min_energy = db.query(func.min(EnergyUsage.timestamp)).join(Resource).filter(Resource.organization_id == org_id).scalar()
    max_energy = db.query(func.max(EnergyUsage.timestamp)).join(Resource).filter(Resource.organization_id == org_id).scalar()

    starts = [dt for dt in [min_occ, min_energy] if dt]
    ends = [dt for dt in [max_occ, max_energy] if dt]

    coverage_start = min(starts) if starts else None
    coverage_end = max(ends) if ends else None

    coverage_days = 0
    if coverage_start and coverage_end:
        coverage_days = max(1, (coverage_end - coverage_start).days)

    # 4. Forecast Readiness Guard
    min_days_required = settings.MINIMUM_FORECAST_DAYS
    is_forecast_ready = coverage_days >= min_days_required and total_occ >= 50
    if is_forecast_ready:
        forecast_message = f"Historical data coverage ({coverage_days} days, {total_occ} points) meets required statistical threshold ({min_days_required} days)."
    else:
        forecast_message = f"Insufficient historical data for reliable forecasting. Current coverage: {coverage_days} days (Required: {min_days_required} days). Import additional historical attendance or energy logs."

    # 5. Recent Import Jobs
    recent_jobs_raw = db.query(ImportJob, Dataset.name.label("dataset_name")).join(
        Dataset, Dataset.id == ImportJob.dataset_id
    ).filter(Dataset.organization_id == org_id).order_by(ImportJob.started_at.desc()).limit(5).all()

    recent_jobs = []
    for job, d_name in recent_jobs_raw:
        j_dict = ImportJobResponse.model_validate(job).model_dump()
        j_dict["dataset_name"] = d_name
        recent_jobs.append(ImportJobResponse(**j_dict))

    return DataQualitySummaryResponse(
        total_datasets=total_datasets,
        total_rows_processed=processed_sum,
        total_rows_imported=imported_sum,
        total_rows_rejected=rejected_sum,
        data_cleanliness_percent=cleanliness_pct,
        total_resources=total_resources,
        total_schedules=total_schedules,
        total_occupancy_records=total_occ,
        total_energy_records=total_energy,
        coverage_start=coverage_start,
        coverage_end=coverage_end,
        coverage_days=coverage_days,
        is_forecast_ready=is_forecast_ready,
        forecast_readiness_message=forecast_message,
        recent_jobs=recent_jobs,
    )
