from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import Schedule, Resource, Building, User, AuditLog
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate, ScheduleResponse
from app.schemas.common import PaginatedResponse
from app.api.deps import require_analyst, require_viewer

router = APIRouter()


@router.get("/schedules", response_model=PaginatedResponse[ScheduleResponse], summary="List Schedules")
def list_schedules(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
    resource_id: Optional[int] = Query(None, description="Filter by resource ID"),
    day_of_week: Optional[str] = Query(None, description="Filter by day (e.g. Monday)"),
    department: Optional[str] = Query(None, description="Filter by department"),
    search: Optional[str] = Query(None, description="Search subject name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    query = db.query(
        Schedule,
        Resource.name.label("resource_name"),
        Resource.code.label("resource_code"),
        Building.name.label("building_name"),
    ).join(Resource, Resource.id == Schedule.resource_id
    ).outerjoin(Building, Building.id == Resource.building_id
    ).filter(Schedule.organization_id == current_user.organization_id)

    if resource_id:
        query = query.filter(Schedule.resource_id == resource_id)

    if day_of_week:
        query = query.filter(Schedule.day_of_week.ilike(day_of_week.strip()))

    if department:
        query = query.filter(Schedule.department.ilike(f"%{department.strip()}%"))

    if search:
        query = query.filter(Schedule.subject_name.ilike(f"%{search.strip()}%"))

    total = query.count()
    offset = (page - 1) * page_size
    results = query.order_by(
        Schedule.day_of_week,
        Schedule.start_time
    ).offset(offset).limit(page_size).all()

    items = []
    for sched, r_name, r_code, b_name in results:
        s_dict = ScheduleResponse.model_validate(sched).model_dump()
        s_dict["resource_name"] = r_name
        s_dict["resource_code"] = r_code
        s_dict["building_name"] = b_name
        items.append(ScheduleResponse(**s_dict))

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/schedules", response_model=ScheduleResponse, summary="Create Schedule")
def create_schedule(
    sched_in: ScheduleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_analyst),
):
    # Verify resource
    resource = db.query(Resource).filter(
        Resource.id == sched_in.resource_id,
        Resource.organization_id == user.organization_id,
    ).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")

    # Time validation: start_time < end_time
    if sched_in.start_time >= sched_in.end_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Start time must precede end time.",
        )

    # Conflict check in same resource on same day
    conflict = db.query(Schedule).filter(
        Schedule.resource_id == sched_in.resource_id,
        Schedule.day_of_week == sched_in.day_of_week,
        Schedule.start_time < sched_in.end_time,
        Schedule.end_time > sched_in.start_time,
    ).first()
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Timetable conflict: {resource.code} is already scheduled for '{conflict.subject_name}' ({conflict.start_time}-{conflict.end_time}) on {sched_in.day_of_week}.",
        )

    schedule = Schedule(
        organization_id=user.organization_id,
        resource_id=sched_in.resource_id,
        subject_name=sched_in.subject_name.strip(),
        department=sched_in.department.strip(),
        day_of_week=sched_in.day_of_week.strip(),
        start_time=sched_in.start_time.strip(),
        end_time=sched_in.end_time.strip(),
        expected_occupancy=sched_in.expected_occupancy,
        actual_occupancy=sched_in.actual_occupancy,
        equipment_requirements=sched_in.equipment_requirements,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    db.add(AuditLog(
        user_id=user.id,
        organization_id=user.organization_id,
        action="SCHEDULE_CREATE",
        entity_type="Schedule",
        entity_id=schedule.id,
        metadata_json=f'{{"subject": "{schedule.subject_name}", "resource_id": {schedule.resource_id}}}',
    ))
    db.commit()

    b_name = resource.building.name if resource.building else None
    s_dict = ScheduleResponse.model_validate(schedule).model_dump()
    s_dict["resource_name"] = resource.name
    s_dict["resource_code"] = resource.code
    s_dict["building_name"] = b_name
    return ScheduleResponse(**s_dict)


@router.get("/schedules/{id}", response_model=ScheduleResponse, summary="Get Schedule Details")
def get_schedule(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    schedule = db.query(Schedule).filter(
        Schedule.id == id,
        Schedule.organization_id == current_user.organization_id,
    ).first()
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    res = schedule.resource
    b_name = res.building.name if res.building else None
    s_dict = ScheduleResponse.model_validate(schedule).model_dump()
    s_dict["resource_name"] = res.name
    s_dict["resource_code"] = res.code
    s_dict["building_name"] = b_name
    return ScheduleResponse(**s_dict)


@router.put("/schedules/{id}", response_model=ScheduleResponse, summary="Update Schedule")
def update_schedule(
    id: int,
    sched_in: ScheduleUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_analyst),
):
    schedule = db.query(Schedule).filter(
        Schedule.id == id,
        Schedule.organization_id == user.organization_id,
    ).first()
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    target_res_id = sched_in.resource_id if sched_in.resource_id is not None else schedule.resource_id
    target_day = sched_in.day_of_week.strip() if sched_in.day_of_week is not None else schedule.day_of_week
    target_start = sched_in.start_time.strip() if sched_in.start_time is not None else schedule.start_time
    target_end = sched_in.end_time.strip() if sched_in.end_time is not None else schedule.end_time

    if target_start >= target_end:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Start time must precede end time.",
        )

    # Check conflict
    conflict = db.query(Schedule).filter(
        Schedule.id != id,
        Schedule.resource_id == target_res_id,
        Schedule.day_of_week == target_day,
        Schedule.start_time < target_end,
        Schedule.end_time > target_start,
    ).first()
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Timetable conflict: Overlaps with '{conflict.subject_name}' ({conflict.start_time}-{conflict.end_time}) on {target_day}.",
        )

    if sched_in.resource_id is not None:
        res = db.query(Resource).filter(
            Resource.id == sched_in.resource_id,
            Resource.organization_id == user.organization_id,
        ).first()
        if not res:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
        schedule.resource_id = sched_in.resource_id

    if sched_in.subject_name is not None:
        schedule.subject_name = sched_in.subject_name.strip()
    if sched_in.department is not None:
        schedule.department = sched_in.department.strip()
    if sched_in.day_of_week is not None:
        schedule.day_of_week = target_day
    if sched_in.start_time is not None:
        schedule.start_time = target_start
    if sched_in.end_time is not None:
        schedule.end_time = target_end
    if sched_in.expected_occupancy is not None:
        schedule.expected_occupancy = sched_in.expected_occupancy
    if sched_in.actual_occupancy is not None:
        schedule.actual_occupancy = sched_in.actual_occupancy
    if sched_in.equipment_requirements is not None:
        schedule.equipment_requirements = sched_in.equipment_requirements

    db.commit()
    db.refresh(schedule)

    res = schedule.resource
    b_name = res.building.name if res.building else None
    s_dict = ScheduleResponse.model_validate(schedule).model_dump()
    s_dict["resource_name"] = res.name
    s_dict["resource_code"] = res.code
    s_dict["building_name"] = b_name
    return ScheduleResponse(**s_dict)


@router.delete("/schedules/{id}", summary="Delete Schedule")
def delete_schedule(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_analyst),
):
    schedule = db.query(Schedule).filter(
        Schedule.id == id,
        Schedule.organization_id == user.organization_id,
    ).first()
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    db.delete(schedule)
    db.add(AuditLog(
        user_id=user.id,
        organization_id=user.organization_id,
        action="SCHEDULE_DELETE",
        entity_type="Schedule",
        entity_id=id,
        metadata_json=f'{{"subject": "{schedule.subject_name}"}}',
    ))
    db.commit()
    return {"success": True, "message": f"Schedule for '{schedule.subject_name}' deleted successfully."}
