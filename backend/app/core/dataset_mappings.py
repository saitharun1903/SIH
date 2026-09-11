"""
NEXUS - Configurable Schema Mapping & Unit Normalization Configuration
Phase 2 Real Dataset Ingestion & Profiling Layer
Smart India Hackathon 2026 (SIH26202)
"""

from typing import Dict, Any

# Unit Conversion Constants
KBTU_TO_KWH = 0.29307107
MW_TO_KWH = 1000.0

DATASET_CONFIGS: Dict[str, Dict[str, Any]] = {
    "ashrae_great_energy_predictor": {
        "name": "ASHRAE - Great Energy Predictor III",
        "provider": "Kaggle",
        "dataset_url": "https://www.kaggle.com/competitions/ashrae-energy-prediction/data",
        "license": "Competition Data License",
        "description": "Building-level hourly energy meters, square footage, building types, and weather covariates.",
        "field_mappings": {
            "source_building_id": "building_id",
            "observed_at": "timestamp",
            "consumption_value": "meter_reading",
            "meter_type": "meter",
            "building_type": "primary_use",
            "floor_area_sqft": "square_feet",
            "site_code": "site_id",
            "air_temp_celsius": "air_temperature",
            "dew_temp_celsius": "dew_temperature",
            "wind_speed_mps": "wind_speed",
        },
        "meter_type_map": {
            0: "electricity",
            1: "chilledwater",
            2: "steam",
            3: "hotwater",
        },
        "unit_conversions": {
            "electricity": {"from_unit": "kWh", "to_unit": "kWh", "factor": 1.0},
            "chilledwater": {"from_unit": "kBTU", "to_unit": "kWh", "factor": KBTU_TO_KWH},
            "steam": {"from_unit": "kBTU", "to_unit": "kWh", "factor": KBTU_TO_KWH},
            "hotwater": {"from_unit": "kBTU", "to_unit": "kWh", "factor": KBTU_TO_KWH},
        },
    },
    "lead_energy_anomaly": {
        "name": "Large-scale Energy Anomaly Detection (LEAD)",
        "provider": "Kaggle",
        "dataset_url": "https://www.kaggle.com/competitions/energy-anomaly-detection/data",
        "license": "CC BY-SA 4.0",
        "description": "Supervised energy anomaly detection benchmark dataset with verified physical ground-truth labels.",
        "field_mappings": {
            "source_building_id": "building_id",
            "observed_at": "timestamp",
            "consumption_value": "consumption",
            "ground_truth_anomaly": "anomaly",
        },
        "unit_conversions": {
            "electricity": {"from_unit": "kWh", "to_unit": "kWh", "factor": 1.0},
        },
    },
    "pjm_hourly_energy": {
        "name": "Hourly Energy Consumption (PJM)",
        "provider": "Kaggle",
        "dataset_url": "https://www.kaggle.com/datasets/robikscube/hourly-energy-consumption",
        "license": "CC0: Public Domain",
        "description": "Decade-long hourly power grid demand data for macro trend analysis.",
        "field_mappings": {
            "observed_at": "Datetime",
            "consumption_value": "PJME_MW",
        },
        "unit_conversions": {
            "electricity": {"from_unit": "MW", "to_unit": "kWh", "factor": MW_TO_KWH},
        },
    },
}
