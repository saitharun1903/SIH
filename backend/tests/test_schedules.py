import pytest


def get_token(client, email: str):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


def test_schedule_lifecycle_and_conflict_detection(client):
    token = get_token(client, "analysttest@nexus.edu")

    # 1. Create schedule (Monday 09:00 - 10:00)
    sched1_res = client.post(
        "/api/v1/schedules",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "resource_id": 1,
            "subject_name": "Operating Systems",
            "department": "Computer Science",
            "day_of_week": "Monday",
            "start_time": "09:00",
            "end_time": "10:00",
            "expected_occupancy": 50,
        },
    )
    assert sched1_res.status_code == 200
    sched1 = sched1_res.json()
    assert sched1["subject_name"] == "Operating Systems"

    # 2. Attempt invalid time: start >= end -> 422
    invalid_time_res = client.post(
        "/api/v1/schedules",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "resource_id": 1,
            "subject_name": "Invalid Time Class",
            "department": "Computer Science",
            "day_of_week": "Monday",
            "start_time": "10:00",
            "end_time": "09:00",
            "expected_occupancy": 30,
        },
    )
    assert invalid_time_res.status_code == 422

    # 3. Attempt overlapping schedule (Monday 09:30 - 10:30) -> 409 Conflict
    conflict_res = client.post(
        "/api/v1/schedules",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "resource_id": 1,
            "subject_name": "Database Systems",
            "department": "Computer Science",
            "day_of_week": "Monday",
            "start_time": "09:30",
            "end_time": "10:30",
            "expected_occupancy": 45,
        },
    )
    assert conflict_res.status_code == 409
    assert "Timetable conflict" in conflict_res.json()["error"]["message"]

    # 4. Create non-conflicting schedule (Monday 10:00 - 11:00) -> 200
    sched2_res = client.post(
        "/api/v1/schedules",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "resource_id": 1,
            "subject_name": "Computer Networks",
            "department": "Computer Science",
            "day_of_week": "Monday",
            "start_time": "10:00",
            "end_time": "11:00",
            "expected_occupancy": 45,
        },
    )
    assert sched2_res.status_code == 200

    # 5. List schedules with day filter
    list_res = client.get(
        "/api/v1/schedules?day_of_week=Monday",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 2
