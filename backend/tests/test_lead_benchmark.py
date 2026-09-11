"""
NEXUS - Phase 3 LEAD Anomaly Benchmark Test Suite
Validates ground-truth ingestion, confusion matrix mathematics, detector comparisons, and RBAC endpoints.
"""

import pytest


def get_token(client, email: str):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


def test_lead_dataset_ingestion_and_rbac(client):
    admin_token = get_token(client, "admintest@nexus.edu")
    viewer_token = get_token(client, "viewertest@nexus.edu")

    # 1. Viewer cannot trigger ingestion -> 403
    res = client.post(
        "/api/v1/data-sources/ingest-lead",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res.status_code == 403

    # 2. Admin triggers LEAD ingestion -> 200
    res = client.post(
        "/api/v1/data-sources/ingest-lead",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["total_rows"] > 1000
    assert data["total_ground_truth_anomalies"] > 0
    assert "schema_hash" in data


def test_lead_benchmark_evaluation_and_metrics(client):
    analyst_token = get_token(client, "analysttest@nexus.edu")
    viewer_token = get_token(client, "viewertest@nexus.edu")

    # 1. Viewer retrieves benchmark report -> 200
    res = client.get(
        "/api/v1/anomalies/benchmark/report",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res.status_code == 200
    report = res.json()
    assert report["benchmark_name"] == "LEAD - Large-scale Energy Anomaly Detection"
    assert report["total_records"] > 0
    assert "detectors" in report
    assert "nexus_hybrid" in report["detectors"]
    assert "isolation_forest" in report["detectors"]
    assert "physical_rules" in report["detectors"]

    # Verify confusion matrix conservation invariant
    hybrid_cm = report["detectors"]["nexus_hybrid"]["confusion_matrix"]
    total_cm = hybrid_cm["tp"] + hybrid_cm["fp"] + hybrid_cm["tn"] + hybrid_cm["fn"]
    assert total_cm == report["total_records"]

    # Verify metric ranges
    hybrid_metrics = report["detectors"]["nexus_hybrid"]["metrics"]
    assert 0.0 <= hybrid_metrics["precision"] <= 1.0
    assert 0.0 <= hybrid_metrics["recall"] <= 1.0
    assert 0.0 <= hybrid_metrics["f1_score"] <= 1.0
    assert 0.0 <= hybrid_metrics["false_positive_rate"] <= 1.0
    assert 0.0 <= hybrid_metrics["accuracy"] <= 1.0

    # Verify typology breakdown
    assert "typology_breakdown" in report
    assert "spike" in report["typology_breakdown"]
    assert "off_hours_leakage" in report["typology_breakdown"]

    # 2. Viewer cannot trigger re-evaluation -> 403
    eval_res = client.post(
        "/api/v1/anomalies/benchmark/evaluate?contamination=0.03",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert eval_res.status_code == 403

    # 3. Analyst triggers evaluation -> 200
    eval_res = client.post(
        "/api/v1/anomalies/benchmark/evaluate?contamination=0.03",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["evaluation_parameters"]["selected_contamination"] == 0.03
    assert len(eval_data["sensitivity_analysis"]) >= 4
