"""
NEXUS - Institutional Reports Service Layer
Generates audit-grade institutional summaries, compliance metrics,
and streaming CSV exports for regulatory and accreditation reviews.
Smart India Hackathon 2026 (SIH26202)
"""

import io
import csv
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import (
    Organization,
    Building,
    Resource,
    Schedule,
    Anomaly,
    EnergyUsage,
    ResourceUsage,
    Recommendation,
)


def get_executive_summary_report(db: Session, org_id: int) -> Dict[str, Any]:
    """Computes comprehensive institutional KPIs across space, energy, and scheduling."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    org_name = org.name if org else "Campus Institution"

    total_buildings = db.query(Building).filter(Building.organization_id == org_id).count()
    resources = db.query(Resource).filter(Resource.organization_id == org_id, Resource.status == "Active").all()
    total_spaces = len(resources)
    total_capacity = sum(r.capacity for r in resources)

    schedules = db.query(Schedule).filter(Schedule.organization_id == org_id).all()
    total_schedules = len(schedules)
    total_student_slots = sum(s.expected_occupancy for s in schedules)

    # Utilization breakdown
    underutilized_count = 0
    overloaded_count = 0
    fill_rates = []

    for r in resources:
        r_scheds = [s for s in schedules if s.resource_id == r.id]
        if r_scheds:
            avg_occ = sum(s.expected_occupancy for s in r_scheds) / len(r_scheds)
            fill_pct = (avg_occ / max(r.capacity, 1)) * 100
            fill_rates.append(fill_pct)
            if fill_pct < 40.0:
                underutilized_count += 1
            elif fill_pct > 90.0:
                overloaded_count += 1

    overall_seat_fill = round(sum(fill_rates) / max(len(fill_rates), 1), 1)

    # Energy KPIs
    total_energy_kwh = db.query(func.sum(EnergyUsage.consumption)).filter(
        EnergyUsage.resource_id.in_([r.id for r in resources])
    ).scalar() or 0.0

    total_energy_cost_inr = round(total_energy_kwh * 8.50, 2)

    # Anomaly metrics
    anomalies = db.query(Anomaly).filter(Anomaly.organization_id == org_id).all()
    total_anomalies = len(anomalies)
    critical_count = sum(1 for a in anomalies if a.severity in ("Critical", "High"))
    
    phantom_anomalies = [a for a in anomalies if a.anomaly_type == "phantom_energy"]
    phantom_wasted_kwh = sum(a.actual_value for a in phantom_anomalies)
    phantom_financial_loss = round(phantom_wasted_kwh * 8.50, 2)

    # Recommendations
    active_recs = db.query(Recommendation).filter(
        Recommendation.organization_id == org_id,
        Recommendation.status == "Active",
    ).count()

    return {
        "institution": {
            "name": org_name,
            "generated_at": datetime.now(timezone.utc).strftime("%B %d, %Y - %H:%M UTC"),
            "reporting_period": "Academic Year 2026-2027",
            "compliance_standard": "SIH26202 Smart Automation Framework",
        },
        "infrastructure": {
            "total_buildings": total_buildings,
            "total_spaces": total_spaces,
            "total_seat_capacity": total_capacity,
            "weekly_scheduled_sessions": total_schedules,
            "weekly_student_enplanements": total_student_slots,
        },
        "utilization": {
            "avg_seat_fill_percent": overall_seat_fill,
            "underutilized_spaces_count": underutilized_count,
            "overloaded_spaces_count": overloaded_count,
            "optimal_spaces_count": max(0, total_spaces - underutilized_count - overloaded_count),
        },
        "energy": {
            "total_energy_consumed_kwh": round(total_energy_kwh, 1),
            "total_commercial_cost_inr": total_energy_cost_inr,
            "tariff_rate_inr_per_kwh": 8.50,
            "phantom_energy_waste_kwh": round(phantom_wasted_kwh, 1),
            "phantom_financial_loss_inr": phantom_financial_loss,
        },
        "operational_health": {
            "total_anomalies_detected": total_anomalies,
            "critical_anomalies_count": critical_count,
            "active_action_recommendations": active_recs,
            "potential_annual_savings_inr": round(total_energy_cost_inr * 0.18, 0),  # ~18% CP-SAT target
        },
    }


def generate_utilization_csv(db: Session, org_id: int) -> str:
    """Streams CSV table of space utilization metrics."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Space ID", "Space Name", "Code", "Building", "Floor", "Capacity",
        "Scheduled Sessions", "Avg Students", "Seat Fill %", "Status Category"
    ])

    resources = db.query(Resource).filter(Resource.organization_id == org_id, Resource.status == "Active").all()
    for r in resources:
        scheds = db.query(Schedule).filter(Schedule.resource_id == r.id).all()
        avg_occ = (sum(s.expected_occupancy for s in scheds) / len(scheds)) if scheds else 0.0
        fill_pct = round((avg_occ / max(r.capacity, 1)) * 100, 1) if scheds else 0.0

        status = "Optimal"
        if fill_pct < 40.0:
            status = "Underutilized"
        elif fill_pct > 90.0:
            status = "Overloaded"

        writer.writerow([
            r.id,
            r.name,
            r.code,
            r.building.name if r.building else "Main",
            r.floor,
            r.capacity,
            len(scheds),
            round(avg_occ, 1),
            fill_pct,
            status,
        ])

    return output.getvalue()


def generate_anomalies_csv(db: Session, org_id: int) -> str:
    """Streams CSV table of all detected anomalies."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Anomaly ID", "Timestamp", "Room Name", "Building", "Metric Type",
        "Anomaly Type", "Expected Value", "Actual Value", "Deviation %", "Severity", "Status"
    ])

    anomalies = db.query(Anomaly).filter(Anomaly.organization_id == org_id).order_by(Anomaly.timestamp.desc()).all()
    for a in anomalies:
        res = db.query(Resource).filter(Resource.id == a.resource_id).first()
        writer.writerow([
            a.id,
            a.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            res.name if res else f"Room #{a.resource_id}",
            res.building.name if res and res.building else "Campus",
            a.metric_type,
            a.anomaly_type,
            a.expected_value,
            a.actual_value,
            a.deviation_percent,
            a.severity,
            a.status,
        ])

    return output.getvalue()


def generate_energy_csv(db: Session, org_id: int) -> str:
    """Streams CSV of energy telemetry."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Record ID", "Timestamp", "Room Name", "Consumption (kWh)", "Cost (INR)"])

    records = (
        db.query(EnergyUsage)
        .join(Resource, EnergyUsage.resource_id == Resource.id)
        .filter(Resource.organization_id == org_id)
        .order_by(EnergyUsage.timestamp.desc())
        .limit(1000)
        .all()
    )

    for rec in records:
        r = db.query(Resource).filter(Resource.id == rec.resource_id).first()
        writer.writerow([
            rec.id,
            rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            r.name if r else f"Room #{rec.resource_id}",
            rec.consumption,
            round(rec.consumption * 8.50, 2),
        ])

    return output.getvalue()
