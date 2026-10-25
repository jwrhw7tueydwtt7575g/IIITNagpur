from quality.fault_detectors import hampel_flags, stuck_at, cusum_drift, cross_source_contradiction
from quality.report_credibility import credibility
from quality.data_health import DataHealthMonitor
from quality.reliability import BetaReliability


def test_bad_sensor_detection():
    vals = [1,1,1,100,1,1]
    flags = hampel_flags(vals)
    assert flags[3] is True
    assert stuck_at([5,5,5,5,5]) is True


def test_fake_report_classification():
    c = credibility(physical=True, geo=True, burst=0.0, corroboration=0.1, reporter_history=0.2)
    assert c < 0.8
    c2 = credibility(physical=True, geo=True, burst=0.0, corroboration=0.9, reporter_history=0.9)
    assert c2 > c


def test_contradictory_sources():
    assert cross_source_contradiction([10.0], [1.0], threshold=0.5) is True


def test_stale_propagation():
    m = DataHealthMonitor()
    m.update_source("src", success=True, age_minutes=200, contradictory=False)
    assert m.states["src"] == "stale"
    assert m.uncertainty_multiplier("stale") > 1.0


def test_confidence_degradation():
    r = BetaReliability()
    for _ in range(5):
        r.update(False)
    assert r.mean() < 0.5
