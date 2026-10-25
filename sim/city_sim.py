"""Deterministic 72-hour urban cascade simulator.

Public feeds are represented by deterministic synthetic series seeded for
reproducibility.  The simulator records ground truth separately so later
forecast, discovery, and intervention components can be evaluated without
data leakage.
"""
from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List

import numpy as np

STATUSES = ["NORMAL", "WATCH", "HIGH_RISK", "CRITICAL"]

THRESHOLDS = {
    "WATCH": 0.35,
    "HIGH_RISK": 0.6,
    "CRITICAL": 0.82,
}


def status_from_risk(risk: float) -> str:
    if risk >= THRESHOLDS["CRITICAL"]:
        return "CRITICAL"
    if risk >= THRESHOLDS["HIGH_RISK"]:
        return "HIGH_RISK"
    if risk >= THRESHOLDS["WATCH"]:
        return "WATCH"
    return "NORMAL"


@dataclass
class Zone:
    id: str
    name: str
    vulnerability: float
    drainage_capacity: float = field(default=0.0)
    population_k: float = field(default=0.0)


@dataclass
class Observation:
    t: int
    zone_id: str
    rain_mm_hr: float
    river_level_m: float
    traffic_index: float
    emergency_calls: int
    hospital_load: float
    power_load: float
    sensor_quality: float
    news_report_count: int


@dataclass
class GroundTruth:
    t: int
    zone_id: str
    risk: float
    status: str
    drivers: Dict[str, float]


