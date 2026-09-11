"""
Tests for Phase 12 Institutional Reports & Compliance CSV Exports
"""

import pytest


def get_token(client, email: str = "viewertest@nexus.edu"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


def test_get_executive_summary_report(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/reports/executive-summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "institution" in data
    assert "infrastructure" in data
    assert "utilization" in data
    assert "energy" in data
    assert "operational_health" in data
    assert data["infrastructure"]["total_spaces"] >= 1
    assert data["energy"]["tariff_rate_inr_per_kwh"] == 8.50


def test_export_utilization_csv(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/reports/export/utilization-csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "Space ID,Space Name,Code" in res.text


def test_export_anomalies_csv(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/reports/export/anomalies-csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "Anomaly ID,Timestamp,Room Name" in res.text


def test_export_energy_csv(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/reports/export/energy-csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "Record ID,Timestamp,Room Name" in res.text
