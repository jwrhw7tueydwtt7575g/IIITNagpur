"""Automated tests for 72-Hour Warning System 10-second live simulation and multi-city scenarios."""

import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parent.parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from main import app

client = TestClient(app)


def test_live_feed_nominal_green():
    """Verify live feed mode stays 100% green and nominal (< 0.35 risk)."""
    # Select live_feed
    sel = client.post("/api/warning/select-scenario", json={"city": "delhi_ncr", "scenario": "live_feed"})
    assert sel.status_code == 200
    assert sel.json()["scenario"] == "live_feed"

    # Fetch live tick
    res = client.get("/api/warning/live-tick")
    assert res.status_code == 200
    data = res.json()
    assert data["is_live_feed"] is True
    assert data["city_status"] == "NORMAL"
    assert data["city_risk_avg"] < 0.35
    assert data["countdown_sec"] == 10

    # Every single zone must be NORMAL (< 0.35)
    for zid, zinfo in data["zones"].items():
        assert zinfo["risk"] < 0.35, f"Zone {zid} exceeded normal risk threshold: {zinfo['risk']}"
        assert zinfo["status"] == "NORMAL"
        assert zinfo["probs"]["NORMAL"] > 0.80
        # Digital twin nominal bounds
        twin = zinfo["twin"]
        assert twin["drainage_load"] < 0.40
        assert twin["traffic_delay_index"] < 0.45


def test_live_feed_state_endpoint_consistency():
    """Verify /api/warning/state matches live tick in live_feed mode."""
    client.post("/api/warning/select-scenario", json={"city": "delhi_ncr", "scenario": "live_feed"})
    res = client.get("/api/warning/state")
    assert res.status_code == 200
    data = res.json()
    assert data["city_status"] == "NORMAL"
    assert data["city_risk_avg"] < 0.35
    for zid, zinfo in data["zones"].items():
        assert zinfo["status"] == "NORMAL"
        assert zinfo["risk"] < 0.35


def test_scenario_switching_and_multi_city():
    """Verify switching across cities and crisis scenarios from default dataset."""
    cities_and_scenarios = [
        ("mumbai", "compound_flood_epidemic"),
        ("kathmandu", "cloudburst"),
        ("bengaluru", "heatwave_grid_stress"),
        ("delhi_ncr", "upstream_dam_release"),
        ("delhi_ncr", "live_feed"),
    ]

    for city, scenario in cities_and_scenarios:
        res = client.post("/api/warning/select-scenario", json={"city": city, "scenario": scenario})
        assert res.status_code == 200
        d = res.json()
        assert d["city"] == city
        assert d["scenario"] == scenario

        # Verify live tick functions across all cities
        tick = client.get("/api/warning/live-tick")
        assert tick.status_code == 200
        tick_data = tick.json()
        assert tick_data["city"] == city
        assert len(tick_data["zones"]) >= 5


def test_scenarios_list_includes_live_feed():
    """Verify scenarios endpoint advertises live_feed and all 4 supported cities."""
    res = client.get("/api/warning/scenarios")
    assert res.status_code == 200
    data = res.json()
    assert "live_feed" in data["available_scenarios"]
    for c in ["delhi_ncr", "mumbai", "kathmandu", "bengaluru"]:
        assert c in data["available_cities"]
