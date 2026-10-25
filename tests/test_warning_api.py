"""Automated integration tests for the 72-Hour Warning System API."""

import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add backend directory to path
backend_path = Path(__file__).resolve().parent.parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from main import app

client = TestClient(app)


def test_warning_health():
    response = client.get("/api/warning/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "72-hour-warning-engine"
    assert "four_risk_states" in data
    assert "CRITICAL" in data["four_risk_states"]
    assert "thresholds" in data


def test_warning_current_risk_state():
    response = client.get("/api/warning/state")
    assert response.status_code == 200
    data = response.json()
    assert "city_status" in data
    assert data["city_status"] in {"NORMAL", "WATCH", "HIGH_RISK", "CRITICAL"}
    assert "zones" in data
    assert len(data["zones"]) > 0

    # Validate 4 calibrated probabilities on zones
    sample_zone = next(iter(data["zones"].values()))
    assert "probs" in sample_zone
    assert "NORMAL" in sample_zone["probs"]
    assert "WATCH" in sample_zone["probs"]
    assert "HIGH_RISK" in sample_zone["probs"]
    assert "CRITICAL" in sample_zone["probs"]
    assert 0.0 <= sample_zone["risk"] <= 1.0


def test_warning_multi_horizon_forecast():
    # Test bulk forecast
    response = client.get("/api/warning/forecast?horizon=72")
    assert response.status_code == 200
    data = response.json()
    assert "zones" in data
    sample_zone_id = next(iter(data["zones"].keys()))
    assert "time_to_critical" in data["zones"][sample_zone_id]
    assert "checkpoints" in data["zones"][sample_zone_id]

    # Test single zone detailed forecast
    single_res = client.get(f"/api/warning/forecast?zone={sample_zone_id}&horizon=72")
    assert single_res.status_code == 200
    single_data = single_res.json()
    assert single_data["zone_id"] == sample_zone_id
    assert "horizons" in single_data
    assert "1" in single_data["horizons"]


def test_warning_cascades_and_dependencies():
    # Cascades
    casc_res = client.get("/api/warning/cascades")
    assert casc_res.status_code == 200
    casc_data = casc_res.json()
    assert "cascades" in casc_data
    assert "branch_nodes" in casc_data
    assert "feedback_loops" in casc_data

    # Dependencies
    deps_res = client.get("/api/warning/dependencies")
    assert deps_res.status_code == 200
    deps_data = deps_res.json()
    assert "edges" in deps_data
    assert isinstance(deps_data["edges"], list)


def test_warning_causal_explainability():
    state_res = client.get("/api/warning/state")
    zone_id = next(iter(state_res.json()["zones"].keys()))

    explain_res = client.get(f"/api/warning/explain?zone={zone_id}&t1=0&t2=12")
    assert explain_res.status_code == 200
    exp_data = explain_res.json()
    assert exp_data["zone"] == zone_id
    assert "status" in exp_data
    assert "attribution" in exp_data
    assert "narrative" in exp_data
    assert len(exp_data["attribution"]) > 0


def test_warning_counterfactual_interventions():
    payload = {"budget": 5}
    int_res = client.post("/api/warning/interventions", json=payload)
    assert int_res.status_code == 200
    int_data = int_res.json()
    assert int_data["budget"] == 5
    assert "available_actions" in int_data
    assert "recommended_plans" in int_data
    assert len(int_data["recommended_plans"]) > 0

    # Ensure broken links and side effects are calculated
    first_plan = int_data["recommended_plans"][0]
    assert "action" in first_plan
    assert "benefit" in first_plan
    assert "broken_links" in first_plan
    assert "side_effects" in first_plan


def test_warning_data_health_and_adversarial():
    dh_res = client.get("/api/warning/data-health")
    assert dh_res.status_code == 200
    dh_data = dh_res.json()
    assert "states" in dh_data
    assert "reliability" in dh_data
    assert "adversarial_reports_detected" in dh_data


def test_warning_replay_clock_and_leakage_isolation():
    replay_res = client.post("/api/warning/replay", json={"t": 18})
    assert replay_res.status_code == 200
    replay_data = replay_res.json()
    assert replay_data["t"] == 18
    assert replay_data["future_data_leakage_prevented"] is True


def test_warning_scenarios_and_evaluation():
    scen_res = client.get("/api/warning/scenarios")
    assert scen_res.status_code == 200
    scen_data = scen_res.json()
    assert "available_cities" in scen_data
    assert "delhi_ncr" in scen_data["available_cities"]
    assert "available_scenarios" in scen_data

    eval_res = client.get("/api/warning/eval-summary")
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert "horizons" in eval_data or "metrics" in eval_data
