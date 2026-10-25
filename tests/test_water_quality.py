"""Automated tests for JalNetra Optical Water Quality & NGO/Hospital Alert Microservice."""

import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parent.parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from main import app

client = TestClient(app)


def test_water_quality_health():
    res = client.get("/api/v1/water-quality/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "jalnetra" in data["service"]


def test_water_quality_cities():
    res = client.get("/api/v1/cities")
    assert res.status_code == 200
    data = res.json()
    assert "presets" in data
    assert "delhi" in data["presets"]
    assert "mumbai" in data["presets"]
    assert "facilities" in data
    assert "delhi" in data["facilities"]
    assert "mumbai" in data["facilities"]


def test_water_quality_city_delhi():
    res = client.get("/api/v1/water-quality/city/delhi")
    assert res.status_code == 200
    data = res.json()
    assert data["city"] == "Delhi"
    assert "Yamuna" in data["location_name"]
    assert data["satellite_mission"] == "Sentinel-2 L2A"

    # Optical bands
    bands = data["bands_reflectance"]
    assert bands["b02_blue"] > 0
    assert bands["b03_green"] > 0
    assert bands["b04_red"] > 0
    assert bands["b05_rededge"] > 0
    assert bands["b08_nir"] > 0
    assert bands["b11_swir"] > 0

    # Optical indices
    indices = data["optical_indices"]
    assert indices["is_water_detected"] is True
    assert indices["mndwi_extent"] > 0.0
    assert -1.0 <= indices["ndti_turbidity"] <= 1.0
    assert -1.0 <= indices["ndci_chlorophyll"] <= 1.0

    # Anomaly Assessment
    assessment = data["anomaly_assessment"]
    assert assessment["severity"] in ["NORMAL", "WATCH", "ADVISORY", "ALERT"]
    assert 0.0 <= assessment["contamination_score"] <= 100.0


def test_water_quality_city_mumbai():
    res = client.get("/api/v1/water-quality/city/mumbai")
    assert res.status_code == 200
    data = res.json()
    assert data["city"] == "Mumbai"
    assert "Powai" in data["location_name"]
    assert data["optical_indices"]["is_water_detected"] is True


def test_water_quality_custom_point():
    res = client.get("/api/v1/water-quality/point?lat=28.5441&lon=77.3094&location_name=Yamuna%20Okhla")
    assert res.status_code == 200
    data = res.json()
    assert data["location_name"] == "Yamuna Okhla"
    assert data["coordinates"]["latitude"] == 28.5441
    assert data["optical_indices"]["is_water_detected"] is True


def test_water_quality_dispatch_alert():
    payload = {
        "city": "Delhi",
        "location_name": "Yamuna River (Okhla Barrage)",
        "coordinates": {"latitude": 28.5441, "longitude": 77.3094},
        "severity": "ADVISORY",
        "contamination_score": 60.0,
        "primary_indicator": "turbidity & algal bloom",
        "recipient_type": "both",
        "custom_notes": "Sentinel-2 L2A optical water monitoring verification.",
    }
    res = client.post("/api/v1/water-quality/dispatch-alert", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "DISPATCHED"
    assert "JALNETRA-ALERT" in data["doc_id"]
    assert len(data["target_recipients"]) >= 3
    assert len(data["clinical_precautions"]) >= 2
    assert len(data["immediate_field_actions"]) >= 2
    assert len(data["executive_advisory"]) > 20
