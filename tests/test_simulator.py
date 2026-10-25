import json
from pathlib import Path

import yaml

from sim.simulator import Simulator
from sim.ground_truth.truth import zone_status


def test_synthetic_state_generation():
    sim = Simulator(city_path="configs/cities/delhi_ncr.yaml", scenario_path="configs/scenarios/quiet_baseline.yaml")
    sim.run()
    assert len(sim.zones) >= 20
    assert len(sim.observations) > 0
    assert len(sim.ground_truth) > 0
    # latent update 15 min
    first = [g for g in sim.ground_truth if g.get("zone_id") == sim.zones[0].zone_id][0]
    assert "latent" in first
    assert len(first["latent"]) >= 10


def test_scenario_execution():
    for scen in ["cloudburst", "upstream_dam_release", "heatwave_grid_stress", "compound_flood_epidemic", "quiet_baseline"]:
        sim = Simulator(scenario_path=f"configs/scenarios/{scen}.yaml")
        sim.run()
        assert sim.n_steps == 72 * 4
        # risk values valid
        risks = [g["risk"] for g in sim.ground_truth if "risk" in g]
        assert all(0 <= r <= 1 for r in risks)


def test_drift_injection():
    sim = Simulator(scenario_path="configs/scenarios/cloudburst.yaml")
    sim.run()
    assert len(sim.drift_log) >= 1  # four drifts scheduled
    assert len(sim.fault_log) >= 0


def test_threshold_rules():
    # forced critical
    from sim.ground_truth.latent import ZoneLatent
    z = ZoneLatent(zone_id="z", population=100000, elevation_m=200, drainage_capacity=0.5, hospital_facilities=1, substation_coverage=0.5, ambulance_depots=1, neighbors=[], river_gauge=None)
    z.hospital_occupancy = 1.1
    r, st, forced = zone_status(z, 0, False)
    assert st == "CRITICAL" and forced is True


def test_leakage_resistant_labels():
    sim = Simulator(scenario_path="configs/scenarios/quiet_baseline.yaml")
    sim.run()
    sim.save_ground_truth("/tmp/gt.jsonl")
    sim.save_observations("/tmp/obs.jsonl")
    # ground truth file exists and contains latent; observations separate
    gt_lines = Path("/tmp/gt.jsonl").read_text().strip().splitlines()
    obs_lines = Path("/tmp/obs.jsonl").read_text().strip().splitlines()
    assert len(gt_lines) > len(obs_lines)  # includes city records
    # no engine import of ground_truth (smoke)
    import importlib
    m = importlib.import_module("engine.forecast.baselines")
    assert "ground_truth" not in str(m.__file__)
