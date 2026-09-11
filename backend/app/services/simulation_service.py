"""
NEXUS - What-If Simulation Service Layer
Smart India Hackathon 2026 (SIH26202)
Manages institutional scenario state, policy mutations, CP-SAT solver execution,
before/after delta accounting, and persistence.
"""

import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
from sqlalchemy.orm import Session

from app.models import Scenario, ScenarioChange, ScenarioResult, Resource, Building, Schedule
from app.schemas.optimization import (
    ScenarioCreate,
    ScenarioChangeCreate,
    OptimizationRequest,
    OptimizationWeights,
    OptimizationResponse,
)
from app.services.optimization_service import solve_schedule_optimization


SCENARIO_TEMPLATES = [
    {
        "template_id": "close_aryabhata_tower",
        "title": "Aryabhata Tower HVAC/Solar Retrofit",
        "description": "Simulate deactivating all laboratories and lecture rooms in Aryabhata Tower for green energy infrastructure upgrades. Tests campus capacity to absorb displaced sessions.",
        "category": "Maintenance & Retrofit",
        "icon": "Building2",
        "default_changes": [
            {
                "change_type": "deactivate_building",
                "parameters": {"building_id": 3, "building_name": "Aryabhata Tower"},
            }
        ],
    },
    {
        "template_id": "enrollment_surge_15",
        "title": "+15% Academic Year Enrollment Surge",
        "description": "Stress-test campus room capacity by simulating a 15% increase in cohort size across all academic departments. Identifies bottlenecked lecture halls.",
        "category": "Capacity Stress Test",
        "icon": "TrendingUp",
        "default_changes": [
            {
                "change_type": "change_enrollment",
                "parameters": {"enrollment_multiplier": 1.15},
            }
        ],
    },
    {
        "template_id": "move_friday_online",
        "title": "Energy-Saver: Hybrid Remote Friday",
        "description": "Transition all Friday timetable sessions to remote/online synchronous delivery. Evaluates campus-wide thermal energy and power bill reductions.",
        "category": "Sustainability & Energy",
        "icon": "Zap",
        "default_changes": [
            {
                "change_type": "move_day_online",
                "parameters": {"day_of_week": "Friday"},
            }
        ],
    },
    {
        "template_id": "consolidate_visvesvaraya",
        "title": "Visvesvaraya Complex Off-Peak Consolidation",
        "description": "Deactivate auxiliary workshop spaces in Visvesvaraya Complex to concentrate lab sessions into primary academic facilities, minimizing HVAC idling.",
        "category": "Operational Efficiency",
        "icon": "Layers",
        "default_changes": [
            {
                "change_type": "deactivate_building",
                "parameters": {"building_id": 4, "building_name": "Visvesvaraya Complex"},
            }
        ],
    },
]


def get_scenario_templates() -> List[Dict[str, Any]]:
    """Returns curated institutional simulation templates."""
    return SCENARIO_TEMPLATES


def create_scenario(
    db: Session,
    org_id: int,
    user_id: int,
    payload: ScenarioCreate,
) -> Dict[str, Any]:
    """Creates a new scenario definition with associated change mutations."""
    scenario = Scenario(
        organization_id=org_id,
        name=payload.name,
        description=payload.description,
        base_period=payload.base_period,
        status="draft",
        created_by=user_id,
    )
    db.add(scenario)
    db.flush()

    # Add change records
    for ch in payload.changes:
        change_row = ScenarioChange(
            scenario_id=scenario.id,
            change_type=ch.change_type,
            target_resource_id=ch.target_resource_id,
            parameters_json=json.dumps(ch.parameters),
        )
        db.add(change_row)

    db.commit()
    db.refresh(scenario)
    return get_scenario(db, org_id, scenario.id)


def list_scenarios(db: Session, org_id: int) -> List[Dict[str, Any]]:
    """Lists all scenario definitions with their changes and latest simulation outcomes."""
    scenarios = (
        db.query(Scenario)
        .filter(Scenario.organization_id == org_id)
        .order_by(Scenario.created_at.desc())
        .all()
    )

    results = []
    for s in scenarios:
        formatted = _format_scenario(s)
        results.append(formatted)
    return results


