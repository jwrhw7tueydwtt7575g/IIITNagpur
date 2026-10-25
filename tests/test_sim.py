import json
from pathlib import Path

import yaml

from sim.city_sim import CitySim


def test_sim_deterministic():
    with open("configs/default.yaml") as f:
        cfg = yaml.safe_load(f)
    a = CitySim(cfg)
    b = CitySim(cfg)
    a.run()
    b.run()
    assert [g.risk for g in a.ground_truth] == [g.risk for g in b.ground_truth]
    assert len(a.ground_truth) == (cfg["horizon_hours"] + 1) * len(cfg["zones"])


def test_ground_truth_log_and_states():
    with open("configs/default.yaml") as f:
        cfg = yaml.safe_load(f)
    sim = CitySim(cfg)
    sim.run()
    path = sim.log_ground_truth("/tmp/gt.jsonl")
    lines = Path(path).read_text().strip().splitlines()
    assert len(lines) == len(sim.ground_truth)
    rec = json.loads(lines[0])
    assert rec["status"] in {"NORMAL", "WATCH", "HIGH_RISK", "CRITICAL"}
    assert 0.0 <= rec["risk"] <= 1.0
