import pytest


def get_token(client, email: str):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


def test_workspaces_lifecycle_and_templates(client):
    admin_token = get_token(client, "admintest@nexus.edu")
    viewer_token = get_token(client, "viewertest@nexus.edu")

    # 1. Get templates (viewer allowed)
    tpl_res = client.get("/api/v1/workspaces/templates", headers={"Authorization": f"Bearer {viewer_token}"})
    assert tpl_res.status_code == 200
    templates = tpl_res.json()
    assert len(templates) >= 5
    assert any(t["template_id"] == "equipment_assets" for t in templates)
    assert any(t["template_id"] == "education_campus" for t in templates)

    # 2. List workspaces (ensures default exists)
    ws_res = client.get("/api/v1/workspaces", headers={"Authorization": f"Bearer {viewer_token}"})
    assert ws_res.status_code == 200
    workspaces = ws_res.json()
    assert len(workspaces) >= 1
    default_ws = workspaces[0]
    assert default_ws["name"] is not None

    # 3. Viewer attempts to create workspace -> 403
    forbidden_res = client.post(
        "/api/v1/workspaces",
        headers={"Authorization": f"Bearer {viewer_token}"},
        json={"name": "Forbidden WS", "code": "FORBID-01", "workspace_type": "factory"},
    )
    assert forbidden_res.status_code == 403

    # 4. Admin creates workspace
    create_res = client.post(
        "/api/v1/workspaces",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Robotics Assembly Plant",
            "code": "ROB-PLANT-1",
            "workspace_type": "factory",
            "description": "Industrial automated facility",
            "location": "North Zone",
            "primary_goals": ["Achieve 99% Uptime", "Zero Line Collisions"],
        },
    )
    assert create_res.status_code == 201
    new_ws = create_res.json()
    assert new_ws["code"] == "ROB-PLANT-1"
    assert new_ws["workspace_type"] == "factory"

    # 5. Get workspace detail
    get_res = client.get(f"/api/v1/workspaces/{new_ws['id']}", headers={"Authorization": f"Bearer {viewer_token}"})
    assert get_res.status_code == 200
    assert get_res.json()["id"] == new_ws["id"]

    # 6. Admin updates workspace
    update_res = client.put(
        f"/api/v1/workspaces/{new_ws['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"description": "Updated robotics plant description"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["description"] == "Updated robotics plant description"


def test_goals_crud_and_tracking(client):
    admin_token = get_token(client, "admintest@nexus.edu")
    viewer_token = get_token(client, "viewertest@nexus.edu")

    # 1. Admin creates goal
    create_res = client.post(
        "/api/v1/goals",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "title": "Reduce Peak Energy Consumption by 20%",
            "goal_type": "reduce_cost",
            "target_value": 20.0,
            "unit": "%",
            "baseline_value": 0.0,
            "current_value": 8.5,
            "timeframe": "Q4 2026",
            "status": "In Progress",
            "priority": "High",
            "description": "Peak shaving initiative across operational equipment",
        },
    )
    assert create_res.status_code == 201
    goal = create_res.json()
    assert goal["title"] == "Reduce Peak Energy Consumption by 20%"

    # 2. Viewer lists goals
    list_res = client.get("/api/v1/goals", headers={"Authorization": f"Bearer {viewer_token}"})
    assert list_res.status_code == 200
    goals = list_res.json()
    assert len(goals) >= 1

    # 3. Update goal progress
    update_res = client.put(
        f"/api/v1/goals/{goal['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"current_value": 14.2, "status": "In Progress"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["current_value"] == 14.2

    # 4. Delete goal
    del_res = client.delete(f"/api/v1/goals/{goal['id']}", headers={"Authorization": f"Bearer {admin_token}"})
    assert del_res.status_code == 204


def test_universal_search(client):
    viewer_token = get_token(client, "viewertest@nexus.edu")

    # Search for a term that should match resources or types
    res = client.get("/api/v1/search?q=SCI", headers={"Authorization": f"Bearer {viewer_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "resources" in data
    assert "anomalies" in data
    assert "scenarios" in data
    assert "actions" in data
    assert "goals" in data
