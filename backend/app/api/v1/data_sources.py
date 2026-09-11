"""
NEXUS - Data Source Registry API Endpoints
Phase 1 Foundation & Kaggle Ingestion Registry
Smart India Hackathon 2026 (SIH26202)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User, DataSource
from app.api.deps import require_viewer, require_admin
from app.schemas.data_source import (
    DataSourceCreate,
    DataSourceUpdate,
    DataSourceResponse,
)

router = APIRouter()


@router.get(
    "/data-sources",
    response_model=List[DataSourceResponse],
    summary="List Registered Analytical Data Sources",
)
def list_data_sources(
    provider: Optional[str] = Query(None, description="Filter by provider (e.g. Kaggle, Institutional Upload)"),
    status: Optional[str] = Query(None, description="Filter by status (e.g. Imported, Registered, Pending)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """
    Returns registered analytical data sources detailing provenance, row counts,
    date coverage, licensing, and import status.
    """
    query = db.query(DataSource)
    if provider:
        query = query.filter(DataSource.provider == provider)
    if status:
        query = query.filter(DataSource.status == status)
    return query.order_by(DataSource.id.asc()).all()


@router.get(
    "/data-sources/profiling-report",
    summary="Get Data Profiling Report for Ingested Datasets",
)
def get_profiling_report_endpoint(
    current_user: User = Depends(require_viewer),
):
    """Returns the analytical data profiling report for ingested datasets."""
    from app.services.kaggle_ingestion_service import get_profiling_report
    report = get_profiling_report()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Data profiling report not found. Please trigger dataset ingestion first.",
        )
    return report


@router.get(
    "/data-sources/{source_id}",
    response_model=DataSourceResponse,
    summary="Get Data Source by ID",
)
def get_data_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Data source #{source_id} not found.",
        )
    return source


@router.post(
    "/data-sources",
    response_model=DataSourceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a New Analytical Data Source",
)
def create_data_source(
    payload: DataSourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = db.query(DataSource).filter(DataSource.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Data source with name '{payload.name}' already registered.",
        )

    source = DataSource(
        name=payload.name,
        provider=payload.provider,
        dataset_url=payload.dataset_url,
        version=payload.version,
        license=payload.license,
        description=payload.description,
        file_name=payload.file_name,
        row_count=payload.row_count,
        schema_hash=payload.schema_hash,
        status=payload.status,
        coverage_start=payload.coverage_start,
        coverage_end=payload.coverage_end,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@router.patch(
    "/data-sources/{source_id}",
    response_model=DataSourceResponse,
    summary="Update Data Source Metadata / Status",
)
def update_data_source(
    source_id: int,
    payload: DataSourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Data source #{source_id} not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(source, field, value)

    db.commit()
    db.refresh(source)
    return source


@router.post(
    "/data-sources/ingest-ashrae",
    summary="Download, Profile, Normalize and Ingest Real ASHRAE Dataset",
)
def ingest_ashrae_endpoint(
    limit_buildings: int = Query(10, ge=1, le=50, description="Number of educational facilities to ingest"),
    days_limit: int = Query(60, ge=7, le=365, description="Number of days of telemetry"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Triggers the reproducible Kaggle ASHRAE pipeline:
    1. Downloads authentic ASHRAE Great Energy Predictor III parquet archive.
    2. Runs comprehensive data profiling and outlier analysis.
    3. Normalizes units to standard kWh and syncs educational buildings.
    4. Persists records to database and updates DataSource registry.
    """
    from app.services.kaggle_ingestion_service import ingest_ashrae_records_to_database
    try:
        result = ingest_ashrae_records_to_database(
            db=db,
            org_id=current_user.organization_id,
            limit_buildings=limit_buildings,
            days_limit=days_limit,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest ASHRAE dataset: {str(e)}",
        )


@router.post(
    "/data-sources/ingest-lead",
    summary="Ingest and Verify LEAD Ground-Truth Anomaly Benchmark Dataset",
)
def ingest_lead_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Ingests the Large-scale Energy Anomaly Detection (LEAD) benchmark dataset
    with verified physical ground-truth annotations and updates the registry.
    """
    from app.services.lead_benchmark_service import ingest_lead_dataset
    try:
        result = ingest_lead_dataset(db=db)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest LEAD benchmark dataset: {str(e)}",
        )


@router.post(
    "/data-sources/ingest-pjm",
    summary="Ingest and Synchronize PJM Hourly Energy & Weather Dataset",
)
def ingest_pjm_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Ingests the PJM Hourly Energy Consumption dataset, computes Cooling/Heating
    Degree Days, and updates the registry.
    """
    from app.services.macro_energy_service import ingest_pjm_dataset
    try:
        result = ingest_pjm_dataset(db=db)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest PJM dataset: {str(e)}",
        )

