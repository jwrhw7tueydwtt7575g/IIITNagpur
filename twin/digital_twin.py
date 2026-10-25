"""Digital twin for internal non-public city systems."""
from __future__ import annotations
import numpy as np


class DigitalTwin:
    def __init__(self, seed: int = 0):
        self.rng = np.random.default_rng(seed)
        self.state = {}

    def update(self, zone_id: str, risk: float):
        self.state[zone_id] = {
            "hospital_load": min(1.0, 0.3 + risk * 0.6 + float(self.rng.normal(0, 0.02))),
            "power_load": min(1.0, 0.25 + risk * 0.5 + float(self.rng.normal(0, 0.02))),
            "ambulance_availability": max(0.0, 1.0 - risk * 0.4),
            "emergency_call_rate": risk * 12 + float(self.rng.normal(0, 1)),
        }

    def snapshot(self, zone_id: str):
        return self.state.get(zone_id, {})
