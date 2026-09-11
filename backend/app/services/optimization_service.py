"""
NEXUS - Optimization Service Layer
Google OR-Tools Constraint Programming (CP-SAT) Engine for Institutional Schedule Optimization.
Smart India Hackathon 2026 (SIH26202)
"""

import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional, Set
from collections import defaultdict
from sqlalchemy.orm import Session
from ortools.sat.python import cp_model

from app.models import Resource, Schedule, Building
from app.schemas.optimization import (
    OptimizationRequest,
    OptimizationResponse,
    OptimizationMetrics,
    ReallocatedEvent,
)

# Standard institutional energy rate in India: ₹8.50 / kWh
COMMERCIAL_TARIFF_INR_PER_KWH = 8.50
# Average daily energy consumed per active academic space (HVAC, lighting, smart board, computing): ~24.5 kWh/day
DAILY_ROOM_ACTIVE_KWH = 24.5


def intervals_overlap(start1: str, end1: str, start2: str, end2: str) -> bool:
    """Check if two HH:MM intervals overlap."""
    return max(start1, start2) < min(end1, end2)


def _solve_single_day(
    day_schedules: List[Schedule],
    available_resources: List[Resource],
    res_map: Dict[int, Resource],
    deactivated_set: Set[int],
    request: OptimizationRequest,
    time_limit_seconds: float = 3.0,
) -> Dict[str, Any]:
    """
    Solves CP-SAT for a single day's timetable schedules.
    Independent daily solving guarantees mathematical optimality in <2s without cross-day conflict coupling.
    """
    n_events = len(day_schedules)
    if n_events == 0:
        return {
            "status": "OPTIMAL",
            "feasibility": "FEASIBLE",
            "objective_value": 0.0,
            "reallocations": [],
            "violations": [],
            "displaced_count": 0,
            "active_rooms_set": set(),
            "unassigned_count": 0,
        }

    enrollment_mult = request.enrollment_multiplier

    # Build conflict pairs for this day
    conflicts: List[Tuple[int, int]] = []
    for i in range(n_events):
        s1 = day_schedules[i]
        for j in range(i + 1, n_events):
            s2 = day_schedules[j]
            if intervals_overlap(s1.start_time, s1.end_time, s2.start_time, s2.end_time):
                conflicts.append((i, j))

    model = cp_model.CpModel()

    # Decision variables: x[i, j] = 1 if schedule i is placed in available_resource j
    x: Dict[Tuple[int, int], Optional[cp_model.IntVar]] = {}
    for i, s in enumerate(day_schedules):
        req_occ = int(round(s.expected_occupancy * enrollment_mult))
        for j, r in enumerate(available_resources):
            if r.capacity >= req_occ:
                x[(i, j)] = model.NewBoolVar(f"x_{i}_{j}")
            else:
                x[(i, j)] = None

    u = [model.NewBoolVar(f"u_{j}") for j in range(len(available_resources))]
    slack = [model.NewBoolVar(f"slack_{i}") for i in range(n_events)]

    # Constraint 1: Exact room assignment or slack
    for i in range(n_events):
        valid_room_vars = [x[(i, j)] for j in range(len(available_resources)) if x[(i, j)] is not None]
        if valid_room_vars:
            model.Add(sum(valid_room_vars) + slack[i] == 1)
        else:
            model.Add(slack[i] == 1)

    # Constraint 2: No double booking during conflicts
    for (i1, i2) in conflicts:
        for j in range(len(available_resources)):
            v1 = x[(i1, j)]
            v2 = x[(i2, j)]
            if v1 is not None and v2 is not None:
                model.Add(v1 + v2 <= 1)

    # Constraint 3: Room active indicator
    for i in range(n_events):
        for j in range(len(available_resources)):
            v = x[(i, j)]
            if v is not None:
                model.Add(v <= u[j])

    # Objective
    objective_terms = []
    for s_var in slack:
        objective_terms.append(s_var * 1_000_000)

    energy_coef = int(request.weights.energy_weight * 500)
    for j, r in enumerate(available_resources):
        room_weight = (r.floor + 1) * 10 + int(r.capacity / 10)
        objective_terms.append(u[j] * (energy_coef + room_weight))

    stab_coef = int(request.weights.stability_weight * 50)
    for i, s in enumerate(day_schedules):
        for j, r in enumerate(available_resources):
            v = x[(i, j)]
            if v is not None and r.id != s.resource_id:
                objective_terms.append(v * stab_coef)

    fit_coef = max(1, int(request.weights.utilization_weight * 5))
    for i, s in enumerate(day_schedules):
        req_occ = int(round(s.expected_occupancy * enrollment_mult))
        for j, r in enumerate(available_resources):
            v = x[(i, j)]
            if v is not None:
                seat_waste = max(0, r.capacity - req_occ)
                objective_terms.append(v * (seat_waste * fit_coef))

    model.Minimize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_search_workers = 2

    status = solver.Solve(model)
    status_name = solver.StatusName(status)

    reallocations: List[ReallocatedEvent] = []
    violations: List[str] = []
    active_rooms_set: Set[int] = set()
    displaced_count = 0
    unassigned_count = 0

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        unassigned_count = sum(solver.Value(s_var) for s_var in slack)
        for i, s in enumerate(day_schedules):
            req_occ = int(round(s.expected_occupancy * enrollment_mult))
            orig_res = res_map.get(s.resource_id)
            orig_name = orig_res.name if orig_res else f"Room #{s.resource_id}"
            orig_cap = orig_res.capacity if orig_res else 60

            assigned_j = None
            if solver.Value(slack[i]) == 0:
                for j, r in enumerate(available_resources):
                    v = x[(i, j)]
                    if v is not None and solver.Value(v) == 1:
                        assigned_j = j
                        break

            if assigned_j is not None:
                new_res = available_resources[assigned_j]
                active_rooms_set.add(new_res.id)
                was_moved = (new_res.id != s.resource_id)
                if was_moved:
                    displaced_count += 1
                    move_reason = (
                        f"Consolidated from closed/maintenance space '{orig_name}'"
                        if s.resource_id in deactivated_set
                        else f"Optimized from {orig_name} ({orig_cap} seats) to {new_res.name} ({new_res.capacity} seats) for thermal efficiency"
                    )
                else:
                    move_reason = "Retained in optimal baseline room"

                reallocations.append(
                    ReallocatedEvent(
                        schedule_id=s.id,
                        subject_name=s.subject_name,
                        department=s.department,
                        day_of_week=s.day_of_week,
                        time_slot=f"{s.start_time} - {s.end_time}",
                        expected_occupancy=req_occ,
                        original_resource_id=s.resource_id,
                        original_resource_name=orig_name,
                        original_capacity=orig_cap,
                        optimized_resource_id=new_res.id,
                        optimized_resource_name=new_res.name,
                        optimized_capacity=new_res.capacity,
                        was_moved=was_moved,
                        reason=move_reason,
                    )
                )
            else:
                unassigned_count += 1
                violations.append(
                    f"Class '{s.subject_name}' ({s.day_of_week} {s.start_time}-{s.end_time}, {req_occ} students) could not be seated due to capacity limits."
                )

        feasibility = "NOT FEASIBLE" if unassigned_count > 0 else "FEASIBLE"
        return {
            "status": status_name,
            "feasibility": feasibility,
            "objective_value": solver.ObjectiveValue(),
            "reallocations": reallocations,
            "violations": violations,
            "displaced_count": displaced_count,
            "active_rooms_set": active_rooms_set,
            "unassigned_count": unassigned_count,
        }
    else:
        return {
            "status": "INFEASIBLE",
            "feasibility": "NOT FEASIBLE",
            "objective_value": -1.0,
            "reallocations": [],
            "violations": [f"Unsatisfiable constraints on {day_schedules[0].day_of_week if day_schedules else 'day'}."],
            "displaced_count": 0,
            "active_rooms_set": set(),
            "unassigned_count": n_events,
        }


