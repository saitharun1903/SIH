"""
NEXUS - Anomaly Detection Service Layer
Connects database telemetry with the Isolation Forest ML Pipeline.
"""

import json
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc

from app.models import (
    Anomaly,
    Resource,
    Building,
    Schedule,
    OccupancyRecord,
    EnergyUsage,
    User,
)
from app.ml.anomaly_detector import IsolationForestDetector, AnomalyEvent
from app.schemas.anomaly import AnomalySummaryResponse, ContributingFactor


def run_detection_job(
    db: Session,
    org_id: int,
    resource_id: Optional[int] = None,
    building_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    contamination: float = 0.05,
) -> List[Anomaly]:
    """
    Extracts institutional telemetry, engineers features, executes Isolation Forest and rule detectors,
    and persists detected anomalies to the database with full audit trail.
    """
    # 1. Fetch relevant resources
    res_query = db.query(Resource).filter(Resource.organization_id == org_id, Resource.status == "Active")
    if resource_id:
        res_query = res_query.filter(Resource.id == resource_id)
    if building_id:
        res_query = res_query.filter(Resource.building_id == building_id)

    resources = res_query.all()
    if not resources:
        return []

    res_map = {r.id: r for r in resources}
    res_ids = list(res_map.keys())

    # 2. Fetch Occupancy records
    occ_query = db.query(OccupancyRecord).filter(OccupancyRecord.resource_id.in_(res_ids))
    if start_date:
        occ_query = occ_query.filter(OccupancyRecord.timestamp >= start_date)
    if end_date:
        occ_query = occ_query.filter(OccupancyRecord.timestamp <= end_date)
    occ_records = occ_query.all()

    # 3. Fetch Energy records
    energy_query = db.query(EnergyUsage).filter(EnergyUsage.resource_id.in_(res_ids))
    if start_date:
        energy_query = energy_query.filter(EnergyUsage.timestamp >= start_date)
    if end_date:
        energy_query = energy_query.filter(EnergyUsage.timestamp <= end_date)
    energy_records = energy_query.all()

    # 4. Fetch Schedules to determine expected occupancy
    schedules = db.query(Schedule).filter(Schedule.resource_id.in_(res_ids)).all()

    # Build schedule lookup by (resource_id, day_of_week)
    sched_lookup: Dict[int, List[Schedule]] = {}
    for s in schedules:
        sched_lookup.setdefault(s.resource_id, []).append(s)

    # 5. Build combined rows
    # Index energy by (resource_id, timestamp)
    energy_map: Dict[Tuple[int, datetime], float] = {}
    for e in energy_records:
        energy_map[(e.resource_id, e.timestamp)] = e.consumption

    # Index occupancy by (resource_id, timestamp)
    occ_map: Dict[Tuple[int, datetime], int] = {}
    for o in occ_records:
        occ_map[(o.resource_id, o.timestamp)] = o.occupancy

    all_keys = set(energy_map.keys()) | set(occ_map.keys())
    if not all_keys:
        return []

    rows = []
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    for r_id, ts in all_keys:
        res = res_map.get(r_id)
        if not res:
            continue

        actual_occ = occ_map.get((r_id, ts), 0)
        energy_kwh = energy_map.get((r_id, ts), 0.0)

        # Match schedule for expected occupancy
        day_str = day_names[ts.weekday()]
        time_str = ts.strftime("%H:%M")
        exp_occ = 0

        res_scheds = sched_lookup.get(r_id, [])
        for s in res_scheds:
            if s.day_of_week == day_str and s.start_time <= time_str <= s.end_time:
                exp_occ = s.expected_occupancy
                break

        rows.append({
            "resource_id": r_id,
            "capacity": res.capacity,
            "timestamp": ts,
            "actual_occupancy": actual_occ,
            "expected_occupancy": exp_occ,
            "energy_kwh": energy_kwh,
        })

    df = pd.DataFrame(rows)

    # 6. Run Isolation Forest & Rule Detector
    detector = IsolationForestDetector(contamination=contamination)
    events: List[AnomalyEvent] = detector.run_detection_pipeline(df)

    # 7. Persist to DB without duplicates
    saved_anomalies: List[Anomaly] = []
    for ev in events:
        # Check if already exists
        existing = db.query(Anomaly).filter(
            Anomaly.organization_id == org_id,
            Anomaly.resource_id == ev.resource_id,
            Anomaly.timestamp == ev.timestamp,
            Anomaly.anomaly_type == ev.anomaly_type,
        ).first()

        if existing:
            saved_anomalies.append(existing)
            continue

        factors_json = json.dumps([f for f in ev.contributing_factors])

        anomaly_db = Anomaly(
            organization_id=org_id,
            resource_id=ev.resource_id,
            metric_type=ev.metric_type,
            anomaly_type=ev.anomaly_type,
            timestamp=ev.timestamp,
            expected_value=ev.expected_value,
            actual_value=ev.actual_value,
            deviation_percent=ev.deviation_percent,
            severity=ev.severity,
            reason=ev.reason,
            contributing_factors=factors_json,
            status="Active",
        )
        db.add(anomaly_db)
        saved_anomalies.append(anomaly_db)

    db.commit()
    for a in saved_anomalies:
        db.refresh(a)

    return saved_anomalies


