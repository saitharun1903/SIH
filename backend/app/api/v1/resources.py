from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models import Resource, Building, ResourceType, User, AuditLog
from app.schemas.resource import ResourceCreate, ResourceUpdate, ResourceResponse
from app.schemas.common import PaginatedResponse
from app.api.deps import require_admin, require_viewer

router = APIRouter()


@router.get("/resources", response_model=PaginatedResponse[ResourceResponse], summary="List Campus Resources")
def list_resources(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
    search: Optional[str] = Query(None, description="Search by name or code"),
    building_id: Optional[int] = Query(None, description="Filter by building"),
    resource_type_id: Optional[int] = Query(None, description="Filter by resource type"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (Active, Inactive, Maintenance)"),
    floor: Optional[int] = Query(None, description="Filter by floor"),
    min_capacity: Optional[int] = Query(None, description="Minimum capacity"),
    max_capacity: Optional[int] = Query(None, description="Maximum capacity"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = db.query(
        Resource,
        Building.name.label("building_name"),
        Building.code.label("building_code"),
        ResourceType.name.label("resource_type_name"),
    ).outerjoin(Building, Building.id == Resource.building_id
    ).join(ResourceType, ResourceType.id == Resource.resource_type_id
    ).filter(Resource.organization_id == current_user.organization_id)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter((Resource.name.ilike(search_fmt)) | (Resource.code.ilike(search_fmt)))

    if building_id:
        query = query.filter(Resource.building_id == building_id)

    if resource_type_id:
        query = query.filter(Resource.resource_type_id == resource_type_id)

    if status_filter:
        query = query.filter(Resource.status.ilike(status_filter.strip()))

    if floor is not None:
        query = query.filter(Resource.floor == floor)

    if min_capacity:
        query = query.filter(Resource.capacity >= min_capacity)

    if max_capacity:
        query = query.filter(Resource.capacity <= max_capacity)

    total = query.count()
    offset = (page - 1) * page_size
    results = query.order_by(Resource.code).offset(offset).limit(page_size).all()

    items = []
    for res, b_name, b_code, rt_name in results:
        r_dict = ResourceResponse.model_validate(res).model_dump()
        r_dict["building_name"] = b_name
        r_dict["building_code"] = b_code
        r_dict["resource_type_name"] = rt_name
        items.append(ResourceResponse(**r_dict))

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/resources", response_model=ResourceResponse, summary="Create Resource")
def create_resource(
    res_in: ResourceCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # Check unique code in organization
    existing = db.query(Resource).filter(
        Resource.organization_id == admin.organization_id,
        Resource.code == res_in.code.strip().upper(),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Resource code '{res_in.code}' already exists.",
        )

    # Validate resource type
    rt = db.query(ResourceType).filter(
        ResourceType.id == res_in.resource_type_id,
        ResourceType.organization_id == admin.organization_id,
    ).first()
    if not rt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource type not found.")

    # Validate building if provided
    b_name, b_code = None, None
    if res_in.building_id:
        b = db.query(Building).filter(
            Building.id == res_in.building_id,
            Building.organization_id == admin.organization_id,
        ).first()
        if not b:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found.")
        b_name = b.name
        b_code = b.code

    resource = Resource(
        organization_id=admin.organization_id,
        building_id=res_in.building_id,
        resource_type_id=res_in.resource_type_id,
        name=res_in.name.strip(),
        code=res_in.code.strip().upper(),
        capacity=res_in.capacity,
        status=res_in.status.strip(),
        floor=res_in.floor,
        area=res_in.area,
        location=res_in.location.strip(),
        metadata_json=res_in.metadata_json,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    db.add(AuditLog(
        user_id=admin.id,
        organization_id=admin.organization_id,
        action="RESOURCE_CREATE",
        entity_type="Resource",
        entity_id=resource.id,
        metadata_json=f'{{"code": "{resource.code}", "capacity": {resource.capacity}}}',
    ))
    db.commit()

    r_dict = ResourceResponse.model_validate(resource).model_dump()
    r_dict["building_name"] = b_name
    r_dict["building_code"] = b_code
    r_dict["resource_type_name"] = rt.name
    return ResourceResponse(**r_dict)


@router.get("/resources/{id}", response_model=ResourceResponse, summary="Get Resource Details")
def get_resource(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    res = db.query(Resource).filter(
        Resource.id == id,
        Resource.organization_id == current_user.organization_id,
    ).first()
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    b_name = res.building.name if res.building else None
    b_code = res.building.code if res.building else None
    rt_name = res.resource_type.name if res.resource_type else None

    r_dict = ResourceResponse.model_validate(res).model_dump()
    r_dict["building_name"] = b_name
    r_dict["building_code"] = b_code
    r_dict["resource_type_name"] = rt_name
    return ResourceResponse(**r_dict)


@router.put("/resources/{id}", response_model=ResourceResponse, summary="Update Resource")
def update_resource(
    id: int,
    res_in: ResourceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    resource = db.query(Resource).filter(
        Resource.id == id,
        Resource.organization_id == admin.organization_id,
    ).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    if res_in.code is not None and res_in.code.strip().upper() != resource.code:
        conflict = db.query(Resource).filter(
            Resource.organization_id == admin.organization_id,
            Resource.code == res_in.code.strip().upper(),
            Resource.id != id,
        ).first()
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resource code already in use.")
        resource.code = res_in.code.strip().upper()

    if res_in.name is not None:
        resource.name = res_in.name.strip()
    if res_in.capacity is not None:
        resource.capacity = res_in.capacity
    if res_in.status is not None:
        resource.status = res_in.status.strip()
    if res_in.floor is not None:
        resource.floor = res_in.floor
    if res_in.area is not None:
        resource.area = res_in.area
    if res_in.location is not None:
        resource.location = res_in.location.strip()
    if res_in.building_id is not None:
        resource.building_id = res_in.building_id
    if res_in.resource_type_id is not None:
        resource.resource_type_id = res_in.resource_type_id
    if res_in.metadata_json is not None:
        resource.metadata_json = res_in.metadata_json

    db.commit()
    db.refresh(resource)

    b_name = resource.building.name if resource.building else None
    b_code = resource.building.code if resource.building else None
    rt_name = resource.resource_type.name if resource.resource_type else None

    r_dict = ResourceResponse.model_validate(resource).model_dump()
    r_dict["building_name"] = b_name
    r_dict["building_code"] = b_code
    r_dict["resource_type_name"] = rt_name
    return ResourceResponse(**r_dict)


@router.delete("/resources/{id}", summary="Delete Resource")
def delete_resource(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    resource = db.query(Resource).filter(
        Resource.id == id,
        Resource.organization_id == admin.organization_id,
    ).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    db.delete(resource)
    db.add(AuditLog(
        user_id=admin.id,
        organization_id=admin.organization_id,
        action="RESOURCE_DELETE",
        entity_type="Resource",
        entity_id=id,
        metadata_json=f'{{"code": "{resource.code}"}}',
    ))
    db.commit()
    return {"success": True, "message": f"Resource {resource.name} deleted successfully."}
