from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import Organization, User
from app.schemas.auth import OrganizationResponse
from app.api.deps import get_current_user, require_admin

router = APIRouter()


@router.get("/organizations", response_model=List[OrganizationResponse], summary="List Organizations")
def list_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all organizations or the current user's organization."""
    if current_user.role == "Administrator":
        return db.query(Organization).all()
    return db.query(Organization).filter(Organization.id == current_user.organization_id).all()


@router.get("/organizations/{id}", response_model=OrganizationResponse, summary="Get Organization Details")
def get_organization(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get details for a specific organization."""
    org = db.query(Organization).filter(Organization.id == id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    if current_user.role != "Administrator" and org.id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return org
