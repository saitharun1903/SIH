import os
import uuid
import json
import io
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple, Optional
import pandas as pd
from sqlalchemy.orm import Session

from app.models import (
    Organization,
    Building,
    ResourceType,
    Resource,
    Schedule,
    OccupancyRecord,
    EnergyUsage,
    Dataset,
    ImportJob,
    AuditLog,
)
from app.schemas.dataset import (
    SchemaInspectionResponse,
    ColumnMappingSuggestion,
    ImportConfirmRequest,
    ImportSummaryResponse,
    RejectedRowDetail,
)
from app.core.logging import logger

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Dataset target specifications and column synonyms
DATASET_SPECS = {
    "resources": {
        "title": "Classroom & Lab Resources",
        "fields": [
            {
                "field": "resource_name",
                "label": "Resource Name",
                "required": True,
                "synonyms": ["resource_name", "room_name", "room", "classroom", "name", "space_name"],
                "description": "Name or title of the space/equipment",
            },
            {
                "field": "code",
                "label": "Resource Code",
                "required": True,
                "synonyms": ["code", "room_code", "room_no", "room_number", "id", "space_code"],
                "description": "Unique identifier (e.g. A-101, LAB-01)",
            },
            {
                "field": "capacity",
                "label": "Capacity",
                "required": True,
                "synonyms": ["capacity", "seats", "max_capacity", "cap", "workstations"],
                "description": "Maximum seating or headcount",
            },
            {
                "field": "building",
                "label": "Building / Block",
                "required": False,
                "synonyms": ["building", "block", "building_name", "building_code", "wing"],
                "description": "Campus block or building",
            },
            {
                "field": "floor",
                "label": "Floor Number",
                "required": False,
                "synonyms": ["floor", "floor_no", "level"],
                "description": "Floor number (e.g. 1, 2)",
            },
            {
                "field": "status",
                "label": "Status",
                "required": False,
                "synonyms": ["status", "state", "operational_status"],
                "description": "Active, Inactive, or Maintenance",
            },
        ],
    },
    "schedules": {
        "title": "Timetable & Schedules",
        "fields": [
            {
                "field": "subject_name",
                "label": "Subject / Course",
                "required": True,
                "synonyms": ["subject", "subject_name", "course", "course_name", "class", "title"],
                "description": "Course or class title",
            },
            {
                "field": "resource_code",
                "label": "Room / Resource Code",
                "required": True,
                "synonyms": ["resource", "resource_code", "room", "room_code", "classroom", "room_no"],
                "description": "Assigned room code",
            },
            {
                "field": "day_of_week",
                "label": "Day of Week",
                "required": True,
                "synonyms": ["day", "day_of_week", "weekday"],
                "description": "Monday, Tuesday, etc.",
            },
            {
                "field": "start_time",
                "label": "Start Time",
                "required": True,
                "synonyms": ["start_time", "start", "from_time", "begins"],
                "description": "Class start time in HH:MM format",
            },
            {
                "field": "end_time",
                "label": "End Time",
                "required": True,
                "synonyms": ["end_time", "end", "to_time", "finishes"],
                "description": "Class end time in HH:MM format",
            },
            {
                "field": "expected_occupancy",
                "label": "Expected Students",
                "required": False,
                "synonyms": ["expected_students", "expected_occupancy", "students", "headcount", "enrolled"],
                "description": "Expected student attendance",
            },
            {
                "field": "department",
                "label": "Department",
                "required": False,
                "synonyms": ["department", "dept", "branch"],
                "description": "Academic department",
            },
        ],
    },
    "attendance": {
        "title": "Attendance & Occupancy Logs",
        "fields": [
            {
                "field": "resource_code",
                "label": "Room / Resource Code",
                "required": True,
                "synonyms": ["resource", "resource_code", "room", "room_code", "classroom"],
                "description": "Room identifier",
            },
            {
                "field": "timestamp",
                "label": "Date & Time",
                "required": True,
                "synonyms": ["date", "timestamp", "datetime", "time", "logged_at"],
                "description": "Date or ISO timestamp of occupancy record",
            },
            {
                "field": "occupancy",
                "label": "Headcount / Attendance",
                "required": True,
                "synonyms": ["attendance", "occupancy", "actual_students", "count", "headcount"],
                "description": "Actual number of attendees",
            },
        ],
    },
    "energy": {
        "title": "Energy Consumption Records",
        "fields": [
            {
                "field": "resource_code",
                "label": "Room / Resource Code",
                "required": True,
                "synonyms": ["resource", "resource_code", "room", "room_code", "meter"],
                "description": "Resource identifier",
            },
            {
                "field": "timestamp",
                "label": "Timestamp",
                "required": True,
                "synonyms": ["timestamp", "datetime", "date", "time", "meter_reading_at"],
                "description": "Meter reading timestamp",
            },
            {
                "field": "energy_consumption",
                "label": "Energy Consumption (kWh)",
                "required": True,
                "synonyms": ["energy_consumption", "consumption", "kwh", "power", "energy_kwh", "units"],
                "description": "Electricity consumption in kilowatt-hours",
            },
            {
                "field": "cost",
                "label": "Cost (INR)",
                "required": False,
                "synonyms": ["cost", "tariff", "amount", "total_cost"],
                "description": "Billed cost (INR)",
            },
        ],
    },
}


