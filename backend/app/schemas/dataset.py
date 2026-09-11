from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, ConfigDict


class ColumnMappingSuggestion(BaseModel):
    internal_field: str
    label: str
    required: bool
    suggested_column: Optional[str] = None
    description: str


class SchemaInspectionResponse(BaseModel):
    file_id: str
    file_name: str
    source_type: str  # CSV or XLSX
    detected_dataset_type: str  # resources, schedules, attendance, energy
    detected_columns: List[str]
    suggested_mappings: Dict[str, str]  # internal_field -> file_column
    field_definitions: List[ColumnMappingSuggestion]
    preview_rows: List[Dict[str, Any]]
    total_rows: int


class ImportConfirmRequest(BaseModel):
    file_id: str
    dataset_type: str
    column_mapping: Dict[str, str]  # internal_field -> file_column
    dataset_name: Optional[str] = None


class RejectedRowDetail(BaseModel):
    row_number: int
    reason: str
    raw_data: Dict[str, Any]


class ImportSummaryResponse(BaseModel):
    dataset_id: int
    job_id: int
    dataset_name: str
    dataset_type: str
    rows_processed: int
    rows_imported: int
    rows_rejected: int
    status: str
    errors: List[RejectedRowDetail]
    completed_at: datetime


class ImportJobResponse(BaseModel):
    id: int
    dataset_id: int
    dataset_name: Optional[str] = None
    status: str
    rows_processed: int
    rows_imported: int
    rows_rejected: int
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DataQualitySummaryResponse(BaseModel):
    total_datasets: int
    total_rows_processed: int
    total_rows_imported: int
    total_rows_rejected: int
    data_cleanliness_percent: float
    total_resources: int
    total_schedules: int
    total_occupancy_records: int
    total_energy_records: int
    coverage_start: Optional[datetime] = None
    coverage_end: Optional[datetime] = None
    coverage_days: int
    is_forecast_ready: bool
    forecast_readiness_message: str
    recent_jobs: List[ImportJobResponse]
