"""
NEXUS - What-If Scenario Simulation API Endpoints
Phase 8 What-If Scenario Simulation & Policy Stress-Testing
Smart India Hackathon 2026 (SIH26202)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User
from app.api.deps import require_analyst, require_viewer
from app.schemas.optimization import (
    ScenarioCreate,
    ScenarioResponse,
    ScenarioResultResponse,
    ScenarioTemplate,
)
from app.services.simulation_service import (
    get_scenario_templates,
    create_scenario,
    list_scenarios,
    get_scenario,
    delete_scenario,
    run_simulation,
)

router = APIRouter()


@router.get(
    "/scenarios/templates",
    summary="Get Pre-configured Institutional Simulation Templates",
)
def get_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Returns curated templates for building maintenance, demand surges, and hybrid schedules."""
    return get_scenario_templates(db=db, org_id=current_user.organization_id)



@router.get(
    "/scenarios",
    summary="List All What-If Scenarios",
)
def get_all_scenarios(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Lists all created scenarios with their mutation parameters and latest simulation results."""
    return list_scenarios(db=db, org_id=current_user.organization_id)


@router.post(
    "/scenarios",
    summary="Create a What-If Scenario Definition",
)
def create_new_scenario(
    payload: ScenarioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """Creates a new institutional scenario definition with change mutations (closures, capacity shifts)."""
    return create_scenario(
        db=db,
        org_id=current_user.organization_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.get(
    "/scenarios/{scenario_id}",
    summary="Get Scenario Details and Execution History",
)
def get_scenario_by_id(
    scenario_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Retrieves full specification of a scenario and its complete historical simulation runs."""
    scenario = get_scenario(db=db, org_id=current_user.organization_id, scenario_id=scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@router.delete(
    "/scenarios/{scenario_id}",
    summary="Delete a What-If Scenario",
)
def remove_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """Deletes a scenario and its historical simulation results."""
    deleted = delete_scenario(db=db, org_id=current_user.organization_id, scenario_id=scenario_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {"success": True, "message": "Scenario successfully deleted"}


@router.post(
    "/scenarios/{scenario_id}/simulate",
    summary="Execute Simulation for a What-If Scenario",
)
def simulate_scenario_run(
    scenario_id: int,
    day_of_week: Optional[str] = Query(None, description="Optional single day filter (e.g. Monday)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """
    Executes CP-SAT constraint optimization against mutated institutional state.
    Calculates exact feasibility, displaced classes, thermal energy savings, and financial impact.
    """
    try:
        return run_simulation(
            db=db,
            org_id=current_user.organization_id,
            scenario_id=scenario_id,
            day_of_week=day_of_week,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")