class CitySim:
    def __init__(self, config: dict, seed: int | None = None):
        self.config = config
        self.seed = config.get("seed", 42) if seed is None else seed
        self.rng = random.Random(self.seed)
        self.np_rng = np.random.default_rng(self.seed)
        self.horizon = config["horizon_hours"]
        self.step = config["step_hours"]
        self.zones: List[Zone] = []
        for z in config["zones"]:
            self.zones.append(
                Zone(
                    id=z["id"],
                    name=z["name"],
                    vulnerability=z["vulnerability"],
                    drainage_capacity=round(self.rng.uniform(0.4, 0.9), 3),
                    population_k=round(self.rng.uniform(100, 900), 1),
                )
            )
        self.zone_by_id = {z.id: z for z in self.zones}
        # Ground-truth dependency matrix (not shown to models).
        self.dependencies: Dict[str, List[str]] = {}
        for z in self.zones:
            # each zone depends on 1-3 upstream zones deterministically
            others = [o.id for o in self.zones if o.id != z.id]
            k = self.rng.randint(1, min(3, len(others)))
            self.dependencies[z.id] = self.rng.sample(others, k)
        self.ground_truth: List[GroundTruth] = []
        self.observations: List[Observation] = []
        self._rain_series = self._make_rain_series()

    def _make_rain_series(self) -> List[float]:
        pattern = self.config.get("rainfall_pattern", "default")
        out = []
        for t in range(self.horizon + 1):
            if pattern == "cloudburst" or self.config.get("cloudburst", False):
                base = 8.0
                pulse = 88.0 if 6 <= t <= 18 else (24.0 if 19 <= t <= 26 else 0.0)
                noise = float(self.np_rng.normal(0, 1.8))
                out.append(max(0.0, round(base + pulse + noise, 2)))
            elif pattern == "upstream_dam_release" or self.config.get("dam_release", False):
                base = 18.0 + 6.0 * math.sin(t / 8.0)
                pulse = 36.0 if 14 <= t <= 26 else 0.0
                noise = float(self.np_rng.normal(0, 1.4))
                out.append(max(0.0, round(base + pulse + noise, 2)))
            elif pattern == "compound_flood_epidemic" or self.config.get("disease_outbreak", False):
                base = 24.0 + 12.0 * math.sin(t / 5.0)
                pulse = 32.0 if 10 <= t <= 32 else 0.0
                noise = float(self.np_rng.normal(0, 1.6))
                out.append(max(0.0, round(base + pulse + noise, 2)))
            elif pattern == "heatwave_grid_stress" or self.config.get("heatwave", False):
                out.append(max(0.0, round(float(self.np_rng.uniform(0.0, 1.2)), 2)))
            elif pattern == "quiet_baseline":
                out.append(max(0.0, round(2.0 + 1.2 * math.sin(t / 12.0) + float(self.np_rng.normal(0, 0.4)), 2)))
            else:
                base = 4 + 12 * math.sin(t / 6.0)
                pulse = 35 if 18 <= t <= 28 else 0
                pulse += 22 if 46 <= t <= 52 else 0
                noise = float(self.np_rng.normal(0, 1.5))
                out.append(max(0.0, round(base + pulse + noise, 2)))
        return out

    def run(self) -> None:
        """Generate all hours of ground truth and observations."""
        risk_state = {z.id: 0.1 for z in self.zones}
        river_base = 205.0
        dam_release = self.config.get("dam_release", False) or self.config.get("rainfall_pattern") == "upstream_dam_release"
        heatwave = self.config.get("heatwave", False) or self.config.get("rainfall_pattern") == "heatwave_grid_stress"
        disease = self.config.get("disease_outbreak", False) or self.config.get("rainfall_pattern") == "compound_flood_epidemic"

        for t in range(self.horizon + 1):
            rain = self._rain_series[t]
            river = river_base + 0.04 * sum(self._rain_series[: t + 1]) + float(self.np_rng.normal(0, 0.05))
            if dam_release and 12 <= t <= 48:
                river += 3.8 * math.sin((t - 12) / 36.0 * math.pi)

            for z in self.zones:
                drainage = self.zone_by_id[z.id].drainage_capacity
                driver = 0.0
                driver += (rain / 60.0) * (1 - drainage) * (0.6 + 0.8 * z.vulnerability)
                driver += max(0, (river - 206.0) / 4.0) * 0.35
                if heatwave and 8 <= t <= 56:
                    driver += 0.18 * z.vulnerability
                # cascade from upstream dependencies
                cascade_bonus = 0.0
                for dep in self.dependencies[z.id]:
                    cascade_bonus += risk_state[dep] * 0.12
                # decay
                risk_state[z.id] = min(1.0, risk_state[z.id] * 0.84 + driver + cascade_bonus * 0.0)
                # Actually apply dependency propagation to risk:
                risk_state[z.id] = min(1.0, risk_state[z.id] + 0.15 * cascade_bonus)
                risk_state[z.id] = max(0.0, risk_state[z.id] + float(self.np_rng.normal(0, 0.02)))
                st = status_from_risk(risk_state[z.id])
                self.ground_truth.append(
                    GroundTruth(
                        t=t,
                        zone_id=z.id,
                        risk=round(risk_state[z.id], 4),
                        status=st,
                        drivers={
                            "rain": round(rain, 2),
                            "river": round(river, 3),
                            "drainage": drainage,
                            "vulnerability": z.vulnerability,
                            "cascade_bonus": round(cascade_bonus, 4),
                        },
                    )
                )
                # observations with noise and possible sensor degradation
                sensor_quality = round(self.rng.uniform(0.7, 1.0), 3)
                hosp_boost = 0.35 if (disease and t >= 10) else 0.0
                power_boost = 0.40 if (heatwave and 8 <= t <= 56) else 0.0
                traffic = min(1.0, 0.2 + risk_state[z.id] * 0.7 + float(self.np_rng.normal(0, 0.05)))
                calls = int(max(0, (risk_state[z.id] + hosp_boost * 0.5) * 14 + self.rng.randint(0, 3)))
                hosp = min(1.0, 0.3 + hosp_boost + risk_state[z.id] * 0.6)
                power = min(1.0, 0.25 + power_boost + risk_state[z.id] * 0.5)
                news = self.rng.randint(0, 3) if risk_state[z.id] > 0.5 else self.rng.randint(0, 1)
                self.observations.append(
                    Observation(
                        t=t,
                        zone_id=z.id,
                        rain_mm_hr=rain,
                        river_level_m=round(river, 3),
                        traffic_index=round(traffic, 3),
                        emergency_calls=calls,
                        hospital_load=round(hosp, 3),
                        power_load=round(power, 3),
                        sensor_quality=sensor_quality,
                        news_report_count=news,
                    )
                )

    def log_ground_truth(self, path: str | Path) -> Path:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("w", encoding="utf-8") as f:
            for gt in self.ground_truth:
                f.write(
                    json.dumps(
                        {"t": gt.t, "zone_id": gt.zone_id, "risk": gt.risk, "status": gt.status, "drivers": gt.drivers}
                    )
                    + "\n"
                )
        return p

    def save_observations(self, path: str | Path) -> Path:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("w", encoding="utf-8") as f:
            for o in self.observations:
                f.write(json.dumps(o.__dict__) + "\n")
        return p


if __name__ == "__main__":
    import yaml

    cfg_path = Path("configs/default.yaml")
    with cfg_path.open() as f:
        cfg = yaml.safe_load(f)
    sim = CitySim(cfg)
    sim.run()
    sim.log_ground_truth(cfg["output"]["ground_truth_path"])
    sim.save_observations("data/observations.jsonl")
    print(f"Generated {len(sim.ground_truth)} ground-truth records and {len(sim.observations)} observations")
