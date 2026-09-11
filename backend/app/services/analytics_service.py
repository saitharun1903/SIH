from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, case, desc, asc

from app.models import (
    Resource,
    Building,
    ResourceType,
    ResourceUsage,
    EnergyUsage,
    OccupancyRecord,
    Schedule,
)
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    UtilizationTrendPoint,
    EnergyTrendPoint,
    ResourceUtilizationRank,
    BuildingAnalytics,
    PeakDemandPoint,
)
from app.core.config import settings


def _apply_resource_filters(query, model, building_id=None, resource_type_id=None, resource_id=None):
    if resource_id:
        query = query.filter(model.id == resource_id)
    if building_id:
        query = query.filter(model.building_id == building_id)
    if resource_type_id:
        query = query.filter(model.resource_type_id == resource_type_id)
    return query


def get_analytics_summary(
    db: Session,
    org_id: int,
    building_id: Optional[int] = None,
    resource_type_id: Optional[int] = None,
    resource_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> AnalyticsSummaryResponse:
    # 1. Base Resources Query
    res_q = db.query(Resource).filter(Resource.organization_id == org_id)
    res_q = _apply_resource_filters(res_q, Resource, building_id, resource_type_id, resource_id)
    resources = res_q.all()
    res_ids = [r.id for r in resources]

    if not res_ids:
        return AnalyticsSummaryResponse(
            overall_utilization_percent=0.0,
            total_energy_kwh=0.0,
            total_energy_cost=0.0,
            average_daily_energy_kwh=0.0,
            energy_per_occupied_hour=0.0,
            energy_per_student=0.0,
            total_spaces_analyzed=0,
            underutilized_count=0,
            overloaded_count=0,
            optimal_count=0,
            underutilized_threshold=settings.DEFAULT_UNDERUTILIZATION_THRESHOLD,
            overloaded_threshold=settings.DEFAULT_OVERUTILIZATION_THRESHOLD,
        )

    # 2. Date Bounds
    if not end_date:
        end_date = datetime.now(timezone.utc)
    if not start_date:
        start_date = end_date - timedelta(days=14)

    # 3. Overall Utilization
    u_q = db.query(
        func.avg(ResourceUsage.utilization_percent).label("avg_util")
    ).filter(
        ResourceUsage.resource_id.in_(res_ids),
        ResourceUsage.timestamp >= start_date,
        ResourceUsage.timestamp <= end_date,
    )
    overall_util = u_q.scalar() or 0.0

    # 4. Energy Metrics
    e_q = db.query(
        func.sum(EnergyUsage.consumption).label("total_kwh"),
        func.sum(EnergyUsage.cost).label("total_cost"),
    ).filter(
        EnergyUsage.resource_id.in_(res_ids),
        EnergyUsage.timestamp >= start_date,
        EnergyUsage.timestamp <= end_date,
    )
    e_res = e_q.first()
    total_kwh = float(e_res.total_kwh or 0.0)
    total_cost = float(e_res.total_cost or 0.0)

    days_span = max(1, (end_date - start_date).days)
    avg_daily_kwh = round(total_kwh / days_span, 2)

    # 5. Occupancy metrics for efficiency calculation
    occ_q = db.query(
        func.sum(OccupancyRecord.occupancy).label("total_students"),
        func.count(OccupancyRecord.id).label("total_hours_measured"),
        func.sum(case((OccupancyRecord.occupancy > 0, 3), else_=0)).label("occupied_hours"),  # 3 hr sample slots
    ).filter(
        OccupancyRecord.resource_id.in_(res_ids),
        OccupancyRecord.timestamp >= start_date,
        OccupancyRecord.timestamp <= end_date,
    )
    occ_res = occ_q.first()
    total_students = float(occ_res.total_students or 0.0)
    occupied_hours = float(occ_res.occupied_hours or 0.0) or 1.0

    energy_per_occ_hour = round(total_kwh / occupied_hours, 2) if occupied_hours > 0 else 0.0
    energy_per_student = round(total_kwh / total_students, 2) if total_students > 0 else 0.0

    # 6. Space Categorization by Average Utilization
    under_thresh = settings.DEFAULT_UNDERUTILIZATION_THRESHOLD
    over_thresh = settings.DEFAULT_OVERUTILIZATION_THRESHOLD

    space_utils = db.query(
        ResourceUsage.resource_id,
        func.avg(ResourceUsage.utilization_percent).label("res_avg_util")
    ).filter(
        ResourceUsage.resource_id.in_(res_ids),
        ResourceUsage.timestamp >= start_date,
        ResourceUsage.timestamp <= end_date,
    ).group_by(ResourceUsage.resource_id).all()

    underutilized = 0
    overloaded = 0
    optimal = 0

    evaluated_res_ids = set()
    for r_id, u_val in space_utils:
        evaluated_res_ids.add(r_id)
        if u_val < under_thresh:
            underutilized += 1
        elif u_val > over_thresh:
            overloaded += 1
        else:
            optimal += 1

    # Spaces with zero records default to underutilized
    unmeasured = len(res_ids) - len(evaluated_res_ids)
    underutilized += unmeasured

    total_capacity_seats = sum(r.capacity for r in resources)
    sched_seat_hours = (
        db.query(func.sum(Schedule.expected_occupancy))
        .filter(Schedule.resource_id.in_(res_ids))
        .scalar()
        or 0
    )

    return AnalyticsSummaryResponse(
        overall_utilization_percent=round(float(overall_util), 1),
        total_energy_kwh=round(total_kwh, 1),
        total_energy_cost=round(total_cost, 2),
        average_daily_energy_kwh=avg_daily_kwh,
        energy_per_occupied_hour=energy_per_occ_hour,
        energy_per_student=energy_per_student,
        total_spaces_analyzed=len(resources),
        underutilized_count=underutilized,
        overloaded_count=overloaded,
        optimal_count=optimal,
        underutilized_threshold=under_thresh,
        overloaded_threshold=over_thresh,
        total_scheduled_hours=int(sched_seat_hours),
        total_capacity_seats=int(total_capacity_seats),
        date_range_start=start_date,
        date_range_end=end_date,
    )


def get_utilization_trends(
    db: Session,
    org_id: int,
    building_id: Optional[int] = None,
    resource_type_id: Optional[int] = None,
    resource_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[UtilizationTrendPoint]:
    res_q = db.query(Resource).filter(Resource.organization_id == org_id)
    res_q = _apply_resource_filters(res_q, Resource, building_id, resource_type_id, resource_id)
    res_ids = [r.id for r in res_q.all()]

    if not res_ids:
        return []

    if not end_date:
        end_date = datetime.now(timezone.utc)
    if not start_date:
        start_date = end_date - timedelta(days=14)

    # Group by timestamp (or date)
    results = db.query(
        ResourceUsage.timestamp,
        func.avg(ResourceUsage.utilization_percent).label("avg_util"),
        func.max(ResourceUsage.utilization_percent).label("peak_util"),
        func.avg(ResourceUsage.usage_value).label("avg_occ"),
    ).filter(
        ResourceUsage.resource_id.in_(res_ids),
        ResourceUsage.timestamp >= start_date,
        ResourceUsage.timestamp <= end_date,
    ).group_by(ResourceUsage.timestamp).order_by(ResourceUsage.timestamp.asc()).all()

    points = []
    for ts, a_util, p_util, a_occ in results:
        points.append(
            UtilizationTrendPoint(
                timestamp=ts.strftime("%Y-%m-%d %H:%M"),
                avg_utilization=round(float(a_util or 0.0), 1),
                peak_utilization=round(float(p_util or 0.0), 1),
                avg_occupancy=round(float(a_occ or 0.0), 1),
                total_capacity=len(res_ids) * 60,
            )
        )
    return points


def get_energy_trends(
    db: Session,
    org_id: int,
    building_id: Optional[int] = None,
    resource_type_id: Optional[int] = None,
    resource_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[EnergyTrendPoint]:
    res_q = db.query(Resource).filter(Resource.organization_id == org_id)
    res_q = _apply_resource_filters(res_q, Resource, building_id, resource_type_id, resource_id)
    res_ids = [r.id for r in res_q.all()]

    if not res_ids:
        return []

    if not end_date:
        end_date = datetime.now(timezone.utc)
    if not start_date:
        start_date = end_date - timedelta(days=14)

    results = db.query(
        EnergyUsage.timestamp,
        func.sum(EnergyUsage.consumption).label("consumption_kwh"),
        func.sum(EnergyUsage.cost).label("cost"),
        func.count(EnergyUsage.id).label("spaces_count"),
    ).filter(
        EnergyUsage.resource_id.in_(res_ids),
        EnergyUsage.timestamp >= start_date,
        EnergyUsage.timestamp <= end_date,
    ).group_by(EnergyUsage.timestamp).order_by(EnergyUsage.timestamp.asc()).all()

    points = []
    for ts, kwh, cost, count in results:
        points.append(
            EnergyTrendPoint(
                timestamp=ts.strftime("%Y-%m-%d %H:%M"),
                consumption_kwh=round(float(kwh or 0.0), 1),
                cost=round(float(cost or 0.0), 2),
                occupied_spaces_count=int(count),
            )
        )
    return points


def get_resource_rankings(
    db: Session,
    org_id: int,
    category_filter: Optional[str] = None,  # underutilized, overloaded, optimal
    building_id: Optional[int] = None,
    resource_type_id: Optional[int] = None,
    limit: int = 50,
) -> List[ResourceUtilizationRank]:
    query = db.query(
        Resource,
        Building.name.label("building_name"),
        ResourceType.name.label("resource_type_name"),
        func.avg(ResourceUsage.utilization_percent).label("avg_util"),
        func.max(ResourceUsage.utilization_percent).label("peak_util"),
        func.sum(EnergyUsage.consumption).label("total_energy"),
        func.sum(EnergyUsage.cost).label("total_cost"),
    ).outerjoin(Building, Building.id == Resource.building_id
    ).join(ResourceType, ResourceType.id == Resource.resource_type_id
    ).outerjoin(ResourceUsage, ResourceUsage.resource_id == Resource.id
    ).outerjoin(EnergyUsage, EnergyUsage.resource_id == Resource.id
    ).filter(Resource.organization_id == org_id)

    if building_id:
        query = query.filter(Resource.building_id == building_id)
    if resource_type_id:
        query = query.filter(Resource.resource_type_id == resource_type_id)

    query = query.group_by(Resource.id).order_by(desc("avg_util"))
    raw_results = query.limit(limit * 2).all()

    under_thresh = settings.DEFAULT_UNDERUTILIZATION_THRESHOLD
    over_thresh = settings.DEFAULT_OVERUTILIZATION_THRESHOLD

    ranks = []
    for res, b_name, rt_name, avg_u, peak_u, t_energy, t_cost in raw_results:
        u_val = round(float(avg_u or 0.0), 1)
        p_val = round(float(peak_u or 0.0), 1)

        if u_val < under_thresh:
            cat = "Underutilized"
        elif u_val > over_thresh:
            cat = "Overloaded"
        else:
            cat = "Optimal"

        if category_filter:
            if category_filter.lower() != cat.lower():
                continue

        ranks.append(
            ResourceUtilizationRank(
                resource_id=res.id,
                resource_code=res.code,
                resource_name=res.name,
                building_name=b_name or "Unassigned",
                resource_type_name=rt_name or "Space",
                capacity=res.capacity,
                avg_utilization=u_val,
                peak_utilization=p_val,
                status_category=cat,
                total_occupied_hours=round(u_val * 0.4, 1),
                total_energy_kwh=round(float(t_energy or 0.0), 1),
                total_cost=round(float(t_cost or 0.0), 2),
            )
        )

        if len(ranks) >= limit:
            break

    return ranks


def get_building_comparison(db: Session, org_id: int) -> List[BuildingAnalytics]:
    buildings = db.query(Building).filter(Building.organization_id == org_id).all()
    results = []

    for bldg in buildings:
        res_ids = [r.id for r in bldg.resources]
        if not res_ids:
            results.append(
                BuildingAnalytics(
                    building_id=bldg.id,
                    building_code=bldg.code,
                    building_name=bldg.name,
                    avg_utilization=0.0,
                    total_energy_kwh=0.0,
                    total_cost=0.0,
                    resource_count=0,
                )
            )
            continue

        u_val = db.query(func.avg(ResourceUsage.utilization_percent)).filter(ResourceUsage.resource_id.in_(res_ids)).scalar() or 0.0
        e_val = db.query(func.sum(EnergyUsage.consumption), func.sum(EnergyUsage.cost)).filter(EnergyUsage.resource_id.in_(res_ids)).first()
        kwh = float(e_val[0] or 0.0) if e_val else 0.0
        cost = float(e_val[1] or 0.0) if e_val else 0.0

        results.append(
            BuildingAnalytics(
                building_id=bldg.id,
                building_code=bldg.code,
                building_name=bldg.name,
                avg_utilization=round(float(u_val), 1),
                total_energy_kwh=round(kwh, 1),
                total_cost=round(cost, 2),
                resource_count=len(res_ids),
            )
        )

    return sorted(results, key=lambda x: x.avg_utilization, reverse=True)


def get_peak_demand(db: Session, org_id: int) -> List[PeakDemandPoint]:
    """Calculate timetable peak occupancy and utilization by day and time slot."""
    schedules = db.query(
        Schedule.day_of_week,
        Schedule.start_time,
        Schedule.end_time,
        func.avg(Schedule.expected_occupancy).label("avg_students"),
        func.count(Schedule.id).label("class_count"),
        func.sum(Schedule.expected_occupancy).label("total_students"),
    ).filter(Schedule.organization_id == org_id).group_by(
        Schedule.day_of_week, Schedule.start_time, Schedule.end_time
    ).order_by(Schedule.day_of_week, Schedule.start_time).all()

    total_campus_capacity = db.query(func.sum(Resource.capacity)).filter(
        Resource.organization_id == org_id, Resource.status == "Active"
    ).scalar() or 2000

    points = []
    for day, start_t, end_t, avg_s, c_count, tot_s in schedules:
        tot_students = float(tot_s or 0.0)
        util_pct = round((tot_students / total_campus_capacity) * 100.0, 1)
        points.append(
            PeakDemandPoint(
                day_of_week=day,
                time_slot=f"{start_t} - {end_t}",
                avg_occupancy=round(float(avg_s or 0.0), 1),
                utilization_percent=util_pct,
                classes_count=int(c_count),
            )
        )

    return points
