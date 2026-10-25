"""
Tests for ESP32 Sensor Engine & Prophet Forecasting API
"""

import sys
import os

# Ensure backend directory is in sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import pytest
from fastapi.testclient import TestClient

from main import app
from sensor_engine import SENSOR_ENGINE



def test_sensor_engine_initial_buffer():
    """Verify SENSOR_ENGINE initializes with populated historical buffer."""
    data = SENSOR_ENGINE.get_latest_telemetry(history_points=30)
    assert "current" in data
    assert "history" in data
    assert len(data["history"]) >= 30
    assert "device" in data
    assert data["device"]["device_id"] == "ESP32-EDGE-NODE-01"

    curr = data["current"]
    assert "temperature_c" in curr
    assert "humidity_pct" in curr
    assert "mq135_air_quality" in curr
    assert "ir_digital" in curr
    assert curr["ir_digital"] in [0, 1]
    assert 20.0 <= curr["temperature_c"] <= 50.0
    assert 30.0 <= curr["humidity_pct"] <= 100.0
    assert curr["mq135_air_quality"] > 0


def test_sensor_engine_scenarios():
    """Verify scenario switching and value modulation."""
    # Test nominal
    SENSOR_ENGINE.set_scenario("nominal")
    t1 = SENSOR_ENGINE.tick()
    assert t1["ir_digital"] == 1
    assert t1["water_detected"] is False

    # Test gas leak
    SENSOR_ENGINE.set_scenario("gas_leak")
    t2 = SENSOR_ENGINE.tick()
    assert SENSOR_ENGINE.active_scenario == "gas_leak"

    # Reset back to nominal
    SENSOR_ENGINE.set_scenario("nominal")
    assert SENSOR_ENGINE.active_scenario == "nominal"


def test_sensor_engine_prophet_forecast():
    """Verify Prophet forecast produces future points and bounded projections."""
    forecast_data = SENSOR_ENGINE.generate_prophet_forecast(horizon_minutes=15)
    assert forecast_data["status"] == "ok"
    assert "metrics" in forecast_data
    assert "mq135_air_quality" in forecast_data["metrics"]
    assert "temperature_c" in forecast_data["metrics"]
    assert "humidity_pct" in forecast_data["metrics"]

    gas_forecast = forecast_data["metrics"]["mq135_air_quality"]
    assert "forecast_points" in gas_forecast
    assert len(gas_forecast["forecast_points"]) == 15
    first_pt = gas_forecast["forecast_points"][0]
    assert "yhat" in first_pt
    assert "yhat_lower" in first_pt
    assert "yhat_upper" in first_pt
    assert first_pt["yhat_lower"] <= first_pt["yhat"] <= first_pt["yhat_upper"] + 0.1

    assert "water_inundation_projection" in forecast_data


def test_api_sensor_telemetry_endpoint():
    """Test GET /api/sensors/telemetry."""
    client = TestClient(app)
    res = client.get("/api/sensors/telemetry?points=20")
    assert res.status_code == 200
    body = res.json()
    assert "current" in body
    assert "history" in body
    assert len(body["history"]) == 20
    assert body["current"]["water_warning"] in ["CLEAR", "WATER DETECTED"]


def test_api_sensor_forecast_endpoint():
    """Test GET /api/sensors/forecast."""
    client = TestClient(app)
    res = client.get("/api/sensors/forecast?horizon=10")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "metrics" in body


def test_api_sensor_simulate_endpoint():
    """Test POST /api/sensors/simulate."""
    client = TestClient(app)
    res = client.post("/api/sensors/simulate", json={"scenario": "water_surge"})
    assert res.status_code == 200
    assert res.json()["scenario"] == "water_surge"

    # Restore to nominal
    res2 = client.post("/api/sensors/simulate", json={"scenario": "nominal"})
    assert res2.status_code == 200
    assert res2.json()["scenario"] == "nominal"

    # Invalid scenario
    res_bad = client.post("/api/sensors/simulate", json={"scenario": "invalid_mode_xyz"})
    assert res_bad.status_code == 400
