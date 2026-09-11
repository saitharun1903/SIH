from sqlalchemy.orm import Session
from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models import Organization, User
from app.core.security import get_password_hash
from app.core.logging import logger


def init_initial_data() -> None:
    """Initialize database tables and create default institutional organization and accounts if empty."""
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        # Check or create default Organization
        org = db.query(Organization).first()
        if not org:
            logger.info("Creating default demonstration organization...")
            org = Organization(
                name="Nexus Institute of Technology",
                organization_type="Educational Institution",
                location="Main Campus, Hyderabad",
                timezone="Asia/Kolkata",
            )
            db.add(org)
            db.commit()
            db.refresh(org)
            logger.info(f"Default Organization created: {org.name} (ID: {org.id})")

        # Baseline accounts for RBAC demonstration
        demo_users = [
            {
                "name": "Institutional Administrator",
                "email": "admin@nexus.edu",
                "password": "Admin@123",
                "role": "Administrator",
            },
            {
                "name": "Resource Analyst",
                "email": "analyst@nexus.edu",
                "password": "Analyst@123",
                "role": "Analyst",
            },
            {
                "name": "Campus Viewer",
                "email": "viewer@nexus.edu",
                "password": "Viewer@123",
                "role": "Viewer",
            },
        ]

        for u in demo_users:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if not existing:
                user = User(
                    organization_id=org.id,
                    name=u["name"],
                    email=u["email"],
                    password_hash=get_password_hash(u["password"]),
                    role=u["role"],
                    is_active=True,
                )
                db.add(user)
                logger.info(f"Created initial account: {u['email']} [{u['role']}]")

        # Initial Data Sources Registry
        from app.models import DataSource
        default_sources = [
            {
                "name": "ASHRAE - Great Energy Predictor III",
                "provider": "Kaggle",
                "dataset_url": "https://www.kaggle.com/competitions/ashrae-energy-prediction/data",
                "version": "1.0",
                "license": "Competition Data License",
                "description": "Building-level hourly energy meters (electricity, chilled water, steam), building characteristics (sq ft, year built, floor count), and meteorological observations.",
                "file_name": "train.csv, building_metadata.csv, weather_train.csv",
                "status": "Registered",
            },
            {
                "name": "Large-scale Energy Anomaly Detection (LEAD)",
                "provider": "Kaggle",
                "dataset_url": "https://www.kaggle.com/competitions/energy-anomaly-detection/data",
                "version": "1.0",
                "license": "CC BY-SA 4.0",
                "description": "Supervised energy anomaly detection benchmark dataset with verified physical ground-truth labels for model validation.",
                "file_name": "lead_anomaly_labeled.csv",
                "status": "Registered",
            },
            {
                "name": "Hourly Energy Consumption",
                "provider": "Kaggle",
                "dataset_url": "https://www.kaggle.com/datasets/robikscube/hourly-energy-consumption",
                "version": "1.0",
                "license": "CC0: Public Domain",
                "description": "Decade-long hourly power grid demand data for long-range seasonality, trend analysis, and macro demand forecasting.",
                "file_name": "pjm_hourly_est.csv",
                "status": "Registered",
            },
            {
                "name": "NEXUS Institutional Campus Dataset",
                "provider": "Institutional Seed",
                "dataset_url": "internal://seed/institutional_campus",
                "version": "1.0",
                "license": "Proprietary / Internal",
                "description": "4 campus blocks, 55 learning spaces, 980 weekly course schedules, and 6,215 hourly Wi-Fi occupancy and energy readings.",
                "file_name": "campus_telemetry_2026.sqlite",
                "row_count": 7250,
                "status": "Imported",
            },
        ]

        for s in default_sources:
            existing_src = db.query(DataSource).filter(DataSource.name == s["name"]).first()
            if not existing_src:
                src = DataSource(**s)
                db.add(src)
                logger.info(f"Registered data source: {s['name']} [{s['provider']}]")

        db.commit()
    except Exception as e:
        logger.error(f"Error during baseline initialization: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("Running standalone database initialization...")
    init_initial_data()
    logger.info("Initialization complete.")
