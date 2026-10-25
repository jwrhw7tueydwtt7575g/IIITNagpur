from __future__ import annotations

import yaml
from pathlib import Path

from sim.city_sim import CitySim
from ingest.stream_store import StreamStore
from ingest.replay_clock import ReplayClock
from engine.forecast.baselines import estimate_zone_risk, persistence_forecast, apply_rain_adjustment
from engine.state.thresholds import status_from_risk


def run_eval(config_path: str = "configs/default.yaml"):
    with open(config_path) as f:
        cfg = yaml.safe_load(f)
    sim = CitySim(cfg)
    sim.run()

    store = StreamStore("data/obs_eval.jsonl")
    store.reset()
    store.bulk_load([o.__dict__ for o in sim.observations])

    zones = [z["id"] for z in cfg["zones"]]
    # ground truth lookup
    gt = {}
    for g in sim.ground_truth:
        gt[(g.t, g.zone_id)] = (g.risk, g.status)

    horizons = [1, 6, 24, 72]
    results = {h: {"mae": 0.0, "state_acc": 0.0, "n": 0} for h in horizons}

    eval_times = list(range(12, sim.horizon - 72, 6))
    if not eval_times:
        eval_times = [12]

    for t0 in eval_times:
        clock = ReplayClock(start=t0)
        records = store.read_until(clock.now)
        obs_by_zone = {}
        for z in zones:
            zone_recs = [r for r in records if r["zone_id"] == z]
            if zone_recs:
                obs_by_zone[z] = zone_recs[-1]
        rain = list({r["rain_mm_hr"] for r in records if r["t"] == t0})
        rain_mm = rain[0] if rain else 0.0
        risk_est = estimate_zone_risk(obs_by_zone)
        # adjust for rain
        for z in risk_est:
            bump = min(0.2, rain_mm / 250.0)
            risk_est[z] = max(0.0, min(1.0, risk_est[z] + bump))
        fc = persistence_forecast(risk_est, horizons)
        fc = apply_rain_adjustment(fc, rain_mm)
        for h in horizons:
            if t0 + h > sim.horizon:
                continue
            for z in zones:
                pred_r = fc[h][z]
                true_r, true_s = gt[(t0 + h, z)]
                results[h]["mae"] += abs(pred_r - true_r)
                if status_from_risk(pred_r) == true_s:
                    results[h]["state_acc"] += 1
                results[h]["n"] += 1

    for h in horizons:
        n = max(1, results[h]["n"])
        results[h]["mae"] = round(results[h]["mae"] / n, 4)
        results[h]["state_acc"] = round(results[h]["state_acc"] / n, 4)

    return {"horizons": results, "n_eval_times": len(eval_times)}
