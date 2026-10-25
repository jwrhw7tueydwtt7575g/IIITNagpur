import pytest
from adapters.disaster_db import DisasterDatabaseManager, DISASTER_DB


def test_disaster_database_singleton():
    assert DISASTER_DB is not None
    assert isinstance(DISASTER_DB, DisasterDatabaseManager)


def test_disaster_database_cities_loaded():
    cities = DISASTER_DB.list_cities()
    assert "delhi_ncr" in cities
    assert "mumbai_coastal" in cities
    assert "kathmandu_valley" in cities


def test_delhi_landmark_simulation():
    res = DISASTER_DB.simulate_place_disaster(
        city="delhi_ncr",
        place_name="Ring Road Underpass #43",
        disaster_type="flood",
        severity=85,
    )
    assert res is not None
    assert res["place_name"] == "Ring Road Underpass #43"
    assert res["disaster_type"] == "flood"
    assert res["severity"] == 85
    assert len(res["failed_nodes"]) > 0
    assert "node_43" in res["failed_nodes"]
    assert len(res["actionable_directives"]) > 0
    assert len(res["chokepoints_breached"]) > 0
    assert "telemetry" in res
    assert res["node_updates"]


def test_mumbai_landmark_simulation():
    res = DISASTER_DB.simulate_place_disaster(
        city="mumbai_coastal",
        place_name="Kurla Mithi River Basin",
        disaster_type="flood",
        severity=90,
    )
    assert res is not None
    assert "Kurla" in res["place_name"] and "Mithi" in res["place_name"]
    assert len(res["failed_nodes"]) > 0
    assert "m_03" in res["failed_nodes"]
    assert len(res["actionable_directives"]) > 0


def test_kathmandu_landmark_simulation():
    res = DISASTER_DB.simulate_place_disaster(
        city="kathmandu_valley",
        place_name="Bagmati River Balkhu Corridor",
        disaster_type="flood",
        severity=80,
    )
    assert res is not None
    assert "Bagmati" in res["place_name"] or "Balkhu" in res["place_name"]
    assert len(res["failed_nodes"]) > 0
    assert "k_03" in res["failed_nodes"]


def test_unknown_landmark_graceful_simulation():
    # If a user types any custom landmark, it should gracefully produce realistic failures
    res = DISASTER_DB.simulate_place_disaster(
        city="delhi_ncr",
        place_name="Custom Sector 99 Peripheral Sump",
        disaster_type="cloudburst",
        severity=75,
    )
    assert res is not None
    assert res["place_name"] is not None
    assert len(res["failed_nodes"]) >= 1
    assert len(res["actionable_directives"]) >= 1


def test_feed_fallback_data():
    weather_fb = DISASTER_DB.get_feed_fallback("open_meteo", "delhi_ncr")
    assert weather_fb is not None
    assert "current" in weather_fb or "telemetry" in weather_fb or "weather" in weather_fb

    tomtom_fb = DISASTER_DB.get_feed_fallback("tomtom", "delhi_ncr")
    assert tomtom_fb is not None
    assert "flowSegmentData" in tomtom_fb


def test_bengaluru_landmark_simulation():
    res = DISASTER_DB.simulate_place_disaster(
        city="bengaluru_tech_corridor",
        place_name="Bellandur Lake Spillway & Outflow Sump",
        disaster_type="cloudburst",
        severity=85,
    )
    assert res is not None
    assert "Bellandur" in res["place_name"]
    assert len(res["failed_nodes"]) > 0
    assert "b_02" in res["failed_nodes"]


def test_sitrep_cases_catalog():
    cases = DISASTER_DB.list_report_cases()
    assert len(cases) >= 6
    case_ids = [c["case_id"] for c in cases]
    assert "delhi_cloudburst" in case_ids
    assert "mumbai_coastal_surge" in case_ids
    assert "bengaluru_lake_breach" in case_ids


def test_get_sitrep_dossier():
    dossier = DISASTER_DB.get_sitrep_case("delhi_cloudburst")
    assert dossier is not None
    assert "doc_id" in dossier
    assert "classification" in dossier
    assert "posture" in dossier
    assert "metrics" in dossier
    assert len(dossier["critical_breaches"]) > 0
    assert len(dossier["incident_directives"]) > 0
    assert "evacuation_telemetry" in dossier

