from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import User
from app.api.deps import require_admin
from app.db.seed_demo_data import generate_seed_data

router = APIRouter()


@router.post("/seed/demo", summary="Generate Realistic Institutional Seed Data (Admin Only)")
def seed_demo_data_endpoint(
    force: bool = Query(False, description="Force reseed even if resources exist"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Seed 4 campus buildings, 55 classrooms/labs/seminar halls, hundreds of schedules,
    and 14 days of time-series occupancy, utilization, and energy usage."""
    result = generate_seed_data(db=db, force_reseed=force)
    return {
        "success": True,
        "data": result,
    }
