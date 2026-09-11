"""
NEXUS - Kaggle ASHRAE Ingestion, Profiling & Normalization Engine
Phase 2 Real Dataset Ingestion
Smart India Hackathon 2026 (SIH26202)
"""

import os
import json
import urllib.request
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.core.logging import logger
from app.core.dataset_mappings import DATASET_CONFIGS, KBTU_TO_KWH
from app.models import (
    DataSource,
    Building,
    EnergyUsage,
    Organization,
)

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DATA_RAW_DIR = os.path.join(PROJECT_ROOT, "data", "raw")
DATA_PROCESSED_DIR = os.path.join(PROJECT_ROOT, "data", "processed")

ASHRAE_URL = "https://huggingface.co/datasets/skforecast/ashrae_daily/resolve/main/ashrae_daily.parquet"
ASHRAE_RAW_FILE = os.path.join(DATA_RAW_DIR, "ashrae_daily.parquet")
PROFILING_REPORT_FILE = os.path.join(DATA_PROCESSED_DIR, "ashrae_profiling_report.json")


def ensure_directories():
    os.makedirs(DATA_RAW_DIR, exist_ok=True)
    os.makedirs(DATA_PROCESSED_DIR, exist_ok=True)


def download_ashrae_dataset() -> str:
    """
    Downloads authentic ASHRAE Great Energy Predictor III dataset.
    Preserves raw data in /data/raw.
    """
    ensure_directories()
    if os.path.exists(ASHRAE_RAW_FILE) and os.path.getsize(ASHRAE_RAW_FILE) > 10000:
        logger.info(f"Raw ASHRAE dataset already cached at {ASHRAE_RAW_FILE}")
        return ASHRAE_RAW_FILE

    logger.info(f"Downloading authentic ASHRAE dataset from {ASHRAE_URL}...")
    headers = {"User-Agent": "NEXUS-SIH26202-Ingestion/1.0"}
    req = urllib.request.Request(ASHRAE_URL, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as response, open(ASHRAE_RAW_FILE, "wb") as out_file:
        chunk_size = 1024 * 512
        while True:
            chunk = response.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)

    file_size_mb = os.path.getsize(ASHRAE_RAW_FILE) / (1024 * 1024)
    logger.info(f"ASHRAE dataset successfully cached ({file_size_mb:.2f} MB) at {ASHRAE_RAW_FILE}")
    return ASHRAE_RAW_FILE


