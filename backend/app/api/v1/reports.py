"""
NEXUS - Institutional Reports API Endpoints
Phase 12 Audit-Ready Executive Reporting & Compliance Export Engine
Smart India Hackathon 2026 (SIH26202)
"""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User
from app.api.deps import require_viewer
from app.services.reports_service import (
    get_executive_summary_report,
    generate_utilization_csv,
    generate_anomalies_csv,
    generate_energy_csv,
)

router = APIRouter()


@router.get(
    "/reports/executive-summary",
    summary="Get Audit-Grade Institutional KPI Executive Summary",
)
def get_executive_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Computes comprehensive institutional space, energy, and compliance metrics."""
    return get_executive_summary_report(
        db=db,
        org_id=current_user.organization_id,
    )


@router.get(
    "/reports/export/utilization-csv",
    summary="Export Complete Campus Space Utilization Audit as CSV",
)
def export_utilization(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Generates downloadable CSV containing space capacities, scheduled sessions, and seat fill rates."""
    csv_content = generate_utilization_csv(db=db, org_id=current_user.organization_id)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="nexus_space_utilization_audit.csv"'},
    )


@router.get(
    "/reports/export/anomalies-csv",
    summary="Export Anomaly & Risk Incident Ledger as CSV",
)
def export_anomalies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Generates downloadable CSV containing all ML-detected anomalies and resolution statuses."""
    csv_content = generate_anomalies_csv(db=db, org_id=current_user.organization_id)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="nexus_anomaly_incident_ledger.csv"'},
    )


@router.get(
    "/reports/export/energy-csv",
    summary="Export Energy Consumption Telemetry as CSV",
)
def export_energy(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer),
):
    """Generates downloadable CSV containing power consumption telemetry and commercial tariff costs."""
    csv_content = generate_energy_csv(db=db, org_id=current_user.organization_id)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="nexus_energy_telemetry.csv"'},
    )
