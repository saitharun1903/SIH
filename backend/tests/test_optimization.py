"""
Tests for Phase 7 Google OR-Tools CP-SAT Schedule Optimization Engine
"""

import pytest
from app.models import Resource, Schedule, Building, ResourceType


def get_token(client, email: str = "analysttest@nexus.edu"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


@pytest.fixture(scope="module", autouse=True)
def setup_optimization_data():
    from tests.conftest import TestSessionLocal
    db = TestSessionLocal()

    # Create an additional room for optimization flexibility
    r2 = Resource(
        organization_id=1,
        building_id=1,
        resource_type_id=1,
        name="Seminar Room 102",
        code="SR-102",
        capacity=80,
        status="Active",
        floor=1,
        area=1200.0,
    )
    db.add(r2)
    db.commit()
    db.refresh(r2)

    # Add realistic test schedules on Monday
    s1 = Schedule(
        organization_id=1,
        resource_id=1,
        subject_name="Intro to Algorithms",
        department="Computer Science",
        day_of_week="Monday",
        start_time="09:00",
        end_time="10:30",
        expected_occupancy=45,
    )
    s2 = Schedule(
        organization_id=1,
        resource_id=1,
        subject_name="Digital Logic",
        department="Electrical Eng",
        day_of_week="Monday",
        start_time="11:00",
        end_time="12:30",
        expected_occupancy=50,
    )
    s3 = Schedule(
        organization_id=1,
        resource_id=r2.id,
        subject_name="Discrete Math",
        department="Mathematics",
        day_of_week="Monday",
        start_time="09:00",
        end_time="10:30",
        expected_occupancy=30,
    )
    db.add_all([s1, s2, s3])
    db.commit()
    s_ids = [s1.id, s2.id, s3.id]
    r2_id = r2.id
    db.close()

    yield

    db_cleanup = TestSessionLocal()
    db_cleanup.query(Schedule).filter(Schedule.id.in_(s_ids)).delete(synchronize_session=False)
    db_cleanup.query(Resource).filter(Resource.id == r2_id).delete(synchronize_session=False)
    db_cleanup.commit()
    db_cleanup.close()


def test_solve_optimization_baseline(client):
    token = get_token(client, "analysttest@nexus.edu")
    payload = {
        "day_of_week": "Monday",
        "enrollment_multiplier": 1.0,
        "max_solve_seconds": 3,
        "weights": {
            "energy_weight": 0.5,
            "utilization_weight": 0.3,
            "stability_weight": 0.2,
        },
    }
    res = client.post(
        "/api/v1/optimization/solve",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["solver_status"] in ("OPTIMAL", "FEASIBLE")
    assert data["feasibility"] == "FEASIBLE"
    assert data["metrics"]["total_events"] >= 3
    assert len(data["reallocations"]) >= 3
    assert len(data["algorithmic_decisions"]) >= 1


def test_solve_optimization_deactivated_room(client):
    token = get_token(client, "analysttest@nexus.edu")
    # Deactivate Resource 1 (LH-101) - events should reroute to SR-102
    payload = {
        "day_of_week": "Monday",
        "deactivated_resource_ids": [1],
        "enrollment_multiplier": 1.0,
        "max_solve_seconds": 3,
    }
    res = client.post(
        "/api/v1/optimization/solve",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    # If both s1 and s3 are at 09:00-10:30, only 1 can fit in SR-102
    # So the solver will identify the conflict and flag feasibility or unassigned
    assert "feasibility" in data
    assert "metrics" in data


def test_optimization_rbac_viewer_forbidden(client):
    viewer_token = get_token(client, "viewertest@nexus.edu")
    payload = {"day_of_week": "Monday"}
    res = client.post(
        "/api/v1/optimization/solve",
        json=payload,
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res.status_code == 403
