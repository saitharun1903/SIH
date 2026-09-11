"""
NEXUS - Anomaly Detection API Endpoints
Phase 5 Anomaly Detection Engine (SIH26202)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User
from app.api.deps import require_viewer, require_analyst
from app.schemas.anomaly import (
    AnomalyResponse,
    AnomalySummaryResponse,
    AnomalyStatusUpdate,
    AnomalyDetectionTriggerRequest,
)
from app.services.anomaly_service import (
    run_detection_job,
    get_anomalies,
    get_anomaly_summary,
    update_anomaly_status,
)

router = APIRouter()


@router.get(
    "/anomalies/summary",
    response_model=AnomalySummaryResponse,
    summary="Get Institutional Anomaly Breakdown & Financial Impact",
)
def summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Returns real-time aggregated counts by severity, lifecycle status, and estimated energy waste in INR."""
    return get_anomaly_summary(db=db, org_id=current_user.organization_id)


@router.get(
    "/anomalies/benchmark/report",
    summary="Get LEAD Ground-Truth Anomaly Benchmark Evaluation Report",
)
def get_benchmark_report_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """
    Returns empirical evaluation metrics (Confusion Matrix, Precision, Recall,
    F1-score, False Positive Rate) computed against authentic LEAD ground-truth annotations.
    """
    from app.services.lead_benchmark_service import get_latest_benchmark_report
    try:
        return get_latest_benchmark_report(db=db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate benchmark report: {str(e)}",
        )


@router.post(
    "/anomalies/benchmark/evaluate",
    summary="Run Anomaly Detection Benchmark Against LEAD Ground-Truth",
)
def run_benchmark_evaluate_endpoint(
    contamination: float = Query(0.05, ge=0.01, le=0.20, description="Estimated outlier contamination rate"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """
    Executes empirical benchmark evaluation across Isolation Forest,
    Physical Rules, and the NEXUS Hybrid Ensemble against the LEAD dataset.
    """
    from app.services.lead_benchmark_service import evaluate_anomaly_detectors
    try:
        report = evaluate_anomaly_detectors(db=db, contamination=contamination)
        return report
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate anomaly detector benchmark: {str(e)}",
        )


@router.get(
    "/anomalies",
    summary="List Detected Anomalies with Filters",
)
def list_anomalies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
    status: Optional[str] = Query(None, description="Active, Acknowledged, Resolved, Dismissed"),
    severity: Optional[str] = Query(None, description="Critical, High, Medium, Low"),
    metric_type: Optional[str] = Query(None, description="energy, occupancy, utilization, multivariate"),
    anomaly_type: Optional[str] = Query(None, description="phantom_energy, capacity_violation, zero_occupancy, unexpected_occupancy, multivariate_outlier"),
    building_id: Optional[int] = Query(None),
    resource_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Lists detected anomalies with contributing factors and room attribution."""
    items, total = get_anomalies(
        db=db,
        org_id=current_user.organization_id,
        status=status,
        severity=severity,
        metric_type=metric_type,
        anomaly_type=anomaly_type,
        building_id=building_id,
        resource_id=resource_id,
        limit=limit,
        offset=offset,
    )
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post(
    "/anomalies/detect",
    summary="Execute Isolation Forest ML Anomaly Detection Job",
)
def trigger_detection(
    request: AnomalyDetectionTriggerRequest = AnomalyDetectionTriggerRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """
    Triggers multivariate feature extraction, trains the Isolation Forest algorithm on historical telemetry,
    applies institutional physical boundary checks, and stores newly identified anomalies.
    """
    detected = run_detection_job(
        db=db,
        org_id=current_user.organization_id,
        resource_id=request.resource_id,
        building_id=request.building_id,
        start_date=request.start_date,
        end_date=request.end_date,
        contamination=request.contamination or 0.05,
    )

    return {
        "success": True,
        "message": f"Isolation Forest detection completed. Found and synchronized {len(detected)} anomaly events.",
        "count": len(detected),
    }


@router.patch(
    "/anomalies/{anomaly_id}/status",
    response_model=AnomalyResponse,
    summary="Update Anomaly Lifecycle Status (Acknowledge, Resolve, Dismiss)",
)
def update_status(
    anomaly_id: int,
    payload: AnomalyStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """Updates the resolution status of an anomaly with timestamp and auditor notes."""
    valid_statuses = ["Active", "Acknowledged", "Resolved", "Dismissed"]
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Must be one of: {', '.join(valid_statuses)}",
        )

    updated = update_anomaly_status(
        db=db,
        anomaly_id=anomaly_id,
        org_id=current_user.organization_id,
        user_id=current_user.id,
        status=payload.status,
        resolution_notes=payload.resolution_notes,
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Anomaly with ID {anomaly_id} was not found.",
        )

    return updated
