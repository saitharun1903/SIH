"""
Tests for Phase 8 What-If Scenario Simulation Engine
"""

import pytest


def get_token(client, email: str = "analysttest@nexus.edu"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


def test_get_templates(client):
    token = get_token(client, "viewertest@nexus.edu")
    res = client.get(
        "/api/v1/scenarios/templates",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    templates = res.json()
    assert len(templates) >= 3
    template_ids = [t["template_id"] for t in templates]
    assert any("demand_surge" in tid or "enrollment_surge" in tid for tid in template_ids)
    assert any("consolidation" in tid or "move_friday" in tid for tid in template_ids)
    assert any("maintenance" in tid or "close_" in tid for tid in template_ids)


def test_create_and_simulate_scenario(client):
    analyst_token = get_token(client, "analysttest@nexus.edu")

    # 1. Create a scenario
    create_payload = {
        "name": "Summer Term Maintenance Simulation",
        "description": "Evaluate impact of closing Room 1 for repairs",
        "base_period": "Summer 2026",
        "changes": [
            {
                "change_type": "deactivate_resource",
                "target_resource_id": 1,
                "parameters": {"reason": "HVAC filter replacement"},
            }
        ],
    }
    create_res = client.post(
        "/api/v1/scenarios",
        json=create_payload,
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert create_res.status_code == 200
    scenario = create_res.json()
    scenario_id = scenario["id"]
    assert scenario["name"] == "Summer Term Maintenance Simulation"
    assert len(scenario["changes"]) == 1

    # 2. List scenarios
    list_res = client.get(
        "/api/v1/scenarios",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert list_res.status_code == 200
    scenarios = list_res.json()
    assert any(s["id"] == scenario_id for s in scenarios)

    # 3. Simulate scenario
    sim_res = client.post(
        f"/api/v1/scenarios/{scenario_id}/simulate?day_of_week=Monday",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["status"] == "completed"
    assert "feasibility" in sim_data
    assert "delta_metrics" in sim_data
    assert "recommendations" in sim_data

    # 4. Get scenario details (should now have status 'simulated' and result)
    get_res = client.get(
        f"/api/v1/scenarios/{scenario_id}",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert get_res.status_code == 200
    updated_scenario = get_res.json()
    assert updated_scenario["status"] == "simulated"
    assert len(updated_scenario["results"]) >= 1

    # 5. Delete scenario
    del_res = client.delete(
        f"/api/v1/scenarios/{scenario_id}",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True
