import json
from pathlib import Path

import yaml

from sim.city_sim import CitySim
from ingest.stream_store import StreamStore
from ingest.replay_clock import ReplayClock
from ingest.leakage import assert_no_future_data, filter_past


def test_stream_and_leakage():
    with open("configs/default.yaml") as f:
        cfg = yaml.safe_load(f)
    sim = CitySim(cfg)
    sim.run()
    store = StreamStore("/tmp/stream.jsonl")
    store.reset()
    store.bulk_load([o.__dict__ for o in sim.observations])
    clock = ReplayClock(start=5)
    records = store.read_until(clock.now)
    assert all(r["t"] <= 5 for r in records)
    # cannot see future
    future = store.read_all()
    past = filter_past(future, 5)
    assert len(past) <= len(future)
    assert_no_future_data(past, 5)
