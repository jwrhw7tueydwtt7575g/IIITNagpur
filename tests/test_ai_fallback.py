import os
import sys
import pytest
from fastapi.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from adapters.ai_fallback import AIFallbackClient, AI_FALLBACK


def test_ai_fallback_singleton():
    assert AI_FALLBACK is not None
    assert isinstance(AI_FALLBACK, AIFallbackClient)


def test_simulate_place_disaster_fallback():
    # Tests that simulate_place_disaster always returns a valid, rich simulation result
    # even when OpenAI key fails or network is offline
    result = AI_FALLBACK.simulate_place_disaster(
        place_name="Ring Road Underpass #43",
        disaster_type="flood",
        severity=85,
        city="delhi_ncr",
    )
    assert result is not None
    assert result["place_name"] == "Ring Road Underpass #43"
    assert result["disaster_type"] == "flood"
    assert result["severity"] == 85
    assert isinstance(result["failed_nodes"], list)
    assert len(result["failed_nodes"]) > 0
    assert "node_43" in result["failed_nodes"]
    assert isinstance(result["node_updates"], dict)
    assert isinstance(result["actionable_directives"], list)
    assert len(result["actionable_directives"]) > 0


def test_feed_fallback_synthesis():
    feed_data = AI_FALLBACK.synthesize_feed_fallback(
        feed_name="open_meteo",
        city="delhi_ncr",
        context={"station": "Safdarjung", "expected": "heavy_rain"},
    )
    assert feed_data is not None
    assert isinstance(feed_data, dict)


def test_api_simulate_place_endpoint():
    client = TestClient(app)
    response = client.post(
        "/api/simulate/place",
        json={
            "place_name": "Ring Road Underpass #43",
            "disaster_type": "flood",
            "severity": 85,
            "city": "delhi_ncr",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "simulation" in data
    assert "failed_nodes" in data
    assert "node_43" in data["failed_nodes"]
    assert "summary" in data
    assert data["summary"]["failed_count"] > 0
    assert any(n["id"] == "node_43" for n in data["nodes"])

    # Verify node_43 load and risk were updated in the node state
    node_43 = next(n for n in data["nodes"] if n["id"] == "node_43")
    assert node_43["status"] == "failed"
    assert node_43["load"] >= 0.90


def test_api_reports_cases():
    client = TestClient(app)
    res = client.get("/api/reports/cases")
    assert res.status_code == 200
    data = res.json()
    assert "cases" in data
    assert len(data["cases"]) >= 6


def test_api_reports_case_detail():
    client = TestClient(app)
    res = client.get("/api/reports/case/delhi_cloudburst")
    assert res.status_code == 200
    dossier = res.json()
    assert dossier["case_id"] == "delhi_cloudburst"
    assert "doc_id" in dossier
    assert "metrics" in dossier
    assert "critical_breaches" in dossier


def test_api_reports_generate_endpoint():
    client = TestClient(app)
    res = client.post(
        "/api/reports/generate",
        json={
            "place_name": "Ring Road Underpass #43",
            "disaster_type": "flood",
            "severity": 85,
            "city": "delhi_ncr",
        },
    )
    assert res.status_code == 200
    dossier = res.json()
    assert "doc_id" in dossier
    assert "title" in dossier
    assert "Ring Road" in dossier["title"]
    assert "metrics" in dossier
    assert "incident_directives" in dossier

