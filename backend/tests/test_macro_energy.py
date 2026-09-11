"""
NEXUS - Phase 4 Macro-Energy & Weather Covariates Test Suite
Validates PJM ingestion, degree-day calculations, cross-correlations, and RBAC endpoints.
"""

import pytest


def get_token(client, email: str):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


def test_pjm_dataset_ingestion_and_rbac(client):
    admin_token = get_token(client, "admintest@nexus.edu")
    viewer_token = get_token(client, "viewertest@nexus.edu")

    # 1. Viewer cannot trigger PJM ingestion -> 403
    res = client.post(
        "/api/v1/data-sources/ingest-pjm",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res.status_code == 403

    # 2. Admin triggers PJM ingestion -> 200
    res = client.post(
        "/api/v1/data-sources/ingest-pjm",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["total_rows"] >= 1000
    assert data["mean_grid_load_mw"] > 0
    assert "schema_hash" in data


def test_macro_grid_trends_analytics(client):
    viewer_token = get_token(client, "viewertest@nexus.edu")

    # 1. Viewer retrieves macro grid trends -> 200
    res = client.get(
        "/api/v1/analytics/macro-grid-trends",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res.status_code == 200
    report = res.json()

    # Validate high-level statistics
    assert "statistics" in report
    stats = report["statistics"]
    assert stats["min_grid_load_mw"] < stats["mean_grid_load_mw"] < stats["max_grid_load_mw"]
    assert stats["total_cdd"] >= 0

    # Validate diurnal profile (24 hours)
    assert "diurnal_profile" in report
    assert len(report["diurnal_profile"]) == 24
    hours = [p["hour"] for p in report["diurnal_profile"]]
    assert hours == list(range(24))

    # Validate correlation values (-1.0 to 1.0)
    assert "correlations" in report
    corr = report["correlations"]
    assert -1.0 <= corr["temperature_vs_grid_load"] <= 1.0
    assert -1.0 <= corr["cdd_vs_grid_load"] <= 1.0
    assert corr["cdd_vs_grid_load"] > 0.5  # Significant positive correlation expected

    # Validate peak grid hours
    assert "grid_peak_hours" in report
    assert isinstance(report["grid_peak_hours"], list)
