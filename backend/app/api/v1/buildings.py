from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models import Building, Resource, User, AuditLog
from app.schemas.building import BuildingCreate, BuildingUpdate, BuildingResponse
from app.schemas.common import PaginatedResponse
from app.api.deps import get_current_user, require_admin, require_viewer

router = APIRouter()


@router.get("/buildings", response_model=PaginatedResponse[BuildingResponse], summary="List Campus Buildings")
def list_buildings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
    search: Optional[str] = Query(None, description="Search by name or code"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = db.query(
        Building,
        func.count(Resource.id).label("resource_count")
    ).outerjoin(Resource, Resource.building_id == Building.id).filter(
        Building.organization_id == current_user.organization_id
    ).group_by(Building.id)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter((Building.name.ilike(search_fmt)) | (Building.code.ilike(search_fmt)))

    total = query.count()
    offset = (page - 1) * page_size
    results = query.order_by(Building.name).offset(offset).limit(page_size).all()

    items = []
    for bldg, r_count in results:
        b_dict = BuildingResponse.model_validate(bldg).model_dump()
        b_dict["resource_count"] = r_count
        items.append(BuildingResponse(**b_dict))

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/buildings", response_model=BuildingResponse, summary="Create Campus Building")
def create_building(
    bldg_in: BuildingCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # Enforce unique code within organization
    existing = db.query(Building).filter(
        Building.organization_id == admin.organization_id,
        Building.code == bldg_in.code.strip().upper(),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A building with code '{bldg_in.code}' already exists.",
        )

    building = Building(
        organization_id=admin.organization_id,
        name=bldg_in.name.strip(),
        code=bldg_in.code.strip().upper(),
        location=bldg_in.location.strip(),
        floor_count=bldg_in.floor_count,
    )
    db.add(building)
    db.commit()
    db.refresh(building)

    # Audit log
    db.add(AuditLog(
        user_id=admin.id,
        organization_id=admin.organization_id,
        action="BUILDING_CREATE",
        entity_type="Building",
        entity_id=building.id,
        metadata_json=f'{{"code": "{building.code}", "name": "{building.name}"}}',
    ))
    db.commit()

    res = BuildingResponse.model_validate(building).model_dump()
    res["resource_count"] = 0
    return BuildingResponse(**res)


@router.get("/buildings/{id}", response_model=BuildingResponse, summary="Get Building Details")
def get_building(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    building = db.query(Building).filter(
        Building.id == id,
        Building.organization_id == current_user.organization_id,
    ).first()
    if not building:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")

    r_count = db.query(func.count(Resource.id)).filter(Resource.building_id == building.id).scalar() or 0
    res = BuildingResponse.model_validate(building).model_dump()
    res["resource_count"] = r_count
    return BuildingResponse(**res)


@router.put("/buildings/{id}", response_model=BuildingResponse, summary="Update Building")
def update_building(
    id: int,
    bldg_in: BuildingUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    building = db.query(Building).filter(
        Building.id == id,
        Building.organization_id == admin.organization_id,
    ).first()
    if not building:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")

    if bldg_in.code is not None and bldg_in.code.strip().upper() != building.code:
        conflict = db.query(Building).filter(
            Building.organization_id == admin.organization_id,
            Building.code == bldg_in.code.strip().upper(),
            Building.id != id,
        ).first()
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Building code already in use.")
        building.code = bldg_in.code.strip().upper()

    if bldg_in.name is not None:
        building.name = bldg_in.name.strip()
    if bldg_in.location is not None:
        building.location = bldg_in.location.strip()
    if bldg_in.floor_count is not None:
        building.floor_count = bldg_in.floor_count

    db.commit()
    db.refresh(building)

    r_count = db.query(func.count(Resource.id)).filter(Resource.building_id == building.id).scalar() or 0
    res = BuildingResponse.model_validate(building).model_dump()
    res["resource_count"] = r_count
    return BuildingResponse(**res)


@router.delete("/buildings/{id}", summary="Delete Building")
def delete_building(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    building = db.query(Building).filter(
        Building.id == id,
        Building.organization_id == admin.organization_id,
    ).first()
    if not building:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")

    db.delete(building)
    db.add(AuditLog(
        user_id=admin.id,
        organization_id=admin.organization_id,
        action="BUILDING_DELETE",
        entity_type="Building",
        entity_id=id,
        metadata_json=f'{{"code": "{building.code}"}}',
    ))
    db.commit()
    return {"success": True, "message": f"Building {building.name} deleted successfully."}
