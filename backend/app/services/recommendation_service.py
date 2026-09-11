"""
NEXUS - Action Center & Recommendation Service Layer
Synthesizes real-time anomaly detection, utilization audits, and simulation insights
into operational action items with verifiable ROI and audit logging.
Smart India Hackathon 2026 (SIH26202)
"""

import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models import (
    Recommendation,
    AuditLog,
    Resource,
    Building,
    Anomaly,
    ResourceUsage,
    EnergyUsage,
    Schedule,
    Scenario,
)
from app.services.simulation_service import create_scenario, run_simulation
from app.schemas.optimization import ScenarioCreate, ScenarioChangeCreate


def generate_recommendations(db: Session, org_id: int) -> List[Recommendation]:
    """
    Scans anomalies, energy waste, underutilized spaces, and overcapacity rooms
    to synthesize actionable high-impact institutional recommendations.
    """
    # 1. Check for active critical or high anomalies (phantom energy, off-hours breach)
    active_anomalies = (
        db.query(Anomaly)
        .filter(
            Anomaly.organization_id == org_id,
            Anomaly.status == "Active",
            Anomaly.severity.in_(["Critical", "High"]),
        )
        .order_by(Anomaly.deviation_percent.desc())
        .limit(10)
        .all()
    )

    existing_titles = set(
        r.title for r in db.query(Recommendation.title).filter(Recommendation.organization_id == org_id).all()
    )

    new_recs: List[Recommendation] = []

    # Phantom energy / severe anomaly recommendations
    for anom in active_anomalies:
        res = db.query(Resource).filter(Resource.id == anom.resource_id).first()
        res_name = res.name if res else f"Room #{anom.resource_id}"
        bldg_name = res.building.name if res and res.building else "Academic Facility"

        if anom.anomaly_type == "phantom_energy":
            title = f"Curtail Phantom Energy in {res_name}"
            if title not in existing_titles:
                monthly_loss = round(anom.actual_value * 24 * 30 * 8.50, 0)
                rec = Recommendation(
                    organization_id=org_id,
                    resource_id=anom.resource_id,
                    recommendation_type="energy_waste",
                    priority=anom.severity,
                    title=title,
                    problem_description=f"Persistent unoccupied HVAC/lighting power draw ({anom.actual_value:.1f} kWh vs baseline {anom.expected_value:.1f} kWh) detected in {res_name} ({bldg_name}).",
                    recommended_action=f"Deploy smart relay power cut-off or schedule BMS sensor recalibration for {res_name}.",
                    estimated_impact_json=json.dumps({
                        "monthly_savings_inr": monthly_loss,
                        "weekly_energy_savings_kwh": round(anom.actual_value * 24 * 7, 1),
                        "co2_reduction_kg": round(anom.actual_value * 24 * 30 * 0.82, 0),
                    }),
                    evidence_json=json.dumps({
                        "anomaly_id": anom.id,
                        "deviation_percent": anom.deviation_percent,
                        "timestamp": anom.timestamp.isoformat(),
                    }),
                    status="Active",
                )
                new_recs.append(rec)
                existing_titles.add(title)

    # 2. Check for persistent underutilization (<40% seat fill)
    underutilized_resources = (
        db.query(Resource)
        .filter(Resource.organization_id == org_id, Resource.status == "Active")
        .limit(15)
        .all()
    )

    for r in underutilized_resources:
        # Check if resource has schedules with low occupancy
        schedules = db.query(Schedule).filter(Schedule.resource_id == r.id).all()
        if schedules:
            avg_occupancy = sum(s.expected_occupancy for s in schedules) / len(schedules)
            fill_rate = (avg_occupancy / max(r.capacity, 1)) * 100
            if fill_rate < 40.0:
                title = f"Consolidate Underutilized {r.name}"
                if title not in existing_titles:
                    weekly_kwh = 140.0  # ~20 kWh/day
                    rec = Recommendation(
                        organization_id=org_id,
                        resource_id=r.id,
                        recommendation_type="underutilization",
                        priority="High" if fill_rate < 25.0 else "Medium",
                        title=title,
                        problem_description=f"{r.name} has a low seat fill rate of {fill_rate:.1f}% ({avg_occupancy:.0f} students in a {r.capacity}-seat room across {len(schedules)} timetable sessions).",
                        recommended_action=f"Consolidate classes into smaller adjacent rooms and place {r.name} in low-power maintenance mode.",
                        estimated_impact_json=json.dumps({
                            "monthly_savings_inr": round(weekly_kwh * 4.33 * 8.50, 0),
                            "weekly_energy_savings_kwh": weekly_kwh,
                            "rooms_freed": 1,
                        }),
                        evidence_json=json.dumps({
                            "fill_rate_percent": round(fill_rate, 1),
                            "capacity": r.capacity,
                            "avg_occupancy": round(avg_occupancy, 1),
                        }),
                        status="Active",
                    )
                    new_recs.append(rec)
                    existing_titles.add(title)

    # 3. Macro institutional policy: Hybrid Remote Friday
    if "Implement Campus-Wide Remote Friday Policy" not in existing_titles:
        rec_friday = Recommendation(
            organization_id=org_id,
            resource_id=None,
            recommendation_type="policy_optimization",
            priority="High",
            title="Implement Campus-Wide Remote Friday Policy",
            problem_description="Friday facility operations consume ~1,350 kWh across campus with sub-peak attendance. Moving lectures remote eliminates Friday thermal footprint.",
            recommended_action="Designate Fridays as synchronous remote learning days to shut down HVAC and lighting across academic buildings.",
            estimated_impact_json=json.dumps({
                "monthly_savings_inr": 122000.0,
                "weekly_energy_savings_kwh": 3356.5,
                "rooms_freed": 6,
            }),
            evidence_json=json.dumps({
                "source": "CP-SAT Multi-day Simulation",
                "feasibility": "FEASIBLE",
            }),
            status="Active",
        )
        new_recs.append(rec_friday)
        existing_titles.add(rec_friday.title)

    if new_recs:
        db.add_all(new_recs)
        db.commit()

    return list_recommendations(db, org_id)


