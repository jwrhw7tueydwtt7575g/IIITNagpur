import subprocess, pathlib
from pathlib import Path

from quality.data_health import DataHealthMonitor
from engine.forecast.calibration import IsotonicCalibrator
from engine.cascade.cascade import extract_cascades
from engine.intervene.planner import plan
from ingest import EventTimeStore


def test_engine_import_restrictions():
    engine_files = list(Path("engine").rglob("*.py"))
    bad = []
    for p in engine_files:
        text = p.read_text()
        if "sim/ground_truth" in text or "sim.ground_truth" in text or "from sim.ground_truth" in text:
            bad.append(str(p))
    assert not bad, bad


def test_data_arrival_filtering_and_no_future_leakage():
    store = EventTimeStore(db_path="/tmp/final_store.duckdb")
    store.con.execute("DELETE FROM records")
    for t in [1,2,3]:
        store.insert([{"source":"s","stream":"st","station_id":"z","variable":"v","value":t,"unit":"u","event_time":t,"arrival_time":t,"quality_flags":[]}])
    # at t=2, no record with arrival 3 visible
    visible = store.read_at(2)
    assert all(r["arrival_time"] <= 2 for r in visible)
    # leakage: outputs before t unchanged when future perturbed
    before = store.read_at(2)
    store.con.execute("DELETE FROM records WHERE arrival_time=3")
    store.insert([{"source":"s","stream":"st","station_id":"z","variable":"v","value":999,"unit":"u","event_time":3,"arrival_time":3,"quality_flags":[]}])
    after = store.read_at(2)
    assert before == after


def test_degraded_calibration_missing_fake():
    cal = IsotonicCalibrator()
    # degraded data (mostly false)
    for _ in range(10):
        cal.update(0.8, False)
    assert cal.calibrate(0.8) <= 0.8
    m = DataHealthMonitor()
    m.update_source("fake_src", success=False, age_minutes=10, contradictory=True)
    assert m.states.get("fake_src") in {"suspect","stale"}


def test_cascade_and_intervention_validity():
    risk = {"a":0.9,"b":0.7}
    edges = [{"source":"a","target":"b"}]
    c = extract_cascades(risk, edges)
    assert "chains" in c and isinstance(c["chains"], list)
    iv = plan(risk, edges, budget=2)
    assert iv["budget"] == 2
    assert len(iv["plans"]) >= 1
