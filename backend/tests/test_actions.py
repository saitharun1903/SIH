"""
Tests for Phase 10 Action Center & Operational Recommendations
"""

import pytest


def get_token(client, email: str = "analysttest@nexus.edu"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


def test_recommendations_generation_and_listing(client):
    token = get_token(client, "analysttest@nexus.edu")

    # 1. Trigger generation
    gen_res = client.post(
        "/api/v1/actions/recommendations/generate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert gen_res.status_code == 200
    recs = gen_res.json()
    assert len(recs) >= 1
    rec = recs[0]
    assert "title" in rec
    assert "problem_description" in rec
    assert "recommended_action" in rec
    assert "estimated_impact" in rec
    assert rec["status"] == "Active"

    # 2. List recommendations
    list_res = client.get(
        "/api/v1/actions/recommendations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1


def test_recommendation_lifecycle_apply_and_audit(client):
    token = get_token(client, "analysttest@nexus.edu")

    # Get active rec
    list_res = client.get(
        "/api/v1/actions/recommendations?status=Active",
        headers={"Authorization": f"Bearer {token}"},
    )
    recs = list_res.json()
    assert len(recs) >= 1
    rec_id = recs[0]["id"]

    # Apply recommendation
    apply_res = client.post(
        f"/api/v1/actions/recommendations/{rec_id}/apply",
        json={"notes": "Approved by Facilities Director."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert apply_res.status_code == 200
    assert apply_res.json()["new_status"] == "Applied"

    # Check audit log
    audit_res = client.get(
        "/api/v1/actions/audit-log",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert any(log["action"] == "RECOMMENDATION_APPLIED" for log in logs)


def test_recommendation_simulation_trigger(client):
    token = get_token(client, "analysttest@nexus.edu")

    list_res = client.get(
        "/api/v1/actions/recommendations",
        headers={"Authorization": f"Bearer {token}"},
    )
    recs = list_res.json()
    assert len(recs) >= 1
    rec_id = recs[0]["id"]

    sim_res = client.post(
        f"/api/v1/actions/recommendations/{rec_id}/simulate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert sim_res.status_code == 200
    data = sim_res.json()
    assert "simulation" in data
    assert "feasibility" in data["simulation"]
    assert "delta_metrics" in data["simulation"]
