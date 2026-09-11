"""
Unit Tests for NEXUS Multi-Source Hybrid Intelligence & Co-Optimization Engine
Smart India Hackathon 2026 (SIH26202)
"""

from datetime import datetime, timedelta, timezone
import pytest
from app.models import Schedule, EnergyUsage, OccupancyRecord, Resource, Building
from app.services.multi_source_intelligence_service import (
    check_multi_source_data_availability,
    get_multi_source_cross_correlation,
    get_diurnal_multi_layer_profile,
    detect_timetable_stress_collisions,
    dispatch_multi_source_recommendations,
)


def get_token(client, email: str = "admintest@nexus.edu"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


def seed_multi_source_test_data(db):
    """Seed test database with schedules, energy, and occupancy telemetry."""
    bldg = db.query(Building).first()
    res = db.query(Resource).first()

    # 1. Add schedules
    if db.query(Schedule).count() == 0:
        s1 = Schedule(
            organization_id=1,
            resource_id=res.id,
            subject_name="AI Systems (CS)",
            department="Computer Science",
            day_of_week="Monday",
            start_time="14:00",
            end_time="15:00",
            expected_occupancy=18,  # Underutilized in 60-seat hall
        )
        s2 = Schedule(
            organization_id=1,
            resource_id=res.id,
            subject_name="Data Structures (CS)",
            department="Computer Science",
            day_of_week="Tuesday",
            start_time="10:00",
            end_time="11:00",
            expected_occupancy=50,
        )
        db.add_all([s1, s2])

    # 2. Add telemetry for correlation testing
    now = datetime(2026, 9, 1, 0, 0, 0)
    for i in range(48):
        ts = now + timedelta(hours=i)
        eu = EnergyUsage(
            resource_id=res.id,
            building_id=bldg.id,
            timestamp=ts,
            consumption=120.0 + (ts.hour * 5.5),
            unit="kWh",
        )
        occ = OccupancyRecord(
            resource_id=res.id,
            timestamp=ts,
            occupancy=max(0, int(15 + (ts.hour * 1.5))),
            source="sensor",
        )
        db.add_all([eu, occ])

    db.commit()


def test_insufficient_data_guard_when_empty(db):
    """When data is missing, the service must report INSUFFICIENT_DATA rather than inventing fake results."""
    # Ensure schedules table is empty for this isolated check if not seeded
    if db.query(Schedule).count() == 0:
        availability = check_multi_source_data_availability(db)
        assert availability["is_sufficient"] is False
        assert availability["data_sufficiency_status"] == "INSUFFICIENT_DATA"
        assert len(availability["missing_streams"]) > 0

        # Cross correlation should return unavailable
        corr = get_multi_source_cross_correlation(db)
        assert corr["status"] == "unavailable"


def test_cross_source_correlation_mathematics(db):
    """After seeding data, verify mathematical properties of the 5x5 correlation matrix."""
    seed_multi_source_test_data(db)

    res = get_multi_source_cross_correlation(db)
    assert res["status"] == "calculated"
    assert res["sample_size"] >= 10
    assert len(res["feature_keys"]) == 5
    assert len(res["matrix"]) == 5

    # Check diagonal elements = 1.0 and symmetry
    for i, row in enumerate(res["matrix"]):
        assert pytest.approx(row["values"][i], abs=1e-3) == 1.0
        for j in range(5):
            val_ij = row["values"][j]
            val_ji = res["matrix"][j]["values"][i]
            assert pytest.approx(val_ij, abs=1e-3) == val_ji
            assert -1.0 <= val_ij <= 1.0


def test_diurnal_multi_layer_profile_bounds(db):
    profile = get_diurnal_multi_layer_profile(db)
    assert len(profile) == 24
    for i, pt in enumerate(profile):
        assert pt["hour"] == i
        assert 0.0 <= pt["composite_stress_index"] <= 1.0
        assert pt["regional_grid_mw"] > 0.0
        assert -40.0 <= pt["air_temperature_c"] <= 60.0
        assert pt["cooling_degree_days"] >= 0.0


def test_timetable_stress_collisions_logic(db):
    seed_multi_source_test_data(db)
    collisions = detect_timetable_stress_collisions(db, threshold=0.30, max_results=10)
    assert isinstance(collisions, list)
    if collisions:
        top = collisions[0]
        assert "current_room" in top
        assert "cssi" in top
        assert 0.0 <= top["cssi"] <= 1.0
        assert "stress_drivers" in top
        assert "estimated_savings" in top
        assert top["estimated_savings"]["energy_reduction_kwh"] >= 0.0
        assert top["estimated_savings"]["tariff_savings_inr"] >= 0.0


def test_multi_source_intelligence_api_endpoints(client, db):
    seed_multi_source_test_data(db)

    # 1. Viewer can view GET multi-source-intelligence
    viewer_token = get_token(client, email="viewertest@nexus.edu")
    res = client.get(
        "/api/v1/analytics/multi-source-intelligence?threshold=0.30",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "data_availability" in data
    assert "cross_source_correlation" in data
    assert "diurnal_multi_layer_profile" in data
    assert "timetable_stress_collisions" in data
    assert "metadata" in data

    # 2. Viewer cannot trigger POST dispatch -> 403
    res_viewer_post = client.post(
        "/api/v1/analytics/multi-source/dispatch",
        json={},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res_viewer_post.status_code == 403

    # 3. Admin can trigger POST dispatch -> 200
    admin_token = get_token(client, email="admintest@nexus.edu")
    res_admin_post = client.post(
        "/api/v1/analytics/multi-source/dispatch",
        json={},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin_post.status_code == 200
    dispatch_data = res_admin_post.json()
    assert "status" in dispatch_data
    assert "dispatched_count" in dispatch_data