def get_scenario(db: Session, org_id: int, scenario_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves single scenario with changes and all simulation results."""
    scenario = (
        db.query(Scenario)
        .filter(
            Scenario.id == scenario_id,
            Scenario.organization_id == org_id,
        )
        .first()
    )
    if not scenario:
        return None
    return _format_scenario(scenario)


def delete_scenario(db: Session, org_id: int, scenario_id: int) -> bool:
    """Deletes scenario and cascades to changes and results."""
    scenario = (
        db.query(Scenario)
        .filter(
            Scenario.id == scenario_id,
            Scenario.organization_id == org_id,
        )
        .first()
    )
    if not scenario:
        return False
    db.delete(scenario)
    db.commit()
    return True


def run_simulation(
    db: Session,
    org_id: int,
    scenario_id: int,
    day_of_week: Optional[str] = None,
    max_solve_seconds: int = 5,
) -> Dict[str, Any]:
    """
    Executes CP-SAT constraint optimization for a given scenario.
    Applies defined changes (building closures, enrollment surge, remote days),
    solves schedule allocation, computes before/after metrics, and stores the outcome.
    """
    scenario = (
        db.query(Scenario)
        .filter(
            Scenario.id == scenario_id,
            Scenario.organization_id == org_id,
        )
        .first()
    )
    if not scenario:
        raise ValueError(f"Scenario with ID {scenario_id} not found.")

    # Parse scenario changes
    deactivated_resource_ids: Set[int] = set()
    enrollment_multiplier = 1.0
    excluded_days: Set[str] = set()

    for ch in scenario.changes:
        params = json.loads(ch.parameters_json or "{}")

        if ch.change_type == "deactivate_resource":
            if ch.target_resource_id:
                deactivated_resource_ids.add(ch.target_resource_id)
            for rid in params.get("resource_ids", []):
                deactivated_resource_ids.add(int(rid))

        elif ch.change_type == "deactivate_building":
            b_id = params.get("building_id") or ch.target_resource_id
            if b_id:
                building_resources = (
                    db.query(Resource.id)
                    .filter(Resource.building_id == int(b_id), Resource.organization_id == org_id)
                    .all()
                )
                for (r_id,) in building_resources:
                    deactivated_resource_ids.add(r_id)

        elif ch.change_type == "deactivate_building_name":
            b_name = params.get("building_name")
            if b_name:
                b_row = db.query(Building).filter(Building.name.ilike(f"%{b_name}%"), Building.organization_id == org_id).first()
                if b_row:
                    building_resources = (
                        db.query(Resource.id)
                        .filter(Resource.building_id == b_row.id, Resource.organization_id == org_id)
                        .all()
                    )
                    for (r_id,) in building_resources:
                        deactivated_resource_ids.add(r_id)

        elif ch.change_type == "change_enrollment":
            mult = float(params.get("enrollment_multiplier", 1.0))
            enrollment_multiplier = max(0.5, min(2.5, mult))

        elif ch.change_type == "move_day_online":
            day = params.get("day_of_week") or "Friday"
            excluded_days.add(day.capitalize())

    # Build optimization request
    opt_req = OptimizationRequest(
        day_of_week=day_of_week,
        excluded_days=list(excluded_days) if excluded_days else None,
        deactivated_resource_ids=list(deactivated_resource_ids) if deactivated_resource_ids else None,
        enrollment_multiplier=enrollment_multiplier,
        weights=OptimizationWeights(
            energy_weight=0.40,
            utilization_weight=0.35,
            stability_weight=0.25,
        ),
        max_solve_seconds=max_solve_seconds,
    )

    # Solve via CP-SAT
    opt_resp = solve_schedule_optimization(db=db, org_id=org_id, request=opt_req)

    # Delta metrics calculation
    m = opt_resp.metrics
    delta_metrics = {
        "rooms_freed": m.rooms_freed_count,
        "rooms_before": m.active_rooms_before,
        "rooms_after": m.active_rooms_after,
        "utilization_delta_percent": round(m.avg_utilization_after - m.avg_utilization_before, 1),
        "utilization_before": m.avg_utilization_before,
        "utilization_after": m.avg_utilization_after,
        "weekly_energy_savings_kwh": m.weekly_energy_savings_kwh,
        "weekly_cost_savings_inr": m.weekly_cost_savings_inr,
        "displaced_events_count": m.displaced_events_count,
        "total_events": m.total_events,
    }

    # Generate actionable institutional recommendations
    recommendations: List[str] = list(opt_resp.algorithmic_decisions)
    if opt_resp.feasibility == "FEASIBLE":
        if m.weekly_cost_savings_inr > 0:
            monthly_inr = m.weekly_cost_savings_inr * 4.33
            recommendations.append(
                f"Implementing this allocation saves an estimated ₹{monthly_inr:,.0f} per month in electricity costs."
            )
        if m.rooms_freed_count > 0:
            recommendations.append(
                f"{m.rooms_freed_count} spaces can be safely designated for offline maintenance or complete HVAC shutdown."
            )
        if m.displaced_events_count == 0:
            recommendations.append("Optimal timetable achieved with zero disruption to current classroom assignments.")
    else:
        recommendations.append(
            "Feasibility Alert: The proposed scenario causes room deficits. Consider allowing hybrid online delivery or expanding evening slots."
        )

    # Persist simulation result in DB
    result_row = ScenarioResult(
        scenario_id=scenario.id,
        status="completed",
        feasibility=opt_resp.feasibility,
        objective_score=opt_resp.objective_score,
        before_metrics_json=json.dumps({
            "active_rooms": m.active_rooms_before,
            "avg_utilization": m.avg_utilization_before,
            "weekly_energy_kwh": m.weekly_energy_kwh_before,
        }),
        after_metrics_json=json.dumps({
            "active_rooms": m.active_rooms_after,
            "avg_utilization": m.avg_utilization_after,
            "weekly_energy_kwh": m.weekly_energy_kwh_after,
        }),
        constraint_results_json=json.dumps({
            "solver_status": opt_resp.solver_status,
            "solve_duration_ms": opt_resp.solve_duration_ms,
            "violations": opt_resp.violations,
            "reallocations": [r.model_dump() for r in opt_resp.reallocations[:150]],  # Store sample in DB
        }),
        recommendations_json=json.dumps(recommendations),
    )
    db.add(result_row)

    # Update scenario status
    scenario.status = "simulated"
    db.commit()
    db.refresh(result_row)

    return {
        "id": result_row.id,
        "scenario_id": scenario.id,
        "status": result_row.status,
        "feasibility": result_row.feasibility,
        "objective_score": result_row.objective_score,
        "solve_duration_ms": opt_resp.solve_duration_ms,
        "before_metrics": {
            "active_rooms": m.active_rooms_before,
            "avg_utilization": m.avg_utilization_before,
            "weekly_energy_kwh": m.weekly_energy_kwh_before,
        },
        "after_metrics": {
            "active_rooms": m.active_rooms_after,
            "avg_utilization": m.avg_utilization_after,
            "weekly_energy_kwh": m.weekly_energy_kwh_after,
        },
        "delta_metrics": delta_metrics,
        "reallocations": opt_resp.reallocations,
        "violations": opt_resp.violations,
        "recommendations": recommendations,
        "created_at": result_row.created_at,
    }


def _format_scenario(scenario: Scenario) -> Dict[str, Any]:
    """Helper to convert Scenario DB model with relations into dict."""
    changes = []
    for ch in scenario.changes:
        changes.append({
            "id": ch.id,
            "change_type": ch.change_type,
            "target_resource_id": ch.target_resource_id,
            "parameters": json.loads(ch.parameters_json or "{}"),
            "created_at": ch.created_at,
        })

    results = []
    for res in scenario.results:
        try:
            c_res = json.loads(res.constraint_results_json or "{}")
            reallocs = c_res.get("reallocations", [])
            violations = c_res.get("violations", [])
        except Exception:
            reallocs = []
            violations = []

        before_m = json.loads(res.before_metrics_json or "{}")
        after_m = json.loads(res.after_metrics_json or "{}")

        delta_m = {
            "rooms_freed": max(0, before_m.get("active_rooms", 0) - after_m.get("active_rooms", 0)),
            "utilization_delta_percent": round(after_m.get("avg_utilization", 0.0) - before_m.get("avg_utilization", 0.0), 1),
            "weekly_energy_savings_kwh": max(0.0, before_m.get("weekly_energy_kwh", 0.0) - after_m.get("weekly_energy_kwh", 0.0)),
        }

        results.append({
            "id": res.id,
            "status": res.status,
            "feasibility": res.feasibility,
            "objective_score": res.objective_score,
            "before_metrics": before_m,
            "after_metrics": after_m,
            "delta_metrics": delta_m,
            "reallocations": reallocs,
            "violations": violations,
            "recommendations": json.loads(res.recommendations_json or "[]"),
            "created_at": res.created_at,
        })

    return {
        "id": scenario.id,
        "organization_id": scenario.organization_id,
        "name": scenario.name,
        "description": scenario.description,
        "base_period": scenario.base_period,
        "status": scenario.status,
        "created_by": scenario.created_by,
        "created_at": scenario.created_at,
        "changes": changes,
        "results": results,
    }
