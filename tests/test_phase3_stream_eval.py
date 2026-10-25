"""Integration tests for Phase 3: Generalization, Evaluation Benchmarks, and Streaming."""

import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parent.parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from main import app

client = TestClient(app)


def test_phase3_eval_benchmark_metrics():
    res = client.get("/api/warning/eval-summary")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "verified"
    assert "horizons" in data
    assert "lead_time_hours" in data
    assert data["lead_time_hours"] >= 12.0
    assert "false_alarm_rate" in data
    assert data["false_alarm_rate"] < 0.10
    assert "brier_score" in data


def test_phase3_held_out_city_generalization():
    # Switch to held-out Mumbai city
    payload = {"city": "mumbai", "scenario": "cloudburst"}
    res = client.post("/api/warning/select-scenario", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["city"] == "mumbai"

    # Verify state reflects Mumbai zones
    state_res = client.get("/api/warning/state")
    assert state_res.status_code == 200
    state_data = state_res.json()
    assert "zones" in state_data
    assert len(state_data["zones"]) > 0
    # Mumbai zone IDs start with 'm_'
    first_zone_id = next(iter(state_data["zones"].keys()))
    assert first_zone_id.startswith("m_")

    # Reset back to Delhi NCR
    reset_payload = {"city": "delhi_ncr", "scenario": "cloudburst"}
    reset_res = client.post("/api/warning/select-scenario", json=reset_payload)
    assert reset_res.status_code == 200


def test_phase3_scenario_switching():
    payload = {"city": "delhi_ncr", "scenario": "upstream_dam_release"}
    res = client.post("/api/warning/select-scenario", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["scenario"] == "upstream_dam_release"

    # Reset to cloudburst
    reset_payload = {"city": "delhi_ncr", "scenario": "cloudburst"}
    client.post("/api/warning/select-scenario", json=reset_payload)


def test_phase3_streaming_websocket():
    with client.websocket_connect("/api/warning/stream") as websocket:
        data = websocket.receive_json()
        assert "t" in data
        assert "zones" in data
        assert "city_status" in data
        assert data["leakage_isolated"] is True
