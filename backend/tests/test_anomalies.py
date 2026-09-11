from datetime import datetime, timedelta, timezone
import pytest
import pandas as pd
from app.models import Resource, Schedule, OccupancyRecord, EnergyUsage, Anomaly
from app.ml.anomaly_detector import IsolationForestDetector


def get_token(client, email: str = "analysttest@nexus.edu"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


def get_viewer_token(client, email: str = "viewertest@nexus.edu"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


@pytest.fixture(scope="module", autouse=True)
def setup_anomaly_test_data():
    from tests.conftest import TestSessionLocal
    db = TestSessionLocal()

    now = datetime.now(timezone.utc)

    # Inject deliberate anomaly patterns into Resource 1 (capacity=60)
    # 1. Capacity Overload: 85 occupants in room of capacity 60
    db.add(OccupancyRecord(resource_id=1, timestamp=now - timedelta(hours=2), occupancy=85))
    db.add(EnergyUsage(resource_id=1, timestamp=now - timedelta(hours=2), consumption=25.0, cost=212.5))

    # 2. Phantom Energy: 18 kWh consumed with 0 occupants
    db.add(OccupancyRecord(resource_id=1, timestamp=now - timedelta(hours=4), occupancy=0))
    db.add(EnergyUsage(resource_id=1, timestamp=now - timedelta(hours=4), consumption=18.0, cost=153.0))

    # 3. Scheduled Class Ghosting: class expected 50 students, actual 0
    # Add a matching schedule for today's weekday
    day_name = now.strftime("%A")
    db.add(Schedule(
        organization_id=1,
        resource_id=1,
        subject_name="Anomaly Test Subject",
        department="Computer Science",
        day_of_week=day_name,
        start_time="00:00",
        end_time="23:59",
        expected_occupancy=50,
    ))

    # Normal baseline records for training
    for i in range(1, 20):
        db.add(OccupancyRecord(resource_id=1, timestamp=now - timedelta(days=i), occupancy=40))
        db.add(EnergyUsage(resource_id=1, timestamp=now - timedelta(days=i), consumption=10.0, cost=85.0))

    db.commit()
    db.close()


def test_ml_isolation_forest_detector_direct():
    detector = IsolationForestDetector(contamination=0.1)

    # Synthesize dataset
    now = datetime.now(timezone.utc)
    data = []
    # 20 normal points
    for i in range(20):
        data.append({
            "resource_id": 1,
            "capacity": 60,
            "timestamp": now - timedelta(hours=i * 2),
            "actual_occupancy": 35,
            "expected_occupancy": 40,
            "energy_kwh": 8.0,
        })
    # 1 extreme phantom energy
    data.append({
        "resource_id": 1,
        "capacity": 60,
        "timestamp": now - timedelta(minutes=30),
        "actual_occupancy": 0,
        "expected_occupancy": 0,
        "energy_kwh": 22.0,
    })
    # 1 capacity overload
    data.append({
        "resource_id": 1,
        "capacity": 60,
        "timestamp": now - timedelta(minutes=15),
        "actual_occupancy": 95,
        "expected_occupancy": 50,
        "energy_kwh": 14.0,
    })

    df = pd.DataFrame(data)
    results = detector.run_detection_pipeline(df)

    assert len(results) >= 2
    types = [r.anomaly_type for r in results]
    assert "capacity_violation" in types
    assert "phantom_energy" in types


def test_trigger_detection_api(client):
    token = get_token(client)
    res = client.post(
        "/api/v1/anomalies/detect",
        json={"contamination": 0.08},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["count"] >= 2


def test_list_anomalies_api(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/anomalies?limit=20",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 2

    # Verify attributes of items
    item = data["items"][0]
    assert "resource_name" in item
    assert "severity" in item
    assert "anomaly_type" in item
    assert "contributing_factors" in item
    assert isinstance(item["contributing_factors"], list)


def test_anomaly_summary_api(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/anomalies/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    summary = res.json()
    assert "total_anomalies" in summary
    assert "critical_count" in summary
    assert "active_count" in summary
    assert "estimated_financial_loss" in summary
    assert summary["total_anomalies"] >= 2


def test_update_anomaly_lifecycle_status(client):
    token = get_token(client)
    # First get an active anomaly
    res = client.get(
        "/api/v1/anomalies?limit=1",
        headers={"Authorization": f"Bearer {token}"},
    )
    items = res.json()["items"]
    assert len(items) >= 1
    anomaly_id = items[0]["id"]

    # 1. Acknowledge anomaly
    res = client.patch(
        f"/api/v1/anomalies/{anomaly_id}/status",
        json={"status": "Acknowledged", "resolution_notes": "Facility manager notified."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    updated = res.json()
    assert updated["status"] == "Acknowledged"

    # 2. Resolve anomaly
    res = client.patch(
        f"/api/v1/anomalies/{anomaly_id}/status",
        json={"status": "Resolved", "resolution_notes": "HVAC shutdown schedule corrected in BMS."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    resolved = res.json()
    assert resolved["status"] == "Resolved"
    assert resolved["resolved_by"] is not None
    assert resolved["resolved_at"] is not None
    assert resolved["resolution_notes"] == "HVAC shutdown schedule corrected in BMS."


def test_anomaly_rbac_permissions(client):
    viewer_token = get_viewer_token(client)

    # Viewer can read anomalies
    res = client.get(
        "/api/v1/anomalies",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res.status_code == 200

    # Viewer cannot trigger ML detection (requires Analyst or Admin)
    res = client.post(
        "/api/v1/anomalies/detect",
        json={},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res.status_code == 403

    # Viewer cannot alter anomaly status
    res = client.patch(
        "/api/v1/anomalies/1/status",
        json={"status": "Resolved"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res.status_code == 403
