"""
NEXUS - Resource Demand & Utilization Forecasting Engine
Multi-horizon quantile forecasting with temporal feature engineering and uncertainty bounds.
Smart India Hackathon 2026 (SIH26202)
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


class InsufficientDataError(Exception):
    """Raised when historical telemetry fails to meet the minimum data requirement."""
    def __init__(self, available_days: float, required_days: int = 14):
        self.available_days = round(available_days, 1)
        self.required_days = required_days
        super().__init__(
            f"Insufficient historical data: Found {self.available_days} days of telemetry, "
            f"but at least {self.required_days} days are required to produce statistically reliable forecasts."
        )


class ResourceDemandForecaster:
    """
    Predictive engine using Quantile Gradient Boosted Trees for P10, P50, and P90
    forecasts with calendar harmonics and schedule schedule cross-referencing.
    """

    MIN_REQUIRED_DAYS = 14
    FEATURE_COLS = [
        "hour",
        "day_of_week",
        "is_weekend",
        "is_academic_hour",
        "sin_hour",
        "cos_hour",
        "sin_dow",
        "cos_dow",
        "expected_occupancy",
        "capacity",
    ]

    def __init__(self, random_state: int = 42):
        self.random_state = random_state
        # 3 Quantile Models for P10, P50, and P90
        self.model_p10 = GradientBoostingRegressor(
            loss="quantile", alpha=0.10, n_estimators=60, max_depth=4, random_state=random_state
        )
        self.model_p50 = GradientBoostingRegressor(
            loss="quantile", alpha=0.50, n_estimators=60, max_depth=4, random_state=random_state
        )
        self.model_p90 = GradientBoostingRegressor(
            loss="quantile", alpha=0.90, n_estimators=60, max_depth=4, random_state=random_state
        )

    def engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create rich cyclical and timetable features."""
        feat = df.copy()
        if not pd.api.types.is_datetime64_any_dtype(feat["timestamp"]):
            feat["timestamp"] = pd.to_datetime(feat["timestamp"])

        feat["hour"] = feat["timestamp"].dt.hour
        feat["day_of_week"] = feat["timestamp"].dt.dayofweek
        feat["is_weekend"] = feat["day_of_week"].apply(lambda d: 1 if d >= 5 else 0)
        feat["is_academic_hour"] = feat["hour"].apply(lambda h: 1 if 8 <= h <= 18 else 0)

        # Cyclical transforms
        feat["sin_hour"] = np.sin(2 * np.pi * feat["hour"] / 24.0)
        feat["cos_hour"] = np.cos(2 * np.pi * feat["hour"] / 24.0)
        feat["sin_dow"] = np.sin(2 * np.pi * feat["day_of_week"] / 7.0)
        feat["cos_dow"] = np.cos(2 * np.pi * feat["day_of_week"] / 7.0)

        if "expected_occupancy" not in feat.columns:
            feat["expected_occupancy"] = 0.0
        else:
            feat["expected_occupancy"] = feat["expected_occupancy"].fillna(0.0)

        if "capacity" not in feat.columns:
            feat["capacity"] = 60.0
        else:
            feat["capacity"] = feat["capacity"].replace(0, 60.0).fillna(60.0)

        return feat

    def check_data_sufficiency(self, df: pd.DataFrame) -> float:
        """Validate that historical telemetry span meets minimum requirement."""
        if df.empty or len(df) < 30:
            raise InsufficientDataError(available_days=0.0, required_days=self.MIN_REQUIRED_DAYS)

        ts = pd.to_datetime(df["timestamp"])
        time_span = (ts.max() - ts.min()).total_seconds() / 86400.0

        if time_span < (self.MIN_REQUIRED_DAYS - 1.0):  # allow slight margin e.g. 13.5 days
            raise InsufficientDataError(available_days=time_span, required_days=self.MIN_REQUIRED_DAYS)

        return time_span

    def train_and_evaluate(
        self,
        df: pd.DataFrame,
        target_column: str,
    ) -> Tuple[Dict[str, float], float]:
        """Fit quantile regressors on historical telemetry and compute holdout performance metrics."""
        data_days = self.check_data_sufficiency(df)

        feat_df = self.engineer_features(df).sort_values("timestamp")
        X = feat_df[self.FEATURE_COLS].values
        y = feat_df[target_column].values

        # Time-series chronological split: 85% train, 15% test
        split_idx = int(len(X) * 0.85)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]

        # Train P10, P50, P90
        self.model_p10.fit(X_train, y_train)
        self.model_p50.fit(X_train, y_train)
        self.model_p90.fit(X_train, y_train)

        # Test evaluation on P50 median
        y_pred = self.model_p50.predict(X_test)

        mae = float(mean_absolute_error(y_test, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        r2 = float(r2_score(y_test, y_pred))

        # Safe MAPE calculation avoiding division by zero
        denom = np.maximum(np.abs(y_test), 1.0)
        mape = float(np.mean(np.abs((y_test - y_pred) / denom)) * 100.0)

        metrics = {
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "mape": round(mape, 1),
            "r2": round(max(r2, 0.0), 3),
            "samples_trained": len(X_train),
            "data_coverage_days": round(data_days, 1),
            "model_name": "Quantile Gradient Boosted Trees (P10/P50/P90)",
        }

        # Re-fit on full data for maximum forecasting accuracy
        self.model_p10.fit(X, y)
        self.model_p50.fit(X, y)
        self.model_p90.fit(X, y)

        return metrics, data_days

    def generate_future_forecast(
        self,
        last_timestamp: datetime,
        horizon: str,
        capacity: float,
        schedule_lookup: Dict[str, float],
        metric_name: str,
    ) -> List[Dict[str, Any]]:
        """
        Generate future predictions with uncertainty intervals across the requested horizon.
        horizon options: '1d' (24 hours), '7d' (7 days), '30d' (30 days).
        """
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

        if horizon == "1d":
            # 24 1-hour steps
            step_hours = 1
            num_steps = 24
        elif horizon == "7d":
            # 84 2-hour steps (smooth 7 days)
            step_hours = 2
            num_steps = 84
        elif horizon == "30d":
            # 30 1-day steps (daily resolution)
            step_hours = 24
            num_steps = 30
        else:
            step_hours = 2
            num_steps = 84

        future_rows = []
        curr_ts = last_timestamp

        for _ in range(num_steps):
            curr_ts += timedelta(hours=step_hours)
            day_str = day_names[curr_ts.weekday()]
            time_str = curr_ts.strftime("%H:00")
            sched_key = f"{day_str}_{time_str}"
            exp_occ = schedule_lookup.get(sched_key, 0.0)

            future_rows.append({
                "timestamp": curr_ts,
                "expected_occupancy": exp_occ,
                "capacity": capacity,
            })

        future_df = pd.DataFrame(future_rows)
        feat_future = self.engineer_features(future_df)
        X_future = feat_future[self.FEATURE_COLS].values

        p10 = self.model_p10.predict(X_future)
        p50 = self.model_p50.predict(X_future)
        p90 = self.model_p90.predict(X_future)

        forecast_points = []
        for i, row in future_df.iterrows():
            ts = row["timestamp"]
            pred = float(p50[i])
            low = float(p10[i])
            high = float(p90[i])

            # Ensure lower bound <= pred <= upper bound
            low = min(low, pred)
            high = max(high, pred)

            # Apply domain physical constraints
            if metric_name == "utilization":
                low = max(0.0, min(low, 100.0))
                pred = max(0.0, min(pred, 100.0))
                high = max(0.0, min(high, 100.0))
            elif metric_name == "occupancy":
                low = max(0.0, min(low, capacity))
                pred = max(0.0, min(pred, capacity))
                high = max(0.0, min(high, capacity * 1.2))
            elif metric_name == "energy":
                low = max(0.0, low)
                pred = max(0.0, pred)
                high = max(0.0, high)

            forecast_points.append({
                "target_timestamp": ts,
                "predicted_value": round(pred, 2),
                "lower_bound": round(low, 2),
                "upper_bound": round(high, 2),
            })

        return forecast_points
