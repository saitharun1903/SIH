import pytest


def get_token(client, email: str):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


def test_buildings_crud(client):
    admin_token = get_token(client, "admintest@nexus.edu")
    viewer_token = get_token(client, "viewertest@nexus.edu")

    # 1. Viewer lists buildings
    res = client.get("/api/v1/buildings", headers={"Authorization": f"Bearer {viewer_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert any(b["code"] == "SCI-01" for b in data["items"])

    # 2. Viewer attempts to create building -> 403
    create_res = client.post(
        "/api/v1/buildings",
        headers={"Authorization": f"Bearer {viewer_token}"},
        json={"name": "Engineering Block", "code": "ENG-01", "location": "East", "floor_count": 4},
    )
    assert create_res.status_code == 403

    # 3. Admin creates building -> 200
    create_res = client.post(
        "/api/v1/buildings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Engineering Block", "code": "ENG-01", "location": "East", "floor_count": 4},
    )
    assert create_res.status_code == 200
    new_bldg = create_res.json()
    assert new_bldg["code"] == "ENG-01"

    # 4. Duplicate building code -> 409
    dup_res = client.post(
        "/api/v1/buildings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Duplicate Block", "code": "ENG-01", "location": "East", "floor_count": 2},
    )
    assert dup_res.status_code == 409


def test_resources_crud(client):
    admin_token = get_token(client, "admintest@nexus.edu")

    # 1. Admin creates a resource
    res = client.post(
        "/api/v1/resources",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "building_id": 1,
            "resource_type_id": 1,
            "name": "Room 102",
            "code": "R-102",
            "capacity": 60,
            "status": "Active",
            "floor": 1,
            "area": 800.0,
            "location": "Ground Floor",
        },
    )
    assert res.status_code == 200
    created = res.json()
    assert created["code"] == "R-102"
    assert created["capacity"] == 60

    # 2. Filter resources by capacity
    filter_res = client.get(
        "/api/v1/resources?min_capacity=50",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert filter_res.status_code == 200
    assert filter_res.json()["total"] >= 1

    # 3. Update resource
    res_id = created["id"]
    update_res = client.put(
        f"/api/v1/resources/{res_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"capacity": 75},
    )
    assert update_res.status_code == 200
    assert update_res.json()["capacity"] == 75
