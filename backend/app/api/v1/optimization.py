"""
NEXUS - Optimization API Endpoints
Phase 7 Google OR-Tools CP-SAT Schedule Optimization Engine
Smart India Hackathon 2026 (SIH26202)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User
from app.api.deps import require_analyst, require_viewer
from app.schemas.optimization import OptimizationRequest, OptimizationResponse
from app.services.optimization_service import solve_schedule_optimization

router = APIRouter()


@router.post(
    "/optimization/solve",
    response_model=OptimizationResponse,
    summary="Solve Schedule Space Allocation with CP-SAT Solver",
)
def solve_optimization(
    request: OptimizationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """
    Executes Google OR-Tools Constraint Programming (CP-SAT) solver to find an optimal space
    allocation minimizing active thermal footprint, maximizing seat fill rate,
    and avoiding timetable collisions.
    """
    return solve_schedule_optimization(
        db=db,
        org_id=current_user.organization_id,
        request=request,
    )
