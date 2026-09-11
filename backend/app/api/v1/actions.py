"""
NEXUS - Action Center API Endpoints
Phase 10 Action Center, Automated Recommendations & Audit Trail
Smart India Hackathon 2026 (SIH26202)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User
from app.api.deps import require_analyst, require_viewer
from app.services.recommendation_service import (
    generate_recommendations,
    list_recommendations,
    update_recommendation_status,
    simulate_recommendation,
    get_audit_logs,
)

router = APIRouter()


class ActionStatusPayload(BaseModel):
    notes: Optional[str] = None


@router.get(
    "/actions/recommendations",
    summary="List Operational Recommendations and Work Orders",
)
def get_recommendations(
    status: Optional[str] = Query(None, description="Active, Applied, Dismissed, or All"),
    priority: Optional[str] = Query(None, description="Critical, High, Medium, Low"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Retrieves operational recommendations synthesized from anomaly detection and space utilization."""
    recs = list_recommendations(
        db=db,
        org_id=current_user.organization_id,
        status=status,
        priority=priority,
    )
    # Auto-generate if table is empty
    if not recs and (not status or status.lower() == "active"):
        recs = generate_recommendations(db=db, org_id=current_user.organization_id)
    return recs


@router.post(
    "/actions/recommendations/generate",
    summary="Scan Database and Synthesize New Action Items",
)
def trigger_generate_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """Scans telemetry anomalies, underutilized rooms, and timetable clashes to formulate new recommendations."""
    return generate_recommendations(db=db, org_id=current_user.organization_id)


@router.post(
    "/actions/recommendations/{recommendation_id}/apply",
    summary="Approve and Implement an Action Item",
)
def apply_action(
    recommendation_id: int,
    payload: ActionStatusPayload = ActionStatusPayload(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """Applies the recommended operational measure, marks it as Applied, and creates an audit trail entry."""
    try:
        return update_recommendation_status(
            db=db,
            org_id=current_user.organization_id,
            user_id=current_user.id,
            rec_id=recommendation_id,
            new_status="Applied",
            notes=payload.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/actions/recommendations/{recommendation_id}/dismiss",
    summary="Dismiss an Action Item with Reason",
)
def dismiss_action(
    recommendation_id: int,
    payload: ActionStatusPayload = ActionStatusPayload(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """Dismisses the recommendation and logs reason to audit trail."""
    try:
        return update_recommendation_status(
            db=db,
            org_id=current_user.organization_id,
            user_id=current_user.id,
            rec_id=recommendation_id,
            new_status="Dismissed",
            notes=payload.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/actions/recommendations/{recommendation_id}/simulate",
    summary="Direct 1-Click Verification in What-If Simulator",
)
def simulate_action(
    recommendation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """Spins up a counterfactual What-If scenario corresponding to this recommendation and runs CP-SAT solver."""
    try:
        return simulate_recommendation(
            db=db,
            org_id=current_user.organization_id,
            user_id=current_user.id,
            rec_id=recommendation_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get(
    "/actions/audit-log",
    summary="View Institutional Decision & Policy Audit Trail",
)
def get_audit_trail(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Returns immutable log of all optimization executions, policy approvals, and room state changes."""
    return get_audit_logs(
        db=db,
        org_id=current_user.organization_id,
        limit=limit,
    )
