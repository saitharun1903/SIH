from datetime import datetime, timezone
from typing import Optional, List, Any
import json
from sqlalchemy import (
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    organization_type: Mapped[str] = mapped_column(String(100), default="Educational Institution")
    location: Mapped[str] = mapped_column(String(255), default="Main Campus")
    timezone: Mapped[str] = mapped_column(String(100), default="Asia/Kolkata")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    workspaces: Mapped[List["Workspace"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    users: Mapped[List["User"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    buildings: Mapped[List["Building"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    resource_types: Mapped[List["ResourceType"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    resources: Mapped[List["Resource"]] = relationship(back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="Viewer")  # Administrator, Analyst, Viewer
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="users")


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    workspace_type: Mapped[str] = mapped_column(String(100), default="custom")  # factory, hospital, warehouse, office, education, custom
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location: Mapped[str] = mapped_column(String(255), default="Main Facility")
    timezone: Mapped[str] = mapped_column(String(100), default="Asia/Kolkata")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    settings_json: Mapped[Optional[str]] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="workspaces")
    resources: Mapped[List["Resource"]] = relationship(back_populates="workspace", cascade="all, delete-orphan")
    goals: Mapped[List["Goal"]] = relationship(back_populates="workspace", cascade="all, delete-orphan")
    metric_definitions: Mapped[List["MetricDefinition"]] = relationship(back_populates="workspace", cascade="all, delete-orphan")


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    workspace_id: Mapped[Optional[int]] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    goal_type: Mapped[str] = mapped_column(String(100), nullable=False)  # reduce_cost, improve_utilization, increase_capacity, reduce_downtime, avoid_shortage, custom
    target_value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), default="%")
    baseline_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    current_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    timeframe: Mapped[str] = mapped_column(String(50), default="Q4 2026")
    status: Mapped[str] = mapped_column(String(50), default="In Progress")  # In Progress, Achieved, At Risk
    priority: Mapped[str] = mapped_column(String(50), default="High")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    workspace: Mapped[Optional["Workspace"]] = relationship(back_populates="goals")


class MetricDefinition(Base):
    __tablename__ = "metric_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    workspace_id: Mapped[Optional[int]] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), index=True, nullable=False)  # utilization, power_consumption, downtime, occupancy, throughput, operating_cost
    unit: Mapped[str] = mapped_column(String(50), default="%")
    category: Mapped[str] = mapped_column(String(50), default="Operations")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    threshold_under: Mapped[Optional[float]] = mapped_column(Float, default=40.0)
    threshold_over: Mapped[Optional[float]] = mapped_column(Float, default=90.0)
    threshold_critical: Mapped[Optional[float]] = mapped_column(Float, default=95.0)
    cost_per_unit: Mapped[Optional[float]] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Relationships
    workspace: Mapped[Optional["Workspace"]] = relationship(back_populates="metric_definitions")


class Building(Base):
    __tablename__ = "buildings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    location: Mapped[str] = mapped_column(String(255), default="North Wing")
    floor_count: Mapped[int] = mapped_column(Integer, default=4)
    square_feet: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    primary_use: Mapped[str] = mapped_column(String(100), default="Education")
    year_built: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    site_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    external_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="buildings")
    resources: Mapped[List["Resource"]] = relationship(back_populates="building")


class ResourceType(Base):
    __tablename__ = "resource_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    workspace_id: Mapped[Optional[int]] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # Machine, Bed, Vehicle, Room, Generator
    category: Mapped[str] = mapped_column(String(100), default="Physical Asset")  # Space, Equipment, Workforce, Vehicle
    unit: Mapped[str] = mapped_column(String(50), default="units")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attributes_schema: Mapped[Optional[str]] = mapped_column(Text, default="[]")
    config_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="resource_types")
    resources: Mapped[List["Resource"]] = relationship(back_populates="resource_type")


class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    workspace_id: Mapped[Optional[int]] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True)
    building_id: Mapped[Optional[int]] = mapped_column(ForeignKey("buildings.id", ondelete="SET NULL"), nullable=True)
    resource_type_id: Mapped[int] = mapped_column(ForeignKey("resource_types.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=60)
    unit: Mapped[str] = mapped_column(String(50), default="units")
    status: Mapped[str] = mapped_column(String(50), default="Active")  # Active, Inactive, Maintenance
    floor: Mapped[int] = mapped_column(Integer, default=1)
    area: Mapped[float] = mapped_column(Float, default=750.0)  # sq ft or operational area
    location: Mapped[str] = mapped_column(String(255), default="Main Zone")
    group_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Line 1, Zone A, Floor 2
    attributes_json: Mapped[Optional[str]] = mapped_column(Text, default="{}")  # dynamic key-value attributes
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="resources")
    workspace: Mapped[Optional["Workspace"]] = relationship(back_populates="resources")
    building: Mapped[Optional["Building"]] = relationship(back_populates="resources")
    resource_type: Mapped["ResourceType"] = relationship(back_populates="resources")
    schedules: Mapped[List["Schedule"]] = relationship(back_populates="resource", cascade="all, delete-orphan")
    usages: Mapped[List["ResourceUsage"]] = relationship(back_populates="resource", cascade="all, delete-orphan")
    energy_records: Mapped[List["EnergyUsage"]] = relationship(back_populates="resource", cascade="all, delete-orphan")
    occupancy_records: Mapped[List["OccupancyRecord"]] = relationship(back_populates="resource", cascade="all, delete-orphan")
    anomalies: Mapped[List["Anomaly"]] = relationship(back_populates="resource", cascade="all, delete-orphan")
    predictions: Mapped[List["Prediction"]] = relationship(back_populates="resource", cascade="all, delete-orphan")


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    workspace_id: Mapped[Optional[int]] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    subject_name: Mapped[str] = mapped_column(String(255), nullable=False)  # or event_name / task_name
    event_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    department: Mapped[str] = mapped_column(String(100), default="General")  # or work_unit / group
    work_unit: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    day_of_week: Mapped[str] = mapped_column(String(20), nullable=False)  # Monday, Tuesday, etc.
    start_time: Mapped[str] = mapped_column(String(10), nullable=False)  # HH:MM format e.g. "09:00"
    end_time: Mapped[str] = mapped_column(String(10), nullable=False)    # HH:MM format e.g. "10:00"
    expected_occupancy: Mapped[int] = mapped_column(Integer, default=50)  # or required_capacity / demand
    required_capacity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    actual_occupancy: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    attributes_json: Mapped[Optional[str]] = mapped_column(Text, default="{}")
    equipment_requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON list of strings
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    resource: Mapped["Resource"] = relationship(back_populates="schedules")


class ResourceUsage(Base):
    __tablename__ = "resource_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    usage_value: Mapped[float] = mapped_column(Float, default=0.0)
    utilization_percent: Mapped[float] = mapped_column(Float, default=0.0)
    source: Mapped[str] = mapped_column(String(50), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Relationships
    resource: Mapped["Resource"] = relationship(back_populates="usages")


class EnergyUsage(Base):
    __tablename__ = "energy_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    resource_id: Mapped[Optional[int]] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), nullable=True, index=True)
    building_id: Mapped[Optional[int]] = mapped_column(ForeignKey("buildings.id", ondelete="CASCADE"), nullable=True, index=True)
    data_source_id: Mapped[Optional[int]] = mapped_column(ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    consumption: Mapped[float] = mapped_column(Float, nullable=False)  # Normalized kWh
    unit: Mapped[str] = mapped_column(String(20), default="kWh")
    original_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    original_unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    normalized_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    normalized_unit: Mapped[Optional[str]] = mapped_column(String(50), default="kWh")
    meter_type: Mapped[str] = mapped_column(String(50), default="electricity")  # electricity, chilledwater, steam, hotwater
    weather_temperature: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cost: Mapped[float] = mapped_column(Float, default=0.0)  # Currency (INR)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Relationships
    resource: Mapped[Optional["Resource"]] = relationship(back_populates="energy_records")
    building: Mapped[Optional["Building"]] = relationship()
    data_source: Mapped[Optional["DataSource"]] = relationship()


class OccupancyRecord(Base):
    __tablename__ = "occupancy_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    occupancy: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="sensor")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Relationships
    resource: Mapped["Resource"] = relationship(back_populates="occupancy_records")


class Constraint(Base):
    __tablename__ = "constraints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    resource_id: Mapped[Optional[int]] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), nullable=True)
    constraint_type: Mapped[str] = mapped_column(String(100), nullable=False)  # capacity, availability, equipment, conflict
    constraint_value: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(50), default="Hard")  # Hard, Soft
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), default="CSV")  # CSV, XLSX, API
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    schema_version: Mapped[str] = mapped_column(String(50), default="1.0")
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Relationships
    import_jobs: Mapped[List["ImportJob"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="processing")  # processing, completed, failed
    rows_processed: Mapped[int] = mapped_column(Integer, default=0)
    rows_imported: Mapped[int] = mapped_column(Integer, default=0)
    rows_rejected: Mapped[int] = mapped_column(Integer, default=0)
    error_report: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON summary of errors
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    dataset: Mapped["Dataset"] = relationship(back_populates="import_jobs")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    prediction_type: Mapped[str] = mapped_column(String(100), nullable=False)  # demand, occupancy, energy
    metric_name: Mapped[str] = mapped_column(String(50), default="utilization")  # utilization, occupancy, energy
    horizon: Mapped[str] = mapped_column(String(20), default="7d")  # 1d, 7d, 30d
    prediction_timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    target_timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    predicted_value: Mapped[float] = mapped_column(Float, nullable=False)  # P50 point forecast
    lower_bound: Mapped[float] = mapped_column(Float, default=0.0)  # P10 lower bound
    upper_bound: Mapped[float] = mapped_column(Float, default=0.0)  # P90 upper bound
    confidence: Mapped[float] = mapped_column(Float, default=0.90)
    model_version: Mapped[str] = mapped_column(String(50), default="v1.0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Relationships
    resource: Mapped["Resource"] = relationship(back_populates="predictions")


class Anomaly(Base):
    __tablename__ = "anomalies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    metric_type: Mapped[str] = mapped_column(String(100), nullable=False)  # energy, utilization, occupancy
    anomaly_type: Mapped[str] = mapped_column(String(100), default="multivariate_anomaly")
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    expected_value: Mapped[float] = mapped_column(Float, nullable=False)
    actual_value: Mapped[float] = mapped_column(Float, nullable=False)
    deviation_percent: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String(50), default="Medium")  # Low, Medium, High, Critical
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    contributing_factors: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string of factors
    status: Mapped[str] = mapped_column(String(50), default="Active")  # Active, Acknowledged, Resolved, Dismissed
    resolved_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Relationships
    resource: Mapped["Resource"] = relationship(back_populates="anomalies")
    resolver: Mapped[Optional["User"]] = relationship(foreign_keys=[resolved_by])


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    workspace_id: Mapped[Optional[int]] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    base_period: Mapped[str] = mapped_column(String(100), default="Current Baseline")
    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, simulated, applied
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Relationships
    changes: Mapped[List["ScenarioChange"]] = relationship(back_populates="scenario", cascade="all, delete-orphan")
    results: Mapped[List["ScenarioResult"]] = relationship(back_populates="scenario", cascade="all, delete-orphan")


class ScenarioChange(Base):
    __tablename__ = "scenario_changes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    change_type: Mapped[str] = mapped_column(String(100), nullable=False)  # deactivate_resource, change_capacity, add_resource
    target_resource_id: Mapped[Optional[int]] = mapped_column(ForeignKey("resources.id", ondelete="SET NULL"), nullable=True)
    parameters_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Relationships
    scenario: Mapped["Scenario"] = relationship(back_populates="changes")


class ScenarioResult(Base):
    __tablename__ = "scenario_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="completed")  # completed, failed
    feasibility: Mapped[str] = mapped_column(String(50), default="FEASIBLE")  # FEASIBLE, NOT FEASIBLE
    objective_score: Mapped[float] = mapped_column(Float, default=0.0)
    before_metrics_json: Mapped[str] = mapped_column(Text, default="{}")
    after_metrics_json: Mapped[str] = mapped_column(Text, default="{}")
    constraint_results_json: Mapped[str] = mapped_column(Text, default="{}")
    recommendations_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Relationships
    scenario: Mapped["Scenario"] = relationship(back_populates="results")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    workspace_id: Mapped[Optional[int]] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True)
    resource_id: Mapped[Optional[int]] = mapped_column(ForeignKey("resources.id", ondelete="SET NULL"), nullable=True)
    recommendation_type: Mapped[str] = mapped_column(String(100), nullable=False)  # underutilization, overload, energy_spike
    priority: Mapped[str] = mapped_column(String(50), default="Medium")  # Low, Medium, High, Critical
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    problem_description: Mapped[str] = mapped_column(Text, nullable=False)
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_impact_json: Mapped[str] = mapped_column(Text, default="{}")
    evidence_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(50), default="Active")  # Active, Applied, Dismissed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    workspace_id: Mapped[Optional[int]] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class DataSource(Base):
    """
    DATA SOURCE REGISTRY
    Tracks origin, provenance, licensing, row counts, and date coverage for every analytical dataset.
    """
    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. Kaggle, Institutional Upload, Demo Seed
    dataset_url: Mapped[str] = mapped_column(String(500), nullable=False)
    version: Mapped[str] = mapped_column(String(50), default="1.0")
    license: Mapped[str] = mapped_column(String(100), default="Unknown")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    downloaded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    schema_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="Registered")  # Registered, Downloaded, Imported, Failed
    coverage_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    coverage_end: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Action(Base):
    """
    Facility Action & Work Order Tracking
    Bridges recommendation decisions to field operational intervention.
    """
    __tablename__ = "actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    workspace_id: Mapped[Optional[int]] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True)
    recommendation_id: Mapped[Optional[int]] = mapped_column(ForeignKey("recommendations.id", ondelete="SET NULL"), nullable=True)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)  # schedule_consolidation, hvac_setback, bms_relay
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Pending")  # Pending, In Progress, Completed, Cancelled
    assigned_to: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    executed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    result_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    recommendation: Mapped[Optional["Recommendation"]] = relationship(foreign_keys=[recommendation_id])
    executor: Mapped[Optional["User"]] = relationship(foreign_keys=[executed_by])


class ModelVersion(Base):
    """
    Machine Learning Model Registry
    Records model artifacts, algorithm metadata, hyperparameters, and evaluation metrics.
    """
    __tablename__ = "model_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)  # anomaly_isolation_forest, quantile_gbt_forecaster
    version: Mapped[str] = mapped_column(String(50), nullable=False)       # v1.0.0
    algorithm: Mapped[str] = mapped_column(String(100), nullable=False)   # IsolationForest, HistGradientBoostingRegressor
    training_dataset: Mapped[str] = mapped_column(String(255), nullable=False)
    feature_list: Mapped[str] = mapped_column(Text, nullable=False)       # JSON list of feature names
    metrics_json: Mapped[str] = mapped_column(Text, default="{}")        # JSON of MAE, RMSE, F1, etc.
    model_path: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Active")     # Active, Candidate, Archived
    trained_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
