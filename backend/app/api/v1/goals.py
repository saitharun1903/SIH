import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Goal, User, AuditLog
from app.schemas.goal import GoalCreate, GoalUpdate, GoalResponse
from app.api.deps import get_current_user, require_admin, require_viewer

router = APIRouter()


@router.get("/goals", response_model=List[GoalResponse], summary="List Operational Goals")
def list_goals(
    workspace_id: Optional[int] = Query(None, description="Filter goals by workspace"),
    status_filter: Optional[str] = Query(None, description="Filter by status (e.g. In Progress, Achieved)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    query = db.query(Goal).filter(Goal.organization_id == current_user.organization_id)
    if workspace_id:
        query = query.filter(Goal.workspace_id == workspace_id)
    if status_filter:
        query = query.filter(Goal.status == status_filter)

    return query.order_by(Goal.priority.desc(), Goal.created_at.desc()).all()


@router.get("/goals/{goal_id}", response_model=GoalResponse, summary="Get Goal Details")
def get_goal_detail(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.organization_id == current_user.organization_id,
    ).first()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return goal


@router.post("/goals", response_model=GoalResponse, status_code=status.HTTP_201_CREATED, summary="Create Operational Goal")
def create_goal(
    goal_in: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    goal = Goal(
        organization_id=current_user.organization_id,
        workspace_id=goal_in.workspace_id,
        title=goal_in.title,
        goal_type=goal_in.goal_type,
        target_value=goal_in.target_value,
        unit=goal_in.unit,
        baseline_value=goal_in.baseline_value,
        current_value=goal_in.current_value or goal_in.baseline_value,
        timeframe=goal_in.timeframe,
        status=goal_in.status,
        priority=goal_in.priority,
        description=goal_in.description,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)

    # Audit log
    audit = AuditLog(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        workspace_id=goal.workspace_id,
        action="CREATE",
        entity_type="goal",
        entity_id=goal.id,
        metadata_json=json.dumps({"title": goal.title, "target": goal.target_value, "unit": goal.unit}),
    )
    db.add(audit)
    db.commit()


    return goal


@router.put("/goals/{goal_id}", response_model=GoalResponse, summary="Update Operational Goal")
def update_goal(
    goal_id: int,
    goal_in: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.organization_id == current_user.organization_id,
    ).first()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")

    update_data = goal_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(goal, field, val)

    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Operational Goal")
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.organization_id == current_user.organization_id,
    ).first()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")

    db.delete(goal)
    db.commit()
    return None
