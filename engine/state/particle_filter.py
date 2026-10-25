"""Deterministic scalar particle filter for per-zone risk."""
from __future__ import annotations

import numpy as np
from typing import Dict, List


class ParticleFilter:
    def __init__(self, n_particles: int = 1024, seed: int = 0):
        self.n = n_particles
        self.rng = np.random.default_rng(seed)
        self.particles: Dict[str, np.ndarray] = {}

    def init_zone(self, zone_id: str, init_risk: float = 0.1):
        self.particles[zone_id] = np.clip(
            init_risk + self.rng.normal(0, 0.05, size=self.n), 0, 1
        )

    def step(self, zone_id: str, obs: dict, rain: float, vulnerability: float, drainage: float):
        if zone_id not in self.particles:
            self.init_zone(zone_id)
        p = self.particles[zone_id]
        # process noise
        drift = (rain / 60.0) * (1 - drainage) * (0.5 + vulnerability) + self.rng.normal(0, 0.03, size=self.n)
        p = np.clip(p * 0.85 + drift, 0, 1)
        # likelihood from obs
        traffic = obs.get("traffic_index", 0.0)
        hosp = obs.get("hospital_load", 0.0)
        weight = np.exp(-((p - (0.5 * traffic + 0.5 * hosp)) ** 2) / (2 * 0.15 ** 2))
        weight = weight / (weight.sum() + 1e-12)
        # resample
        idx = self.rng.choice(self.n, size=self.n, p=weight)
        self.particles[zone_id] = p[idx]

    def mean(self, zone_id: str) -> float:
        return float(np.mean(self.particles[zone_id]))

    def quantile(self, zone_id: str, q: float) -> float:
        return float(np.quantile(self.particles[zone_id], q))

    def state_probs(self, zone_id: str):
        p = self.particles[zone_id]
        def frac(th): return float(np.mean(p >= th))
        return {
            "NORMAL": float(np.mean(p < 0.35)),
            "WATCH": float(np.mean((p >= 0.35) & (p < 0.6))),
            "HIGH_RISK": float(np.mean((p >= 0.6) & (p < 0.82))),
            "CRITICAL": float(np.mean(p >= 0.82)),
        }
