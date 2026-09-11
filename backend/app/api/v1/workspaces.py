import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func


from app.db.session import get_db
from app.models import Workspace, Resource, Anomaly, Goal, User, AuditLog
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse, WorkspaceTemplate
from app.api.deps import get_current_user, require_admin, require_viewer
from app.services.workspace_service import (
    get_available_templates,
    list_workspaces,
    get_workspace,
    ensure_default_workspace,
    create_workspace,
    universal_search,
)

router = APIRouter()


@router.get("/workspaces/templates", response_model=List[WorkspaceTemplate], summary="Get Available Domain Templates")
def get_templates(
    current_user: User = Depends(require_viewer),
):
    """Returns domain templates for factory, hospital, warehouse, office, education, energy, etc."""
    return get_available_templates()


@router.get("/workspaces", response_model=List[WorkspaceResponse], summary="List Organization Workspaces")
def get_workspaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Lists all active workspaces under the user's organization. Ensures at least one default workspace exists."""
    ensure_default_workspace(db, current_user.organization_id)
    workspaces = list_workspaces(db, current_user.organization_id)

    response_items = []
    for ws in workspaces:
        res_count = db.query(Resource).filter(Resource.workspace_id == ws.id).count()
        issue_count = db.query(Anomaly).filter(Anomaly.organization_id == current_user.organization_id, Anomaly.status.in_(["open", "investigating"])).count()
        goal_count = db.query(Goal).filter(Goal.workspace_id == ws.id).count()

        ws_dict = WorkspaceResponse.model_validate(ws).model_dump()
        ws_dict["resource_count"] = res_count
        ws_dict["active_issue_count"] = issue_count
        ws_dict["goal_count"] = goal_count
        response_items.append(WorkspaceResponse(**ws_dict))

    return response_items


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceResponse, summary="Get Workspace Details")
def get_workspace_detail(
    workspace_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    ws = get_workspace(db, workspace_id, current_user.organization_id)
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    res_count = db.query(Resource).filter(Resource.workspace_id == ws.id).count()
    issue_count = db.query(Anomaly).filter(Anomaly.organization_id == current_user.organization_id, Anomaly.status.in_(["open", "investigating"])).count()
    goal_count = db.query(Goal).filter(Goal.workspace_id == ws.id).count()

    ws_dict = WorkspaceResponse.model_validate(ws).model_dump()
    ws_dict["resource_count"] = res_count
    ws_dict["active_issue_count"] = issue_count
    ws_dict["goal_count"] = goal_count
    return WorkspaceResponse(**ws_dict)


@router.post("/workspaces", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED, summary="Create Workspace")
def create_new_workspace(
    ws_in: WorkspaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # Enforce unique code within organization
    existing = db.query(Workspace).filter(
        Workspace.organization_id == current_user.organization_id,
        Workspace.code == ws_in.code.upper().strip(),
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Workspace code '{ws_in.code}' already exists.")

    new_ws = create_workspace(db, current_user.organization_id, ws_in)

    # Log audit
    audit = AuditLog(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        workspace_id=new_ws.id,
        action="CREATE",
        entity_type="workspace",
        entity_id=new_ws.id,
        metadata_json=json.dumps({"name": new_ws.name, "type": new_ws.workspace_type, "code": new_ws.code}),
    )

    db.add(audit)
    db.commit()

    ws_dict = WorkspaceResponse.model_validate(new_ws).model_dump()
    ws_dict["resource_count"] = 0
    ws_dict["active_issue_count"] = 0
    ws_dict["goal_count"] = db.query(Goal).filter(Goal.workspace_id == new_ws.id).count()
    return WorkspaceResponse(**ws_dict)


@router.put("/workspaces/{workspace_id}", response_model=WorkspaceResponse, summary="Update Workspace")
def update_workspace_endpoint(
    workspace_id: int,
    ws_in: WorkspaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    ws = get_workspace(db, workspace_id, current_user.organization_id)
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    update_data = ws_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(ws, field, val)

    db.commit()
    db.refresh(ws)

    res_count = db.query(Resource).filter(Resource.workspace_id == ws.id).count()
    issue_count = db.query(Anomaly).filter(Anomaly.organization_id == current_user.organization_id, Anomaly.status.in_(["open", "investigating"])).count()
    goal_count = db.query(Goal).filter(Goal.workspace_id == ws.id).count()

    ws_dict = WorkspaceResponse.model_validate(ws).model_dump()
    ws_dict["resource_count"] = res_count
    ws_dict["active_issue_count"] = issue_count
    ws_dict["goal_count"] = goal_count
    return WorkspaceResponse(**ws_dict)


@router.get("/search", summary="Universal Grounded Search")
def search_everything(
    q: str = Query(..., min_length=1, description="Search term for resources, anomalies, scenarios, actions, goals"),
    workspace_id: Optional[int] = Query(None, description="Filter by workspace ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Cross-entity search engine grounded in live database records."""
    return universal_search(db, current_user.organization_id, q, workspace_id)
