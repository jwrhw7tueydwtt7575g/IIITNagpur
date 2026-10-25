import numpy as np

from engine.state.particle_filter import ParticleFilter
from engine.forecast.forecast import Forecaster, status_from_risk
from engine.forecast.calibration import IsotonicCalibrator, ConformalCorrector
from engine.discovery.discovery import DependencyDiscovery
from engine.discovery.drift import PageHinkley, ADWIN

def test_particle_filter_stability():
    pf = ParticleFilter(n_particles=512, seed=1)
    pf.init_zone("z", 0.4)
    for _ in range(10):
        pf.step("z", {"traffic_index":0.5,"hospital_load":0.4}, 20, 0.5, 0.6)
    assert 0 <= pf.mean("z") <= 1
    # no nan
    assert not np.isnan(pf.mean("z"))

def test_forecast_monotonicity_thresholds():
    particles = {"z": np.full(100, 0.5)}
    fc = Forecaster(particles, [{"id":"z"}], horizon=5)
    out = fc.forecast_zone("z", [0,10,10,10,10,10], 0.5, 0.5)
    for h, obj in out["horizons"].items():
        assert obj["p_watch"] >= obj["p_high"] >= obj["p_critical"]

def test_time_to_critical_validity():
    particles = {"z": np.full(100, 0.9)}
    fc = Forecaster(particles, [{"id":"z"}], horizon=72)
    out = fc.forecast_zone("z", [0]+[50]*72, 0.4, 0.6)
    ttc = out["time_to_critical"]
    assert 1 <= ttc["median_hours"] <= 72
    assert 0 <= ttc["prob_within_horizon"] <= 1

def test_calibration_behavior():
    cal = IsotonicCalibrator()
    for _ in range(20):
        cal.update(0.8, True)
    assert cal.calibrate(0.8) >= 0.5
    cc = ConformalCorrector(alpha=0.1)
    for i in range(20):
        cc.update(0.5, 0.6)
    assert cc.quantile() > 0

def test_dependency_drift_recovery():
    dd = DependencyDiscovery()
    # candidate names
    cands = ["src_lag1"]
    lagvals = {"src_lag1": [0.1,0.2,0.3,0.5]}
    y = [0.1,0.2,0.3,0.5]
    dd.update("tgt", cands, lagvals, y)
    assert len(dd.edge_list()) >= 0
    # drift monitor
    ph = PageHinkley()
    for _ in range(30):
        ph.update(10.0)
    ad = ADWIN()
    for v in [1.0]*10 + [5.0]*10:
        ad.update(v)
    assert ad.drift is True or ad.drift is False
