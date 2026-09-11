"""
NEXUS - AI-Powered Resource Intelligence & Decision Automation Platform
Anomaly Detection Engine (Isolation Forest & Rule-Based Multivariate Detector)
Smart India Hackathon 2026 (SIH26202)
"""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest


class AnomalyEvent:
    def __init__(
        self,
        resource_id: int,
        timestamp: datetime,
        metric_type: str,
        anomaly_type: str,
        severity: str,
        expected_value: float,
        actual_value: float,
        deviation_percent: float,
        reason: str,
        contributing_factors: List[Dict[str, str]],
    ):
        self.resource_id = resource_id
        self.timestamp = timestamp
        self.metric_type = metric_type
        self.anomaly_type = anomaly_type
        self.severity = severity
        self.expected_value = round(expected_value, 2)
        self.actual_value = round(actual_value, 2)
        self.deviation_percent = round(deviation_percent, 1)
        self.reason = reason
        self.contributing_factors = contributing_factors

    def to_dict(self) -> Dict[str, Any]:
        return {
            "resource_id": self.resource_id,
            "timestamp": self.timestamp,
            "metric_type": self.metric_type,
            "anomaly_type": self.anomaly_type,
            "severity": self.severity,
            "expected_value": self.expected_value,
            "actual_value": self.actual_value,
            "deviation_percent": self.deviation_percent,
            "reason": self.reason,
            "contributing_factors": self.contributing_factors,
        }