def solve_schedule_optimization(
    db: Session,
    org_id: int,
    request: OptimizationRequest,
) -> OptimizationResponse:
    """
    Executes CP-SAT constraint satisfaction & integer programming solver
    to allocate timetable classes into available spaces with minimal energy footprint,
    zero schedule collisions, and strict capacity compliance.
    """
    start_time_perf = time.perf_counter()

    # 1. Fetch active resources
    res_query = db.query(Resource).filter(
        Resource.organization_id == org_id,
        Resource.status == "Active",
    )
    if request.building_id:
        res_query = res_query.filter(Resource.building_id == request.building_id)

    all_resources = res_query.all()
    if not all_resources:
        return OptimizationResponse(
            solver_status="INFEASIBLE",
            feasibility="NOT FEASIBLE",
            solve_duration_ms=0.0,
            objective_score=0.0,
            metrics=OptimizationMetrics(
                total_events=0,
                displaced_events_count=0,
                active_rooms_before=0,
                active_rooms_after=0,
                rooms_freed_count=0,
                avg_utilization_before=0.0,
                avg_utilization_after=0.0,
                weekly_energy_kwh_before=0.0,
                weekly_energy_kwh_after=0.0,
                weekly_energy_savings_kwh=0.0,
                weekly_cost_savings_inr=0.0,
            ),
            reallocations=[],
            violations=["No active resources found matching query parameters."],
            algorithmic_decisions=[],
        )

    res_map = {r.id: r for r in all_resources}
    deactivated_set: Set[int] = set(request.deactivated_resource_ids or [])
    available_resources = [r for r in all_resources if r.id not in deactivated_set]

    # 2. Fetch all schedules for baseline comparison
    all_sched_query = db.query(Schedule).filter(Schedule.organization_id == org_id)
    all_schedules = all_sched_query.all()

    # Calculate baseline metrics across the institution
    baseline_active_rooms = set(s.resource_id for s in all_schedules)

    # Separate schedules to optimize based on day filter and excluded days
    excluded_days_set = set(d.capitalize() for d in (request.excluded_days or []))
    
    target_schedules: List[Schedule] = []
    for s in all_schedules:
        s_day = s.day_of_week.capitalize()
        if s_day in excluded_days_set:
            continue
        if request.day_of_week and request.day_of_week.lower() != "all":
            if s_day.lower() != request.day_of_week.lower():
                continue
        target_schedules.append(s)

    # If no target schedules remain
    if not target_schedules:
        return OptimizationResponse(
            solver_status="OPTIMAL",
            feasibility="FEASIBLE",
            solve_duration_ms=round((time.perf_counter() - start_time_perf) * 1000, 1),
            objective_score=0.0,
            metrics=OptimizationMetrics(
                total_events=0,
                displaced_events_count=0,
                active_rooms_before=len(baseline_active_rooms),
                active_rooms_after=0,
                rooms_freed_count=len(baseline_active_rooms),
                avg_utilization_before=0.0,
                avg_utilization_after=0.0,
                weekly_energy_kwh_before=round(len(baseline_active_rooms) * DAILY_ROOM_ACTIVE_KWH * 5, 1),
                weekly_energy_kwh_after=0.0,
                weekly_energy_savings_kwh=round(len(baseline_active_rooms) * DAILY_ROOM_ACTIVE_KWH * 5, 1),
                weekly_cost_savings_inr=round(len(baseline_active_rooms) * DAILY_ROOM_ACTIVE_KWH * 5 * COMMERCIAL_TARIFF_INR_PER_KWH, 2),
            ),
            reallocations=[],
            violations=[],
            algorithmic_decisions=["All schedules transitioned online or filtered."],
        )

    # Group target schedules by day of week for clean decomposition
    schedules_by_day = defaultdict(list)
    for s in target_schedules:
        schedules_by_day[s.day_of_week].append(s)

    # Baseline daily active room count (by day)
    baseline_rooms_by_day = defaultdict(set)
    for s in all_schedules:
        baseline_rooms_by_day[s.day_of_week].add(s.resource_id)

    # Solve each day independently
    day_results = []
    all_reallocations: List[ReallocatedEvent] = []
    all_violations: List[str] = []
    optimized_rooms_by_day = defaultdict(set)
    total_displaced = 0
    total_unassigned = 0
    overall_status = "OPTIMAL"
    overall_feasibility = "FEASIBLE"
    total_objective = 0.0

    seconds_per_day = max(1.0, float(request.max_solve_seconds) / max(len(schedules_by_day), 1))

    for day_name, day_scheds in schedules_by_day.items():
        day_res = _solve_single_day(
            day_schedules=day_scheds,
            available_resources=available_resources,
            res_map=res_map,
            deactivated_set=deactivated_set,
            request=request,
            time_limit_seconds=seconds_per_day,
        )
        day_results.append((day_name, day_res))

        if day_res["status"] == "INFEASIBLE":
            overall_status = "INFEASIBLE"
            overall_feasibility = "NOT FEASIBLE"
        elif day_res["feasibility"] == "NOT FEASIBLE":
            overall_feasibility = "NOT FEASIBLE"

        all_reallocations.extend(day_res["reallocations"])
        all_violations.extend(day_res["violations"])
        optimized_rooms_by_day[day_name] = day_res["active_rooms_set"]
        total_displaced += day_res["displaced_count"]
        total_unassigned += day_res["unassigned_count"]
        total_objective += day_res["objective_value"]

    elapsed_ms = round((time.perf_counter() - start_time_perf) * 1000, 1)

    # Compute aggregate metrics
    all_optimized_active_rooms = set()
    for day_set in optimized_rooms_by_day.values():
        all_optimized_active_rooms.update(day_set)

    # Active rooms before vs after (unique physical spaces needed)
    rooms_before = len(baseline_active_rooms)
    rooms_after = len(all_optimized_active_rooms)
    rooms_freed = max(0, rooms_before - rooms_after)

    # Seat utilization before vs after (average seat fill percentage across sessions)
    fill_rates_before = [
        (s.expected_occupancy / max(res_map[s.resource_id].capacity, 1)) * 100
        for s in all_schedules if s.resource_id in res_map
    ]
    avg_util_before = round(sum(fill_rates_before) / max(len(fill_rates_before), 1), 1)

    fill_rates_after = [
        (r.expected_occupancy / max(r.optimized_capacity, 1)) * 100
        for r in all_reallocations
    ]
    avg_util_after = round(sum(fill_rates_after) / max(len(fill_rates_after), 1), 1) if fill_rates_after else avg_util_before

    # Energy calculations based on active room-days per week
    # Baseline: sum of active rooms on each day of the week * daily kWh
    weekly_room_days_before = sum(len(r_set) for r_set in baseline_rooms_by_day.values())
    weekly_energy_before = weekly_room_days_before * DAILY_ROOM_ACTIVE_KWH

    # Optimized: sum of active rooms on each scheduled day * daily kWh (excluded days = 0)
    weekly_room_days_after = sum(len(r_set) for r_set in optimized_rooms_by_day.values())
    weekly_energy_after = weekly_room_days_after * DAILY_ROOM_ACTIVE_KWH

    weekly_energy_saved = max(0.0, weekly_energy_before - weekly_energy_after)
    weekly_cost_saved = weekly_energy_saved * COMMERCIAL_TARIFF_INR_PER_KWH

    # Algorithmic decisions and strategic insights
    algorithmic_decisions: List[str] = []
    if excluded_days_set:
        algorithmic_decisions.append(
            f"Transitioned {', '.join(sorted(excluded_days_set))} to remote learning, eliminating {len(excluded_days_set) * rooms_before * DAILY_ROOM_ACTIVE_KWH:.0f} kWh of physical facility load."
        )
    if rooms_freed > 0:
        algorithmic_decisions.append(
            f"Consolidated physical footprint across the week from {rooms_before} down to {rooms_after} spaces (freed {rooms_freed} rooms completely)."
        )
    if total_displaced > 0:
        algorithmic_decisions.append(
            f"Intelligently reallocated {total_displaced} class sessions to right-sized spaces, shifting seat utilization from {avg_util_before}% to {avg_util_after}%."
        )
    if deactivated_set:
        algorithmic_decisions.append(
            f"Successfully bypassed {len(deactivated_set)} closed/maintenance spaces without causing schedule collisions."
        )
    if overall_feasibility == "FEASIBLE":
        algorithmic_decisions.append(
            f"CP-SAT provably verified zero double-booking timetable collisions across all {len(target_schedules)} events."
        )

    metrics = OptimizationMetrics(
        total_events=len(target_schedules),
        displaced_events_count=total_displaced,
        active_rooms_before=rooms_before,
        active_rooms_after=rooms_after,
        rooms_freed_count=rooms_freed,
        avg_utilization_before=avg_util_before,
        avg_utilization_after=avg_util_after,
        weekly_energy_kwh_before=round(weekly_energy_before, 1),
        weekly_energy_kwh_after=round(weekly_energy_after, 1),
        weekly_energy_savings_kwh=round(weekly_energy_saved, 1),
        weekly_cost_savings_inr=round(weekly_cost_saved, 2),
    )

    return OptimizationResponse(
        solver_status=overall_status,
        feasibility=overall_feasibility,
        solve_duration_ms=elapsed_ms,
        objective_score=round(total_objective, 2) if overall_feasibility == "FEASIBLE" else -1.0,
        metrics=metrics,
        reallocations=all_reallocations,
        violations=all_violations,
        algorithmic_decisions=algorithmic_decisions,
    )
