import pytest


def get_token(client, email: str):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


def test_data_sources_listing_and_rbac(client):
    admin_token = get_token(client, "admintest@nexus.edu")
    viewer_token = get_token(client, "viewertest@nexus.edu")

    # 1. Viewer lists data sources
    res = client.get("/api/v1/data-sources", headers={"Authorization": f"Bearer {viewer_token}"})
    assert res.status_code == 200
    sources = res.json()
    assert isinstance(sources, list)

    # 2. Viewer tries to register a data source -> 403 Forbidden
    res = client.post(
        "/api/v1/data-sources",
        headers={"Authorization": f"Bearer {viewer_token}"},
        json={
            "name": "Unauthorized Dataset",
            "provider": "Test",
            "dataset_url": "https://example.com",
            "license": "MIT",
        },
    )
    assert res.status_code == 403

    # 3. Admin registers a new data source -> 201 Created
    res = client.post(
        "/api/v1/data-sources",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "ASHRAE Weather Test Sub-set",
            "provider": "Kaggle",
            "dataset_url": "https://www.kaggle.com/competitions/ashrae-energy-prediction/data",
            "license": "Competition Data License",
            "description": "Meteorological data aligned with building meter readings",
            "version": "1.0",
            "status": "Registered",
        },
    )
    assert res.status_code == 201
    created_id = res.json()["id"]

    # 4. Conflict on duplicate name -> 409
    res = client.post(
        "/api/v1/data-sources",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "ASHRAE Weather Test Sub-set",
            "provider": "Kaggle",
            "dataset_url": "https://www.kaggle.com/competitions/ashrae-energy-prediction/data",
            "license": "Competition Data License",
        },
    )
    assert res.status_code == 409

    # 5. Update data source status -> 200
    res = client.patch(
        f"/api/v1/data-sources/{created_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "Imported", "row_count": 14500},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "Imported"
    assert res.json()["row_count"] == 14500


def test_ashrae_ingestion_and_profiling(client):
    admin_token = get_token(client, "admintest@nexus.edu")
    viewer_token = get_token(client, "viewertest@nexus.edu")

    # 1. Viewer cannot trigger ingestion -> 403
    res = client.post(
        "/api/v1/data-sources/ingest-ashrae",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res.status_code == 403

    # 2. Admin triggers ingestion for 3 educational buildings over 14 days
    res = client.post(
        "/api/v1/data-sources/ingest-ashrae?limit_buildings=3&days_limit=14",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["records_ingested"] > 0
    assert data["buildings_count"] == 3

    # 3. Viewer retrieves profiling report -> 200
    report_res = client.get(
        "/api/v1/data-sources/profiling-report",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert report_res.status_code == 200
    report = report_res.json()
    assert report["dataset_name"] == "ASHRAE - Great Energy Predictor III"
    assert report["total_rows"] > 0
    assert report["unique_buildings_count"] > 0
    assert "meter_reading_stats" in report
    assert "Education" in report["primary_use_distribution"]