def get_anomalies(
    db: Session,
    org_id: int,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    metric_type: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    building_id: Optional[int] = None,
    resource_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[Dict[str, Any]], int]:
    """Query anomalies with resource, building, and contributing factors details."""
    query = db.query(Anomaly).join(Resource, Anomaly.resource_id == Resource.id).outerjoin(Building, Resource.building_id == Building.id)
    query = query.filter(Anomaly.organization_id == org_id)

    if status and status.lower() != "all":
        query = query.filter(func.lower(Anomaly.status) == status.lower())
    if severity and severity.lower() != "all":
        query = query.filter(func.lower(Anomaly.severity) == severity.lower())
    if metric_type and metric_type.lower() != "all":
        query = query.filter(func.lower(Anomaly.metric_type) == metric_type.lower())
    if anomaly_type and anomaly_type.lower() != "all":
        query = query.filter(func.lower(Anomaly.anomaly_type) == anomaly_type.lower())
    if resource_id:
        query = query.filter(Anomaly.resource_id == resource_id)
    if building_id:
        query = query.filter(Resource.building_id == building_id)

    total_count = query.count()
    items = query.order_by(desc(Anomaly.timestamp)).offset(offset).limit(limit).all()

    results = []
    for a in items:
        factors = []
        if a.contributing_factors:
            try:
                factors = json.loads(a.contributing_factors)
            except Exception:
                factors = []

        results.append({
            "id": a.id,
            "organization_id": a.organization_id,
            "resource_id": a.resource_id,
            "resource_name": a.resource.name if a.resource else None,
            "resource_code": a.resource.code if a.resource else None,
            "building_name": a.resource.building.name if a.resource and a.resource.building else "Main Campus",
            "metric_type": a.metric_type,
            "anomaly_type": a.anomaly_type,
            "timestamp": a.timestamp,
            "expected_value": a.expected_value,
            "actual_value": a.actual_value,
            "deviation_percent": a.deviation_percent,
            "severity": a.severity,
            "reason": a.reason,
            "contributing_factors": factors,
            "status": a.status,
            "resolved_by": a.resolved_by,
            "resolution_notes": a.resolution_notes,
            "resolved_at": a.resolved_at,
            "created_at": a.created_at,
        })

    return results, total_count


def get_anomaly_summary(db: Session, org_id: int) -> AnomalySummaryResponse:
    """Calculate real-time anomaly counts, breakdowns by type/severity, and financial impact."""
    anomalies = db.query(Anomaly).filter(Anomaly.organization_id == org_id).all()

    total = len(anomalies)
    critical = sum(1 for a in anomalies if a.severity == "Critical")
    high = sum(1 for a in anomalies if a.severity == "High")
    medium = sum(1 for a in anomalies if a.severity == "Medium")
    low = sum(1 for a in anomalies if a.severity == "Low")

    active = sum(1 for a in anomalies if a.status == "Active")
    acknowledged = sum(1 for a in anomalies if a.status == "Acknowledged")
    resolved = sum(1 for a in anomalies if a.status == "Resolved")
    dismissed = sum(1 for a in anomalies if a.status == "Dismissed")

    by_type: Dict[str, int] = {}
    wasted_kwh = 0.0
    for a in anomalies:
        by_type[a.anomaly_type] = by_type.get(a.anomaly_type, 0) + 1
        if a.anomaly_type == "phantom_energy" and a.status in ("Active", "Acknowledged"):
            wasted_kwh += max(a.actual_value - a.expected_value, 0.0)

    # Cost calculation based on institutional tariff (₹8.50 per kWh)
    financial_loss = wasted_kwh * 8.50

    return AnomalySummaryResponse(
        total_anomalies=total,
        critical_count=critical,
        high_count=high,
        medium_count=medium,
        low_count=low,
        active_count=active,
        acknowledged_count=acknowledged,
        resolved_count=resolved,
        dismissed_count=dismissed,
        by_type=by_type,
        estimated_wasted_kwh=round(wasted_kwh, 1),
        estimated_financial_loss=round(financial_loss, 2),
    )


def update_anomaly_status(
    db: Session,
    anomaly_id: int,
    org_id: int,
    user_id: int,
    status: str,
    resolution_notes: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Update lifecycle status of an anomaly (Acknowledge, Resolve, Dismiss) with user attribution."""
    anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id, Anomaly.organization_id == org_id).first()
    if not anomaly:
        return None

    anomaly.status = status
    if resolution_notes:
        anomaly.resolution_notes = resolution_notes

    if status in ("Resolved", "Dismissed"):
        anomaly.resolved_by = user_id
        anomaly.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(anomaly)

    factors = []
    if anomaly.contributing_factors:
        try:
            factors = json.loads(anomaly.contributing_factors)
        except Exception:
            factors = []

    return {
        "id": anomaly.id,
        "organization_id": anomaly.organization_id,
        "resource_id": anomaly.resource_id,
        "resource_name": anomaly.resource.name if anomaly.resource else None,
        "resource_code": anomaly.resource.code if anomaly.resource else None,
        "building_name": anomaly.resource.building.name if anomaly.resource and anomaly.resource.building else "Main Campus",
        "metric_type": anomaly.metric_type,
        "anomaly_type": anomaly.anomaly_type,
        "timestamp": anomaly.timestamp,
        "expected_value": anomaly.expected_value,
        "actual_value": anomaly.actual_value,
        "deviation_percent": anomaly.deviation_percent,
        "severity": anomaly.severity,
        "reason": anomaly.reason,
        "contributing_factors": factors,
        "status": anomaly.status,
        "resolved_by": anomaly.resolved_by,
        "resolution_notes": anomaly.resolution_notes,
        "resolved_at": anomaly.resolved_at,
        "created_at": anomaly.created_at,
    }
