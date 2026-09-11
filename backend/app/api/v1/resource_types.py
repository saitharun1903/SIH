from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import ResourceType, User, AuditLog
from app.schemas.resource_type import ResourceTypeCreate, ResourceTypeUpdate, ResourceTypeResponse
from app.api.deps import require_admin, require_viewer

router = APIRouter()


@router.get("/resource-types", response_model=List[ResourceTypeResponse], summary="List Resource Types")
def list_resource_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    return db.query(ResourceType).filter(
        ResourceType.organization_id == current_user.organization_id
    ).order_by(ResourceType.name).all()


@router.post("/resource-types", response_model=ResourceTypeResponse, summary="Create Resource Type")
def create_resource_type(
    type_in: ResourceTypeCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    existing = db.query(ResourceType).filter(
        ResourceType.organization_id == admin.organization_id,
        ResourceType.name.ilike(type_in.name.strip()),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Resource type '{type_in.name}' already exists.",
        )

    res_type = ResourceType(
        organization_id=admin.organization_id,
        name=type_in.name.strip(),
        category=type_in.category.strip(),
        unit=type_in.unit.strip(),
        description=type_in.description,
        config_json=type_in.config_json,
    )
    db.add(res_type)
    db.commit()
    db.refresh(res_type)

    db.add(AuditLog(
        user_id=admin.id,
        organization_id=admin.organization_id,
        action="RESOURCE_TYPE_CREATE",
        entity_type="ResourceType",
        entity_id=res_type.id,
        metadata_json=f'{{"name": "{res_type.name}"}}',
    ))
    db.commit()
    return res_type


@router.get("/resource-types/{id}", response_model=ResourceTypeResponse, summary="Get Resource Type")
def get_resource_type(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    res_type = db.query(ResourceType).filter(
        ResourceType.id == id,
        ResourceType.organization_id == current_user.organization_id,
    ).first()
    if not res_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource type not found")
    return res_type


@router.put("/resource-types/{id}", response_model=ResourceTypeResponse, summary="Update Resource Type")
def update_resource_type(
    id: int,
    type_in: ResourceTypeUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    res_type = db.query(ResourceType).filter(
        ResourceType.id == id,
        ResourceType.organization_id == admin.organization_id,
    ).first()
    if not res_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource type not found")

    if type_in.name is not None:
        conflict = db.query(ResourceType).filter(
            ResourceType.organization_id == admin.organization_id,
            ResourceType.name.ilike(type_in.name.strip()),
            ResourceType.id != id,
        ).first()
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Name already in use.")
        res_type.name = type_in.name.strip()

    if type_in.category is not None:
        res_type.category = type_in.category.strip()
    if type_in.unit is not None:
        res_type.unit = type_in.unit.strip()
    if type_in.description is not None:
        res_type.description = type_in.description
    if type_in.config_json is not None:
        res_type.config_json = type_in.config_json

    db.commit()
    db.refresh(res_type)
    return res_type


@router.delete("/resource-types/{id}", summary="Delete Resource Type")
def delete_resource_type(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    res_type = db.query(ResourceType).filter(
        ResourceType.id == id,
        ResourceType.organization_id == admin.organization_id,
    ).first()
    if not res_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource type not found")

    db.delete(res_type)
    db.commit()
    return {"success": True, "message": f"Resource type {res_type.name} deleted successfully."}