def profile_ashrae_dataset(df: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
    """
    Performs comprehensive data profiling on the raw dataset:
    Row count, columns, data types, nulls, duplicates, date bounds,
    distributions, building counts, and IQR outlier detection.
    """
    if df is None:
        if not os.path.exists(ASHRAE_RAW_FILE):
            download_ashrae_dataset()
        df = pd.read_parquet(ASHRAE_RAW_FILE)

    total_rows = len(df)
    columns_info = {}
    for col in df.columns:
        null_count = int(df[col].isna().sum())
        columns_info[col] = {
            "dtype": str(df[col].dtype),
            "null_count": null_count,
            "null_percentage": round((null_count / max(total_rows, 1)) * 100, 2),
        }

    duplicate_rows = int(df.duplicated().sum())

    # Date range
    timestamps = pd.to_datetime(df["timestamp"])
    min_date = str(timestamps.min())
    max_date = str(timestamps.max())
    coverage_days = round((timestamps.max() - timestamps.min()).total_seconds() / 86400, 1)

    # Buildings & Uses
    unique_buildings = int(df["building_id"].nunique())
    primary_use_counts = {str(k): int(v) for k, v in df["primary_use"].value_counts().items()}

    # Numerical statistics on meter_reading
    meter_stats = {
        "mean": round(float(df["meter_reading"].mean()), 2),
        "std": round(float(df["meter_reading"].std()), 2),
        "min": round(float(df["meter_reading"].min()), 2),
        "p25": round(float(df["meter_reading"].quantile(0.25)), 2),
        "median": round(float(df["meter_reading"].median()), 2),
        "p75": round(float(df["meter_reading"].quantile(0.75)), 2),
        "max": round(float(df["meter_reading"].max()), 2),
    }

    # Outlier detection using IQR
    q25 = df["meter_reading"].quantile(0.25)
    q75 = df["meter_reading"].quantile(0.75)
    iqr = q75 - q25
    upper_bound = q75 + 3.0 * iqr
    outlier_count = int((df["meter_reading"] > upper_bound).sum())

    # Weather attributes summary
    weather_summary = {}
    if "air_temperature" in df.columns:
        weather_summary["air_temperature_celsius"] = {
            "mean": round(float(df["air_temperature"].dropna().mean()), 2),
            "min": round(float(df["air_temperature"].dropna().min()), 2),
            "max": round(float(df["air_temperature"].dropna().max()), 2),
        }

    report = {
        "dataset_name": "ASHRAE - Great Energy Predictor III",
        "provider": "Kaggle",
        "profiled_at": datetime.now(timezone.utc).isoformat(),
        "total_rows": total_rows,
        "duplicate_records": duplicate_rows,
        "date_coverage": {
            "start": min_date,
            "end": max_date,
            "duration_days": coverage_days,
        },
        "unique_buildings_count": unique_buildings,
        "primary_use_distribution": primary_use_counts,
        "columns": columns_info,
        "meter_reading_stats": meter_stats,
        "outlier_analysis": {
            "iqr_upper_bound": round(float(upper_bound), 2),
            "outlier_count": outlier_count,
            "outlier_percentage": round((outlier_count / max(total_rows, 1)) * 100, 2),
        },
        "weather_summary": weather_summary,
    }

    ensure_directories()
    with open(PROFILING_REPORT_FILE, "w") as f:
        json.dump(report, f, indent=2)

    logger.info(f"Data profiling report generated at {PROFILING_REPORT_FILE}")
    return report


def get_profiling_report() -> Optional[Dict[str, Any]]:
    """Returns the cached profiling report if available."""
    if os.path.exists(PROFILING_REPORT_FILE):
        with open(PROFILING_REPORT_FILE, "r") as f:
            return json.load(f)
    return None


def ingest_ashrae_records_to_database(
    db: Session,
    org_id: int,
    limit_buildings: int = 10,
    days_limit: int = 60,
) -> Dict[str, Any]:
    """
    Ingests authentic ASHRAE energy records into the relational database.
    - Profiles raw dataset.
    - Synchronizes Educational Institution buildings into Building model.
    - Ingests building meter readings into EnergyUsage model with unit normalization.
    - Updates DataSource registry record.
    """
    if not os.path.exists(ASHRAE_RAW_FILE):
        download_ashrae_dataset()

    df = pd.read_parquet(ASHRAE_RAW_FILE)

    # 1. Profile dataset
    profile = profile_ashrae_dataset(df)

    # 2. Focus on Education facilities (the target SIH domain)
    edu_df = df[df["primary_use"] == "Education"].copy()
    if edu_df.empty:
        edu_df = df.copy()

    # Pick representative educational buildings
    selected_bldg_ids = edu_df["building_id"].unique()[:limit_buildings]
    filtered_df = edu_df[edu_df["building_id"].isin(selected_bldg_ids)].copy()

    # Sort and filter temporal horizon
    filtered_df["timestamp"] = pd.to_datetime(filtered_df["timestamp"])
    min_ts = filtered_df["timestamp"].min()
    max_ts = min_ts + pd.Timedelta(days=days_limit)
    filtered_df = filtered_df[filtered_df["timestamp"] <= max_ts].sort_values(["building_id", "timestamp"])

    # 3. Synchronize Buildings
    bldg_meta = filtered_df[["building_id", "primary_use", "square_feet"]].drop_duplicates("building_id")
    building_map: Dict[str, Building] = {}

    for _, row in bldg_meta.iterrows():
        ext_id = str(row["building_id"])
        bldg = db.query(Building).filter(Building.external_reference == ext_id).first()
        sqft = float(row["square_feet"]) if pd.notna(row["square_feet"]) else 50000.0
        puse = str(row["primary_use"])

        if not bldg:
            code = f"ASH-{ext_id.replace('id_', '')}"
            bldg = Building(
                organization_id=org_id,
                name=f"ASHRAE Academic Facility #{ext_id.replace('id_', '')}",
                code=code,
                location="Kaggle Research Campus",
                floor_count=4,
                square_feet=sqft,
                primary_use=puse,
                external_reference=ext_id,
            )
            db.add(bldg)
            db.commit()
            db.refresh(bldg)
            logger.info(f"Provisioned building: {bldg.name} ({bldg.code})")

        building_map[ext_id] = bldg

    # 4. Find or update DataSource record
    data_source = db.query(DataSource).filter(
        DataSource.name == "ASHRAE - Great Energy Predictor III"
    ).first()

    if not data_source:
        data_source = DataSource(
            name="ASHRAE - Great Energy Predictor III",
            provider="Kaggle",
            dataset_url="https://www.kaggle.com/competitions/ashrae-energy-prediction/data",
            version="1.0",
            license="Competition Data License",
            description="Building-level hourly energy meters, square footage, building types, and weather covariates.",
            file_name="ashrae_daily.parquet",
            status="Imported",
        )
        db.add(data_source)
        db.commit()
        db.refresh(data_source)

    # 5. Ingest Energy Usage Records
    existing_records_count = db.query(func.count(EnergyUsage.id)).filter(
        EnergyUsage.data_source_id == data_source.id
    ).scalar() or 0

    inserted_count = 0
    if existing_records_count == 0:
        logger.info(f"Ingesting {len(filtered_df)} real ASHRAE energy records into database...")
        records_to_insert = []
        tariff_rate = 8.50  # Default commercial rate INR per kWh

        for _, row in filtered_df.iterrows():
            ext_id = str(row["building_id"])
            bldg = building_map.get(ext_id)
            if not bldg:
                continue

            raw_meter = float(row["meter_reading"]) if pd.notna(row["meter_reading"]) else 0.0
            # Unit conversions: raw electricity meter in ASHRAE is in kWh
            norm_kwh = max(raw_meter, 0.0)
            air_temp = float(row["air_temperature"]) if ("air_temperature" in row and pd.notna(row["air_temperature"])) else None

            rec = EnergyUsage(
                resource_id=None,
                building_id=bldg.id,
                data_source_id=data_source.id,
                timestamp=row["timestamp"].to_pydatetime(),
                consumption=round(norm_kwh, 2),
                unit="kWh",
                original_value=round(raw_meter, 2),
                original_unit="kWh",
                normalized_value=round(norm_kwh, 2),
                normalized_unit="kWh",
                meter_type="electricity",
                weather_temperature=round(air_temp, 1) if air_temp is not None else None,
                cost=round(norm_kwh * tariff_rate, 2),
            )
            records_to_insert.append(rec)

            if len(records_to_insert) >= 1000:
                db.bulk_save_objects(records_to_insert)
                db.commit()
                inserted_count += len(records_to_insert)
                records_to_insert = []

        if records_to_insert:
            db.bulk_save_objects(records_to_insert)
            db.commit()
            inserted_count += len(records_to_insert)
    else:
        inserted_count = existing_records_count

    # 6. Update DataSource record metadata
    data_source.status = "Imported"
    data_source.row_count = inserted_count
    data_source.coverage_start = min_ts.to_pydatetime()
    data_source.coverage_end = max_ts.to_pydatetime()
    data_source.downloaded_at = datetime.now(timezone.utc)
    db.commit()

    logger.info(f"Phase 2 ASHRAE Ingestion complete: {inserted_count} records loaded across {len(selected_bldg_ids)} buildings.")

    return {
        "status": "success",
        "data_source_id": data_source.id,
        "dataset_name": data_source.name,
        "records_ingested": inserted_count,
        "buildings_count": len(selected_bldg_ids),
        "date_range": f"{min_ts.strftime('%Y-%m-%d')} to {max_ts.strftime('%Y-%m-%d')}",
        "profiling_report": profile,
    }
