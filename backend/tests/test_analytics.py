from datetime import datetime, timedelta, timezone
import pytest
from app.models import ResourceUsage, EnergyUsage, OccupancyRecord


def get_token(client, email: str = "analysttest@nexus.edu"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


@pytest.fixture(scope="module", autouse=True)
def populate_sample_analytics_records():
    # Insert a few usage and energy records into the test database
    from tests.conftest import TestSessionLocal
    db = TestSessionLocal()

    now = datetime.now(timezone.utc)
    # Add usage records for Resource 1
    for i in range(5):
        ts = now - timedelta(days=i)
        db.add(ResourceUsage(resource_id=1, timestamp=ts, usage_value=35.0, utilization_percent=58.3))
        db.add(EnergyUsage(resource_id=1, timestamp=ts, consumption=18.5, cost=157.25))
        db.add(OccupancyRecord(resource_id=1, timestamp=ts, occupancy=35))

    db.commit()
    db.close()


def test_analytics_summary(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/analytics/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "overall_utilization_percent" in data
    assert "total_energy_kwh" in data
    assert "total_energy_cost" in data
    assert data["total_spaces_analyzed"] >= 1
    assert data["underutilized_threshold"] == 40.0
    assert data["overloaded_threshold"] == 90.0


def test_utilization_trends(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/analytics/utilization-trends",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    trends = res.json()
    assert len(trends) >= 1
    assert "avg_utilization" in trends[0]
    assert "peak_utilization" in trends[0]


def test_energy_trends(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/analytics/energy-trends",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    energy_points = res.json()
    assert len(energy_points) >= 1
    assert "consumption_kwh" in energy_points[0]
    assert "cost" in energy_points[0]


def test_building_comparison(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/analytics/building-comparison",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    bldgs = res.json()
    assert len(bldgs) >= 1
    assert "building_name" in bldgs[0]
    assert "avg_utilization" in bldgs[0]


def test_peak_demand(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/analytics/peak-demand",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_resource_rankings(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/analytics/resource-rankings",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    ranks = res.json()
    assert len(ranks) >= 1
    assert "status_category" in ranks[0]
    assert ranks[0]["status_category"] in ["Underutilized", "Optimal", "Overloaded"]