def list_recommendations(
    db: Session,
    org_id: int,
    status: Optional[str] = None,
    priority: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Returns formatted list of recommendations with target resource metadata."""
    query = db.query(Recommendation).filter(Recommendation.organization_id == org_id)
    if status and status.lower() != "all":
        query = query.filter(Recommendation.status == status)
    if priority and priority.lower() != "all":
        query = query.filter(Recommendation.priority == priority)

    recs = query.order_by(Recommendation.created_at.desc()).all()

    results = []
    for r in recs:
        res_info = None
        if r.resource_id:
            res = db.query(Resource).filter(Resource.id == r.resource_id).first()
            if res:
                res_info = {
                    "id": res.id,
                    "name": res.name,
                    "code": res.code,
                    "building_name": res.building.name if res.building else None,
                    "capacity": res.capacity,
                }

        results.append({
            "id": r.id,
            "organization_id": r.organization_id,
            "resource_id": r.resource_id,
            "resource": res_info,
            "recommendation_type": r.recommendation_type,
            "priority": r.priority,
            "title": r.title,
            "problem_description": r.problem_description,
            "recommended_action": r.recommended_action,
            "estimated_impact": json.loads(r.estimated_impact_json or "{}"),
            "evidence": json.loads(r.evidence_json or "{}"),
            "status": r.status,
            "created_at": r.created_at,
        })
    return results


def update_recommendation_status(
    db: Session,
    org_id: int,
    user_id: int,
    rec_id: int,
    new_status: str,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Applies or dismisses an action item and records an immutable audit log entry."""
    rec = (
        db.query(Recommendation)
        .filter(Recommendation.id == rec_id, Recommendation.organization_id == org_id)
        .first()
    )
    if not rec:
        raise ValueError(f"Recommendation #{rec_id} not found.")

    old_status = rec.status
    rec.status = new_status

    # Create audit log record
    audit = AuditLog(
        organization_id=org_id,
        user_id=user_id,
        action=f"RECOMMENDATION_{new_status.upper()}",
        entity_type="recommendation",
        entity_id=rec.id,
        metadata_json=json.dumps({
            "title": rec.title,
            "previous_status": old_status,
            "new_status": new_status,
            "notes": notes,
        }),
    )
    db.add(audit)
    db.commit()
    db.refresh(rec)

    return {
        "success": True,
        "recommendation_id": rec.id,
        "new_status": rec.status,
        "message": f"Recommendation successfully marked as {new_status}.",
    }


def simulate_recommendation(
    db: Session,
    org_id: int,
    user_id: int,
    rec_id: int,
) -> Dict[str, Any]:
    """
    Automatically translates an operational recommendation into a What-If Scenario,
    launches the CP-SAT solver, and returns comparative validation.
    """
    rec = (
        db.query(Recommendation)
        .filter(Recommendation.id == rec_id, Recommendation.organization_id == org_id)
        .first()
    )
    if not rec:
        raise ValueError(f"Recommendation #{rec_id} not found.")

    changes = []
    if rec.recommendation_type == "policy_optimization" or "Remote Friday" in rec.title:
        changes.append(
            ScenarioChangeCreate(
                change_type="move_day_online",
                parameters={"day_of_week": "Friday"},
            )
        )
    elif rec.resource_id:
        changes.append(
            ScenarioChangeCreate(
                change_type="deactivate_resource",
                target_resource_id=rec.resource_id,
                parameters={"reason": f"Operational Action: {rec.title}"},
            )
        )
    else:
        changes.append(
            ScenarioChangeCreate(
                change_type="change_enrollment",
                parameters={"enrollment_multiplier": 1.10},
            )
        )

    # 1. Create scenario
    scenario = create_scenario(
        db=db,
        org_id=org_id,
        user_id=user_id,
        payload=ScenarioCreate(
            name=f"Action Verification: {rec.title}",
            description=f"Simulating policy implementation for {rec.title}",
            base_period="Fall 2026",
            changes=changes,
        ),
    )

    # 2. Run simulation
    sim_result = run_simulation(db=db, org_id=org_id, scenario_id=scenario["id"])

    # 3. Log to audit
    audit = AuditLog(
        organization_id=org_id,
        user_id=user_id,
        action="RECOMMENDATION_SIMULATED",
        entity_type="scenario",
        entity_id=scenario["id"],
        metadata_json=json.dumps({
            "recommendation_id": rec.id,
            "scenario_id": scenario["id"],
            "feasibility": sim_result["feasibility"],
            "energy_saved_kwh": sim_result["delta_metrics"]["weekly_energy_savings_kwh"],
        }),
    )
    db.add(audit)
    db.commit()

    return {
        "recommendation_id": rec.id,
        "scenario_id": scenario["id"],
        "simulation": sim_result,
    }


def get_audit_logs(db: Session, org_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves recent institutional audit log actions."""
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.organization_id == org_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "metadata": json.loads(log.metadata_json or "{}"),
            "created_at": log.created_at,
        }
        for log in logs
    ]