def save_temp_upload(file_content: bytes, filename: str) -> Tuple[str, str, str]:
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(filename)[1].lower()
    source_type = "XLSX" if ext in [".xlsx", ".xls"] else "CSV"
    saved_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")

    with open(saved_path, "wb") as f:
        f.write(file_content)

    return file_id, saved_path, source_type


def load_dataframe(filepath: str, source_type: str) -> pd.DataFrame:
    if source_type == "XLSX":
        df = pd.read_excel(filepath)
    else:
        # Robust CSV reading
        try:
            df = pd.read_csv(filepath, encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(filepath, encoding="latin-1")
    # Clean whitespace from column names
    df.columns = [str(c).strip() for c in df.columns]
    return df


def inspect_uploaded_file(file_id: str, original_filename: str) -> SchemaInspectionResponse:
    # Find matching file in UPLOAD_DIR
    target_path = None
    source_type = "CSV"
    for fname in os.listdir(UPLOAD_DIR):
        if fname.startswith(file_id):
            target_path = os.path.join(UPLOAD_DIR, fname)
            source_type = "XLSX" if fname.endswith((".xlsx", ".xls")) else "CSV"
            break

    if not target_path or not os.path.exists(target_path):
        raise FileNotFoundError(f"Uploaded file {file_id} not found.")

    df = load_dataframe(target_path, source_type)
    detected_columns = list(df.columns)
    col_lower = [c.lower() for c in detected_columns]

    # Detect dataset type by scoring overlap with known synonyms
    type_scores = {}
    for dtype, spec in DATASET_SPECS.items():
        score = 0
        for f in spec["fields"]:
            for syn in f["synonyms"]:
                if any(syn == col or syn in col for col in col_lower):
                    score += 2
                    break
        type_scores[dtype] = score

    detected_type = max(type_scores, key=type_scores.get) if type_scores else "resources"

    # Compute suggested mappings for detected_type
    spec = DATASET_SPECS[detected_type]
    suggested_mappings: Dict[str, str] = {}
    field_definitions: List[ColumnMappingSuggestion] = []

    for f in spec["fields"]:
        matched_col = None
        for syn in f["synonyms"]:
            for original_col in detected_columns:
                if syn == original_col.lower() or syn in original_col.lower().replace(" ", "_"):
                    matched_col = original_col
                    break
            if matched_col:
                break

        if matched_col:
            suggested_mappings[f["field"]] = matched_col

        field_definitions.append(
            ColumnMappingSuggestion(
                internal_field=f["field"],
                label=f["label"],
                required=f["required"],
                suggested_column=matched_col,
                description=f["description"],
            )
        )

    # Preview rows with string conversion for JSON safety
    preview_df = df.head(5).fillna("")
    preview_rows = preview_df.to_dict(orient="records")

    return SchemaInspectionResponse(
        file_id=file_id,
        file_name=original_filename,
        source_type=source_type,
        detected_dataset_type=detected_type,
        detected_columns=detected_columns,
        suggested_mappings=suggested_mappings,
        field_definitions=field_definitions,
        preview_rows=preview_rows,
        total_rows=len(df),
    )


def process_import(
    db: Session,
    org_id: int,
    user_id: int,
    request: ImportConfirmRequest,
) -> ImportSummaryResponse:
    # 1. Locate file
    target_path = None
    source_type = "CSV"
    for fname in os.listdir(UPLOAD_DIR):
        if fname.startswith(request.file_id):
            target_path = os.path.join(UPLOAD_DIR, fname)
            source_type = "XLSX" if fname.endswith((".xlsx", ".xls")) else "CSV"
            break

    if not target_path or not os.path.exists(target_path):
        raise FileNotFoundError(f"Uploaded file {request.file_id} not found.")

    df = load_dataframe(target_path, source_type)
    mapping = request.column_mapping
    dataset_type = request.dataset_type

    dataset_name = request.dataset_name or f"Import_{dataset_type.title()}_{datetime.now().strftime('%Y%m%d_%H%M')}"

    # 2. Register Dataset
    dataset = Dataset(
        organization_id=org_id,
        name=dataset_name,
        source_type=source_type,
        file_name=os.path.basename(target_path),
        schema_version="1.0",
        row_count=len(df),
        status="processing",
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    job = ImportJob(
        dataset_id=dataset.id,
        status="processing",
        rows_processed=len(df),
        rows_imported=0,
        rows_rejected=0,
        started_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    errors: List[RejectedRowDetail] = []
    imported_count = 0

    # 3. Process based on dataset_type
    try:
        if dataset_type == "resources":
            imported_count = _import_resources(db, org_id, df, mapping, errors)
        elif dataset_type == "schedules":
            imported_count = _import_schedules(db, org_id, df, mapping, errors)
        elif dataset_type == "attendance":
            imported_count = _import_attendance(db, org_id, df, mapping, errors)
        elif dataset_type == "energy":
            imported_count = _import_energy(db, org_id, df, mapping, errors)
        else:
            raise ValueError(f"Unsupported dataset type: {dataset_type}")

        rejected_count = len(errors)
        status_val = "completed" if rejected_count == 0 else ("partial" if imported_count > 0 else "failed")

        dataset.status = status_val
        job.status = status_val
        job.rows_imported = imported_count
        job.rows_rejected = rejected_count
        job.completed_at = datetime.now(timezone.utc)
        job.error_report = json.dumps([e.model_dump() for e in errors])

        db.add(AuditLog(
            user_id=user_id,
            organization_id=org_id,
            action="DATASET_IMPORT",
            entity_type="Dataset",
            entity_id=dataset.id,
            metadata_json=f'{{"imported": {imported_count}, "rejected": {rejected_count}, "type": "{dataset_type}"}}',
        ))
        db.commit()

        return ImportSummaryResponse(
            dataset_id=dataset.id,
            job_id=job.id,
            dataset_name=dataset.name,
            dataset_type=dataset_type,
            rows_processed=len(df),
            rows_imported=imported_count,
            rows_rejected=rejected_count,
            status=status_val,
            errors=errors,
            completed_at=job.completed_at,
        )
    except Exception as exc:
        db.rollback()
        job.status = "failed"
        job.completed_at = datetime.now(timezone.utc)
        job.error_report = json.dumps([{"row_number": 0, "reason": str(exc), "raw_data": {}}])
        dataset.status = "failed"
        db.commit()
        logger.error(f"Failed to process import job {job.id}: {exc}", exc_info=True)
        raise exc


def _get_val(row: pd.Series, col_name: Optional[str]) -> Any:
    if not col_name or col_name not in row:
        return None
    val = row[col_name]
    if pd.isna(val):
        return None
    return val


def _import_resources(db: Session, org_id: int, df: pd.DataFrame, mapping: Dict[str, str], errors: List[RejectedRowDetail]) -> int:
    default_rt = db.query(ResourceType).filter(ResourceType.organization_id == org_id, ResourceType.name == "Classroom").first()
    if not default_rt:
        default_rt = ResourceType(organization_id=org_id, name="Classroom", category="Space", unit="seats")
        db.add(default_rt)
        db.commit()
        db.refresh(default_rt)

    buildings = {b.name.lower(): b for b in db.query(Building).filter(Building.organization_id == org_id).all()}
    buildings.update({b.code.lower(): b for b in db.query(Building).filter(Building.organization_id == org_id).all()})

    imported = 0
    for idx, row in df.iterrows():
        row_num = idx + 2
        raw_dict = row.to_dict()

        name = _get_val(row, mapping.get("resource_name"))
        code = _get_val(row, mapping.get("code")) or name
        capacity_val = _get_val(row, mapping.get("capacity"))

        if not name and not code:
            errors.append(RejectedRowDetail(row_number=row_num, reason="Missing resource name and code.", raw_data=raw_dict))
            continue

        if not code:
            code = str(name).strip()[:10].upper()

        code_clean = str(code).strip().upper()

        # Capacity validation
        try:
            capacity = int(float(capacity_val)) if capacity_val is not None else 60
            if capacity <= 0 or capacity > 10000:
                raise ValueError("Capacity out of valid bounds (1-10000)")
        except Exception:
            errors.append(RejectedRowDetail(row_number=row_num, reason=f"Invalid capacity value: '{capacity_val}'", raw_data=raw_dict))
            continue

        # Check duplicate
        existing = db.query(Resource).filter(Resource.organization_id == org_id, Resource.code == code_clean).first()
        if existing:
            errors.append(RejectedRowDetail(row_number=row_num, reason=f"Resource code '{code_clean}' already exists in database.", raw_data=raw_dict))
            continue

        # Building resolution
        bldg_val = _get_val(row, mapping.get("building"))
        bldg_obj = None
        if bldg_val:
            bldg_str = str(bldg_val).strip().lower()
            bldg_obj = buildings.get(bldg_str)
            if not bldg_obj:
                # Auto-create building
                bldg_obj = Building(
                    organization_id=org_id,
                    name=str(bldg_val).strip(),
                    code=str(bldg_val).strip()[:10].upper(),
                    location="Campus",
                    floor_count=4,
                )
                db.add(bldg_obj)
                db.commit()
                db.refresh(bldg_obj)
                buildings[bldg_str] = bldg_obj

        floor_val = _get_val(row, mapping.get("floor"))
        try:
            floor = int(float(floor_val)) if floor_val is not None else 1
        except Exception:
            floor = 1

        status_val = _get_val(row, mapping.get("status"))
        status = str(status_val).capitalize() if status_val else "Active"
        if status not in ["Active", "Inactive", "Maintenance"]:
            status = "Active"

        res = Resource(
            organization_id=org_id,
            building_id=bldg_obj.id if bldg_obj else None,
            resource_type_id=default_rt.id,
            name=str(name).strip(),
            code=code_clean,
            capacity=capacity,
            status=status,
            floor=floor,
            area=float(capacity * 15),
            location=bldg_obj.name if bldg_obj else "Campus",
        )
        db.add(res)
        imported += 1

    db.commit()
    return imported


def _import_schedules(db: Session, org_id: int, df: pd.DataFrame, mapping: Dict[str, str], errors: List[RejectedRowDetail]) -> int:
    resources = {r.code.upper(): r for r in db.query(Resource).filter(Resource.organization_id == org_id).all()}
    imported = 0

    for idx, row in df.iterrows():
        row_num = idx + 2
        raw_dict = row.to_dict()

        subject = _get_val(row, mapping.get("subject_name"))
        res_code = _get_val(row, mapping.get("resource_code"))
        day = _get_val(row, mapping.get("day_of_week"))
        start_t = _get_val(row, mapping.get("start_time"))
        end_t = _get_val(row, mapping.get("end_time"))

        if not subject or not res_code or not day or not start_t or not end_t:
            errors.append(RejectedRowDetail(row_number=row_num, reason="Missing mandatory schedule field (subject, room, day, start, end).", raw_data=raw_dict))
            continue

        res_code_clean = str(res_code).strip().upper()
        res_obj = resources.get(res_code_clean)
        if not res_obj:
            errors.append(RejectedRowDetail(row_number=row_num, reason=f"Resource '{res_code_clean}' not found in campus database.", raw_data=raw_dict))
            continue

        # Format times
        start_str = str(start_t).strip()
        end_str = str(end_t).strip()
        if len(start_str) == 4 and ":" not in start_str: start_str = f"{start_str[:2]}:{start_str[2:]}"
        if len(end_str) == 4 and ":" not in end_str: end_str = f"{end_str[:2]}:{end_str[2:]}"

        if start_str >= end_str:
            errors.append(RejectedRowDetail(row_number=row_num, reason=f"Invalid time span: start '{start_str}' >= end '{end_str}'.", raw_data=raw_dict))
            continue

        # Check timetable conflict
        conflict = db.query(Schedule).filter(
            Schedule.resource_id == res_obj.id,
            Schedule.day_of_week.ilike(str(day).strip()),
            Schedule.start_time < end_str,
            Schedule.end_time > start_str,
        ).first()
        if conflict:
            errors.append(RejectedRowDetail(row_number=row_num, reason=f"Conflict: {res_code_clean} overlaps with '{conflict.subject_name}' ({conflict.start_time}-{conflict.end_time}).", raw_data=raw_dict))
            continue

        exp_val = _get_val(row, mapping.get("expected_occupancy"))
        try:
            expected = int(float(exp_val)) if exp_val is not None else int(res_obj.capacity * 0.75)
        except Exception:
            expected = int(res_obj.capacity * 0.75)

        dept_val = _get_val(row, mapping.get("department")) or "Academics"

        sched = Schedule(
            organization_id=org_id,
            resource_id=res_obj.id,
            subject_name=str(subject).strip(),
            department=str(dept_val).strip(),
            day_of_week=str(day).strip().capitalize(),
            start_time=start_str,
            end_time=end_str,
            expected_occupancy=expected,
        )
        db.add(sched)
        imported += 1

    db.commit()
    return imported


def _import_attendance(db: Session, org_id: int, df: pd.DataFrame, mapping: Dict[str, str], errors: List[RejectedRowDetail]) -> int:
    resources = {r.code.upper(): r for r in db.query(Resource).filter(Resource.organization_id == org_id).all()}
    imported = 0

    for idx, row in df.iterrows():
        row_num = idx + 2
        raw_dict = row.to_dict()

        res_code = _get_val(row, mapping.get("resource_code"))
        ts_val = _get_val(row, mapping.get("timestamp"))
        occ_val = _get_val(row, mapping.get("occupancy"))

        if not res_code or not ts_val or occ_val is None:
            errors.append(RejectedRowDetail(row_number=row_num, reason="Missing resource, timestamp, or occupancy.", raw_data=raw_dict))
            continue

        res_code_clean = str(res_code).strip().upper()
        res_obj = resources.get(res_code_clean)
        if not res_obj:
            errors.append(RejectedRowDetail(row_number=row_num, reason=f"Resource '{res_code_clean}' not found.", raw_data=raw_dict))
            continue

        try:
            parsed_dt = pd.to_datetime(ts_val).to_pydatetime()
        except Exception:
            errors.append(RejectedRowDetail(row_number=row_num, reason=f"Could not parse timestamp: '{ts_val}'.", raw_data=raw_dict))
            continue

        try:
            occupancy = int(float(occ_val))
            if occupancy < 0:
                raise ValueError("Occupancy cannot be negative")
        except Exception:
            errors.append(RejectedRowDetail(row_number=row_num, reason=f"Invalid occupancy value: '{occ_val}'.", raw_data=raw_dict))
            continue

        rec = OccupancyRecord(
            resource_id=res_obj.id,
            timestamp=parsed_dt,
            occupancy=occupancy,
            source="upload",
        )
        db.add(rec)
        imported += 1

    db.commit()
    return imported


def _import_energy(db: Session, org_id: int, df: pd.DataFrame, mapping: Dict[str, str], errors: List[RejectedRowDetail]) -> int:
    resources = {r.code.upper(): r for r in db.query(Resource).filter(Resource.organization_id == org_id).all()}
    imported = 0

    for idx, row in df.iterrows():
        row_num = idx + 2
        raw_dict = row.to_dict()

        res_code = _get_val(row, mapping.get("resource_code"))
        ts_val = _get_val(row, mapping.get("timestamp"))
        kwh_val = _get_val(row, mapping.get("energy_consumption"))

        if not res_code or not ts_val or kwh_val is None:
            errors.append(RejectedRowDetail(row_number=row_num, reason="Missing resource, timestamp, or energy consumption.", raw_data=raw_dict))
            continue

        res_code_clean = str(res_code).strip().upper()
        res_obj = resources.get(res_code_clean)
        if not res_obj:
            errors.append(RejectedRowDetail(row_number=row_num, reason=f"Resource '{res_code_clean}' not found.", raw_data=raw_dict))
            continue

        try:
            parsed_dt = pd.to_datetime(ts_val).to_pydatetime()
        except Exception:
            errors.append(RejectedRowDetail(row_number=row_num, reason=f"Could not parse timestamp: '{ts_val}'.", raw_data=raw_dict))
            continue

        try:
            kwh = float(kwh_val)
            if kwh < 0:
                raise ValueError("Energy consumption cannot be negative")
        except Exception:
            errors.append(RejectedRowDetail(row_number=row_num, reason=f"Invalid energy kWh value: '{kwh_val}'.", raw_data=raw_dict))
            continue

        cost_val = _get_val(row, mapping.get("cost"))
        cost = float(cost_val) if cost_val is not None else round(kwh * 8.50, 2)

        rec = EnergyUsage(
            resource_id=res_obj.id,
            timestamp=parsed_dt,
            consumption=kwh,
            unit="kWh",
            cost=cost,
        )
        db.add(rec)
        imported += 1

    db.commit()
    return imported