class IsolationForestDetector:
    """
    Multivariate Anomaly Detection using Isolation Forest combined with
    deterministic institutional heuristics for campus resource telemetry.
    """

    def __init__(self, contamination: float = 0.05, random_state: int = 42):
        self.contamination = contamination
        self.random_state = random_state
        self.model = IsolationForest(
            contamination=self.contamination,
            n_estimators=100,
            random_state=self.random_state,
            n_jobs=-1,
        )
        self.feature_columns = [
            "hour",
            "day_of_week",
            "occupancy_ratio",
            "occupancy_delta",
            "energy_per_occupant",
            "energy_kwh",
        ]

    def extract_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Engineer temporal and behavioral features from raw telemetry."""
        feat = df.copy()

        # Ensure datetime
        if not pd.api.types.is_datetime64_any_dtype(feat["timestamp"]):
            feat["timestamp"] = pd.to_datetime(feat["timestamp"])

        feat["hour"] = feat["timestamp"].dt.hour
        feat["day_of_week"] = feat["timestamp"].dt.dayofweek
        feat["is_weekend"] = feat["day_of_week"].apply(lambda d: 1 if d >= 5 else 0)
        feat["is_night"] = feat["hour"].apply(lambda h: 1 if h < 7 or h >= 21 else 0)

        # Ensure safe defaults
        feat["capacity"] = feat["capacity"].replace(0, 1)
        feat["actual_occupancy"] = feat["actual_occupancy"].fillna(0)
        feat["expected_occupancy"] = feat["expected_occupancy"].fillna(0)
        feat["energy_kwh"] = feat["energy_kwh"].fillna(0.0)

        # Ratios & Deltas
        feat["occupancy_ratio"] = feat["actual_occupancy"] / feat["capacity"]
        feat["expected_ratio"] = feat["expected_occupancy"] / feat["capacity"]
        feat["occupancy_delta"] = feat["actual_occupancy"] - feat["expected_occupancy"]
        feat["energy_per_occupant"] = feat["energy_kwh"] / np.maximum(feat["actual_occupancy"], 1)

        return feat

    def detect_deterministic_anomalies(self, df: pd.DataFrame) -> List[AnomalyEvent]:
        """Detect deterministic operational violations based on physical rules."""
        anomalies: List[AnomalyEvent] = []

        for _, row in df.iterrows():
            ts = row["timestamp"] if isinstance(row["timestamp"], datetime) else pd.to_datetime(row["timestamp"]).to_pydatetime()
            rid = int(row["resource_id"])
            cap = float(row["capacity"])
            actual_occ = float(row["actual_occupancy"])
            exp_occ = float(row["expected_occupancy"])
            energy = float(row["energy_kwh"])
            hour = int(row["hour"])

            # 1. Capacity Violation: actual_occupancy > capacity
            if actual_occ > cap:
                overflow = actual_occ - cap
                dev_pct = (overflow / cap) * 100
                sev = "Critical" if dev_pct > 20 else "High"
                anomalies.append(
                    AnomalyEvent(
                        resource_id=rid,
                        timestamp=ts,
                        metric_type="occupancy",
                        anomaly_type="capacity_violation",
                        severity=sev,
                        expected_value=cap,
                        actual_value=actual_occ,
                        deviation_percent=dev_pct,
                        reason=f"Capacity overload: Room occupied by {int(actual_occ)} persons exceeding max safe limit of {int(cap)} by {int(overflow)} ({dev_pct:.0f}% excess).",
                        contributing_factors=[
                            {"factor": "Safety Code Violation", "impact": "Critical", "detail": f"Over capacity by {int(overflow)} students"},
                            {"factor": "Class Consolidation", "impact": "High", "detail": "Merged sections without room re-allocation"},
                        ],
                    )
                )

            # 2. Phantom Energy: high energy draw with zero occupants
            if energy >= 4.0 and actual_occ == 0:
                dev_pct = min(energy * 20.0, 500.0)
                sev = "Critical" if energy >= 10.0 else ("High" if energy >= 6.0 else "Medium")
                anomalies.append(
                    AnomalyEvent(
                        resource_id=rid,
                        timestamp=ts,
                        metric_type="energy",
                        anomaly_type="phantom_energy",
                        severity=sev,
                        expected_value=0.5,
                        actual_value=energy,
                        deviation_percent=dev_pct,
                        reason=f"Phantom Energy Drain: {energy:.1f} kWh consumed with 0 room occupants. Heating, ventilation, or equipment left operating.",
                        contributing_factors=[
                            {"factor": "Zero Occupancy", "impact": "High", "detail": "Room was completely empty during active billing cycle"},
                            {"factor": "HVAC / Projector Left Active", "impact": "High", "detail": f"Continuous power draw of {energy:.1f} kWh"},
                            {"factor": "Idle Cost Incurred", "impact": "Medium", "detail": f"Wasted ₹{(energy * 8.5):.1f} per hour"},
                        ],
                    )
                )

            # 3. Scheduled Class Ghosting / Zero Occupancy
            if exp_occ >= 25 and actual_occ == 0 and 8 <= hour <= 18:
                anomalies.append(
                    AnomalyEvent(
                        resource_id=rid,
                        timestamp=ts,
                        metric_type="occupancy",
                        anomaly_type="zero_occupancy",
                        severity="High" if exp_occ >= 45 else "Medium",
                        expected_value=exp_occ,
                        actual_value=0.0,
                        deviation_percent=100.0,
                        reason=f"Unattended Reservation: Scheduled lecture for {int(exp_occ)} students had 0 actual attendance, locking high-value space.",
                        contributing_factors=[
                            {"factor": "Unannounced Cancellation", "impact": "High", "detail": f"Timetable slot reserved for {int(exp_occ)} students"},
                            {"factor": "Opportunity Cost", "impact": "Medium", "detail": "Prevented alternative departmental booking"},
                        ],
                    )
                )

            # 4. Off-Hours Unexpected Occupancy
            if (hour < 7 or hour >= 22) and actual_occ >= 15 and exp_occ == 0:
                anomalies.append(
                    AnomalyEvent(
                        resource_id=rid,
                        timestamp=ts,
                        metric_type="occupancy",
                        anomaly_type="unexpected_occupancy",
                        severity="Medium",
                        expected_value=0.0,
                        actual_value=actual_occ,
                        deviation_percent=100.0,
                        reason=f"Unscheduled Off-Hours Activity: {int(actual_occ)} occupants detected at {hour:02d}:00 without approved timetable reservation.",
                        contributing_factors=[
                            {"factor": "Unapproved Access", "impact": "Medium", "detail": f"Detected {int(actual_occ)} occupants after campus hours"},
                            {"factor": "Security & HVAC", "impact": "Medium", "detail": "Unscheduled lighting and climate control active"},
                        ],
                    )
                )

            # 5. Persistent Severe Underutilization
            if exp_occ >= 40 and actual_occ > 0 and actual_occ <= (exp_occ * 0.20):
                dev_pct = ((exp_occ - actual_occ) / exp_occ) * 100
                anomalies.append(
                    AnomalyEvent(
                        resource_id=rid,
                        timestamp=ts,
                        metric_type="utilization",
                        anomaly_type="persistent_underutilization",
                        severity="Medium",
                        expected_value=exp_occ,
                        actual_value=actual_occ,
                        deviation_percent=dev_pct,
                        reason=f"Severe Underutilization: Large space reserved for {int(exp_occ)} students only seated {int(actual_occ)} ({dev_pct:.0f}% vacant capacity).",
                        contributing_factors=[
                            {"factor": "Mismatched Room Assignment", "impact": "Medium", "detail": f"Section size {int(actual_occ)} booked into room of capacity {int(cap)}"},
                            {"factor": "Efficiency Penalty", "impact": "Low", "detail": "Sub-optimal thermal and spatial efficiency"},
                        ],
                    )
                )

        return anomalies

    def detect_multivariate_outliers(self, df: pd.DataFrame) -> List[AnomalyEvent]:
        """Detect statistical multivariate anomalies using Isolation Forest."""
        if len(df) < 15:
            # Insufficient sample size for statistical fitting
            return []

        features_df = df[self.feature_columns].fillna(0.0)
        X = features_df.values

        self.model.fit(X)
        predictions = self.model.predict(X)  # -1 for anomaly, 1 for inlier
        scores = -self.model.decision_function(X)  # higher = more anomalous

        outliers: List[AnomalyEvent] = []
        means = features_df.mean()
        stds = features_df.std().replace(0, 1)

        for idx, (pred, score) in enumerate(zip(predictions, scores)):
            if pred == -1 and score > 0.05:
                row = df.iloc[idx]
                ts = row["timestamp"] if isinstance(row["timestamp"], datetime) else pd.to_datetime(row["timestamp"]).to_pydatetime()
                rid = int(row["resource_id"])
                actual_occ = float(row["actual_occupancy"])
                exp_occ = float(row["expected_occupancy"])
                energy = float(row["energy_kwh"])

                # Determine which feature contributed most via z-score
                row_features = features_df.iloc[idx]
                z_scores = ((row_features - means) / stds).abs()
                top_feature = z_scores.idxmax()
                top_z = float(z_scores[top_feature])

                sev = "High" if score > 0.18 else ("Medium" if score > 0.10 else "Low")

                factor_detail = (
                    f"Extreme energy spike: {energy:.1f} kWh (z-score: {top_z:.1f})"
                    if top_feature == "energy_kwh"
                    else f"Occupancy deviation: {actual_occ:.0f} vs expected {exp_occ:.0f} (z-score: {top_z:.1f})"
                )

                outliers.append(
                    AnomalyEvent(
                        resource_id=rid,
                        timestamp=ts,
                        metric_type="multivariate",
                        anomaly_type="multivariate_outlier",
                        severity=sev,
                        expected_value=exp_occ,
                        actual_value=actual_occ,
                        deviation_percent=round(score * 100, 1),
                        reason=f"Statistical Multivariate Outlier: Unusual pattern detected in energy/occupancy feature space (Score: {score:.3f}, abnormal in {top_feature}).",
                        contributing_factors=[
                            {"factor": f"Isolation Forest Anomaly Score", "impact": sev, "detail": f"Outlier score {score:.3f}"},
                            {"factor": f"Primary Deviant Dimension", "impact": "Medium", "detail": factor_detail},
                        ],
                    )
                )

        return outliers

    def run_detection_pipeline(self, raw_df: pd.DataFrame) -> List[AnomalyEvent]:
        """Full pipeline: feature engineering -> rule-based checks -> isolation forest -> deduplication."""
        if raw_df.empty:
            return []

        df = self.extract_features(raw_df)

        # 1. Deterministic Rule Violations
        rule_anomalies = self.detect_deterministic_anomalies(df)

        # 2. Isolation Forest Outliers
        ml_anomalies = self.detect_multivariate_outliers(df)

        # 3. Deduplicate by (resource_id, timestamp, metric_type)
        combined: Dict[str, AnomalyEvent] = {}
        for anom in rule_anomalies + ml_anomalies:
            key = f"{anom.resource_id}_{anom.timestamp.isoformat()}_{anom.anomaly_type}"
            if key not in combined:
                combined[key] = anom

        # Sort chronologically descending
        results = sorted(combined.values(), key=lambda a: a.timestamp, reverse=True)
        return results
