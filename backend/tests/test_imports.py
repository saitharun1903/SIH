import io
import pytest
from app.models import Resource


def get_admin_token(client):
    res = client.post("/api/v1/auth/login", json={"email": "admintest@nexus.edu", "password": "Secret123"})
    return res.json()["access_token"]


def test_download_sample_template(client):
    res = client.get("/api/v1/imports/templates/resources")
    assert res.status_code == 200
    assert "resource_name" in res.text
    assert "capacity" in res.text


def test_file_inspection_and_import_flow(client):
    admin_token = get_admin_token(client)

    # 1. Create a sample CSV with non-standard column names and 1 invalid row
    csv_content = (
        "room_name,cap,level,state\n"
        "Advanced AI Studio,70,2,Active\n"
        "Cyber Warfare Lab,45,3,Active\n"
        "Broken Classroom,-15,1,Active\n"  # Invalid negative capacity
    ).encode("utf-8")

    # 2. Upload and inspect file
    upload_res = client.post(
        "/api/v1/imports/inspect",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("new_spaces.csv", io.BytesIO(csv_content), "text/csv")},
    )
    assert upload_res.status_code == 200
    inspection = upload_res.json()
    assert inspection["source_type"] == "CSV"
    assert inspection["detected_dataset_type"] == "resources"
    assert "cap" in inspection["suggested_mappings"]["capacity"]
    assert "room_name" in inspection["suggested_mappings"]["resource_name"]
    assert inspection["total_rows"] == 3

    file_id = inspection["file_id"]

    # 3. Confirm import with column mapping
    confirm_res = client.post(
        "/api/v1/imports/confirm",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "file_id": file_id,
            "dataset_type": "resources",
            "dataset_name": "Test Studio Import",
            "column_mapping": {
                "resource_name": "room_name",
                "code": "room_name",
                "capacity": "cap",
                "floor": "level",
                "status": "state",
            },
        },
    )
    assert confirm_res.status_code == 200
    summary = confirm_res.json()
    assert summary["rows_processed"] == 3
    assert summary["rows_imported"] == 2
    assert summary["rows_rejected"] == 1
    assert len(summary["errors"]) == 1
    assert summary["errors"][0]["row_number"] == 4
    assert "Invalid capacity value" in summary["errors"][0]["reason"]

    # 4. Download rejection error report
    job_id = summary["job_id"]
    err_report_res = client.get(
        f"/api/v1/imports/jobs/{job_id}/errors",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert err_report_res.status_code == 200
    assert "Row Number" in err_report_res.text
    assert "Broken Classroom" in err_report_res.text


def test_data_quality_summary(client):
    admin_token = get_admin_token(client)
    res = client.get(
        "/api/v1/data-quality/summary",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    dq = res.json()
    assert dq["total_resources"] >= 1
    assert "data_cleanliness_percent" in dq
    assert "is_forecast_ready" in dq
