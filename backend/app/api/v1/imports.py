import io
import json
import csv
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import User, ImportJob, Dataset
from app.schemas.dataset import (
    SchemaInspectionResponse,
    ImportConfirmRequest,
    ImportSummaryResponse,
    ImportJobResponse,
)
from app.schemas.common import PaginatedResponse
from app.api.deps import require_admin, require_viewer
from app.services.ingestion_service import (
    save_temp_upload,
    inspect_uploaded_file,
    process_import,
    DATASET_SPECS,
)

router = APIRouter()


@router.post("/imports/inspect", response_model=SchemaInspectionResponse, summary="Inspect Uploaded File & Detect Schema")
async def inspect_file(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
):
    """Upload a CSV or XLSX file to inspect columns, detect schema, and get mapping recommendations."""
    filename = file.filename or "uploaded_data.csv"
    ext = filename.split(".")[-1].lower()
    if ext not in ["csv", "xlsx", "xls"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a CSV (.csv) or Excel (.xlsx, .xls) file.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    if len(content) > 15 * 1024 * 1024:  # 15 MB limit
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum allowed upload limit of 15MB.",
        )

    file_id, saved_path, source_type = save_temp_upload(content, filename)
    try:
        inspection = inspect_uploaded_file(file_id, filename)
        return inspection
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to inspect file structure: {str(exc)}",
        )


@router.post("/imports/confirm", response_model=ImportSummaryResponse, summary="Confirm Column Mapping & Execute Import")
def confirm_import(
    request: ImportConfirmRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Submit finalized column mapping to validate records, import into database, and record rejected rows."""
    try:
        summary = process_import(
            db=db,
            org_id=admin.organization_id,
            user_id=admin.id,
            request=request,
        )
        return summary
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Uploaded file session has expired.")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Import failed: {str(exc)}")


@router.get("/imports/jobs", response_model=PaginatedResponse[ImportJobResponse], summary="List Ingestion Jobs")
def list_import_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = db.query(ImportJob, Dataset.name.label("dataset_name")).join(
        Dataset, Dataset.id == ImportJob.dataset_id
    ).filter(Dataset.organization_id == current_user.organization_id)

    total = query.count()
    offset = (page - 1) * page_size
    results = query.order_by(ImportJob.started_at.desc()).offset(offset).limit(page_size).all()

    items = []
    for job, d_name in results:
        j_dict = ImportJobResponse.model_validate(job).model_dump()
        j_dict["dataset_name"] = d_name
        items.append(ImportJobResponse(**j_dict))

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/imports/jobs/{id}/errors", summary="Download Ingestion Error Report (CSV)")
def download_error_report(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    job = db.query(ImportJob).join(Dataset).filter(
        ImportJob.id == id,
        Dataset.organization_id == current_user.organization_id,
    ).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import job not found")

    errors = json.loads(job.error_report or "[]")
    if not errors:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No error report recorded for this job.")

    # Generate CSV stream
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Row Number", "Rejection Reason", "Submitted Data"])
    for e in errors:
        writer.writerow([
            e.get("row_number", "N/A"),
            e.get("reason", "Unknown error"),
            json.dumps(e.get("raw_data", {})),
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=import_job_{id}_rejections.csv"},
    )


@router.get("/imports/templates/{dataset_type}", summary="Download Sample CSV Template")
def download_sample_template(dataset_type: str):
    if dataset_type not in DATASET_SPECS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown dataset type")

    spec = DATASET_SPECS[dataset_type]
    headers = [f["synonyms"][0] for f in spec["fields"]]

    # Provide a realistic sample row
    sample_rows = {
        "resources": [["Lecture Hall E-101", "E-101", "75", "Innovation Block", "1", "Active"]],
        "schedules": [["Advanced Machine Learning", "A-101", "Monday", "09:00", "10:30", "60", "Artificial Intelligence"]],
        "attendance": [["A-101", "2026-09-08 09:15:00", "58"]],
        "energy": [["A-101", "2026-09-08 10:00:00", "14.8", "125.80"]],
    }

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for r in sample_rows.get(dataset_type, []):
        writer.writerow(r)

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=template_{dataset_type}.csv"},
    )
