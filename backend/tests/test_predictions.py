from datetime import datetime, timedelta, timezone
import pytest
import pandas as pd
from app.models import Resource, Schedule, OccupancyRecord, EnergyUsage, ResourceUsage
from app.ml.forecaster import ResourceDemandForecaster, InsufficientDataError


def get_token(client, email: str = "analysttest@nexus.edu"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return res.json()["access_token"]


@pytest.fixture(scope="module", autouse=True)
def setup_forecasting_test_data():
    from tests.conftest import TestSessionLocal
    db = TestSessionLocal()

    now = datetime.now(timezone.utc)

    # Ingest 15 continuous days of realistic telemetry to satisfy data sufficiency (>= 14 days)
    for day in range(16):
        day_date = now - timedelta(days=15 - day)
        for h in range(8, 20):  # 8 AM to 8 PM
            ts = day_date.replace(hour=h, minute=0, second=0, microsecond=0)
            occ = 30 + (h % 5) * 5
            util = (occ / 60.0) * 100.0
            nrg = 6.0 + (occ / 10.0)

            db.add(OccupancyRecord(resource_id=1, timestamp=ts, occupancy=occ))
            db.add(ResourceUsage(resource_id=1, timestamp=ts, usage_value=float(occ), utilization_percent=util))
            db.add(EnergyUsage(resource_id=1, timestamp=ts, consumption=nrg, cost=nrg * 8.5))

    db.commit()
    db.close()


def test_forecaster_insufficient_data_guard():
    forecaster = ResourceDemandForecaster()

    # Small dataset with only 3 days
    now = datetime.now(timezone.utc)
    short_data = [
        {"timestamp": now - timedelta(days=i), "actual_occupancy": 30, "capacity": 60, "expected_occupancy": 40}
        for i in range(3)
    ]
    df_short = pd.DataFrame(short_data)

    with pytest.raises(InsufficientDataError) as exc_info:
        forecaster.train_and_evaluate(df_short, "actual_occupancy")

    assert "Insufficient historical data" in str(exc_info.value)
    assert exc_info.value.required_days == 14


def test_forecaster_direct_quantile_prediction():
    forecaster = ResourceDemandForecaster()

    now = datetime.now(timezone.utc)
    full_data = []
    for day in range(16):
        day_date = now - timedelta(days=15 - day)
        for h in range(24):
            ts = day_date.replace(hour=h, minute=0, second=0, microsecond=0)
            occ = 20.0 + 15.0 * (1 if 9 <= h <= 17 else 0)
            full_data.append({
                "timestamp": ts,
                "utilization_percent": (occ / 60.0) * 100.0,
                "actual_occupancy": occ,
                "expected_occupancy": 35.0,
                "capacity": 60.0,
                "energy_kwh": 5.0 + occ * 0.1,
            })

    df = pd.DataFrame(full_data)
    metrics, coverage_days = forecaster.train_and_evaluate(df, "utilization_percent")

    assert coverage_days >= 14.0
    assert "mae" in metrics
    assert "rmse" in metrics
    assert "mape" in metrics
    assert "r2" in metrics
    assert metrics["samples_trained"] > 100

    # Test future generation
    future = forecaster.generate_future_forecast(
        last_timestamp=now,
        horizon="1d",
        capacity=60.0,
        schedule_lookup={},
        metric_name="utilization",
    )

    assert len(future) == 24
    for pt in future:
        assert 0.0 <= pt["lower_bound"] <= 100.0
        assert 0.0 <= pt["predicted_value"] <= 100.0
        assert 0.0 <= pt["upper_bound"] <= 100.0
        assert pt["lower_bound"] <= pt["predicted_value"] <= pt["upper_bound"]


def test_predictions_overview_api(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/predictions/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "total_spaces_forecasted" in data
    assert "avg_forecasted_utilization" in data
    assert "data_sufficiency_status" in data
    assert "historical_days_available" in data
    assert data["data_sufficiency_status"] == "SUFFICIENT"


def test_create_forecast_api_post(client):
    token = get_token(client)
    res = client.post(
        "/api/v1/predictions/forecast",
        json={
            "resource_id": 1,
            "metric_name": "utilization",
            "horizon": "7d",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["metric_name"] == "utilization"
    assert data["horizon"] == "7d"
    assert "metrics" in data
    assert data["metrics"]["r2"] >= 0.0
    assert len(data["historical"]) > 0
    assert len(data["forecast"]) > 0

    first_forecast = data["forecast"][0]
    assert "target_timestamp" in first_forecast
    assert "predicted_value" in first_forecast
    assert "lower_bound" in first_forecast
    assert "upper_bound" in first_forecast
    assert first_forecast["lower_bound"] <= first_forecast["predicted_value"] <= first_forecast["upper_bound"]


def test_forecast_by_query_get(client):
    token = get_token(client)
    res = client.get(
        "/api/v1/predictions?metric_name=energy&horizon=1d",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["metric_name"] == "energy"
    assert data["horizon"] == "1d"
    assert len(data["forecast"]) == 24


def test_forecast_invalid_inputs(client):
    token = get_token(client)
    # Invalid metric
    res = client.post(
        "/api/v1/predictions/forecast",
        json={"metric_name": "invalid_metric", "horizon": "7d"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400

    # Invalid horizon
    res = client.post(
        "/api/v1/predictions/forecast",
        json={"metric_name": "utilization", "horizon": "90d"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400
