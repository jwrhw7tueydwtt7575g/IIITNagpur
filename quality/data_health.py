from __future__ import annotations
from .reliability import BetaReliability


class DataHealthMonitor:
    def __init__(self):
        self.reliability = {}
        self.states = {}  # key -> state

    def reliability_for(self, source_id):
        if source_id not in self.reliability:
            self.reliability[source_id] = BetaReliability()
        return self.reliability[source_id]

    def update_source(self, source_id, success, age_minutes, contradictory=False):
        r = self.reliability_for(source_id)
        r.update(success)
        st = r.state(age_minutes, contradictory)
        # quota-paused override
        self.states[source_id] = st
        return st

    def set_quota_paused(self, source_id):
        self.states[source_id] = "quota-paused"

    def per_zone_health(self, quality_map):
        # quality_map: zone_id -> {age, contradictory, sources:[...]}
        out = {}
        for zone, info in quality_map.items():
            ages = info.get("ages", [])
            age = max(ages) if ages else 999
            contr = info.get("contradictory", False)
            if age > 120:
                st = "stale"
            elif contr:
                st = "suspect"
            else:
                st = "fresh"
            out[zone] = st
        return out

    def uncertainty_multiplier(self, state, contradictory=False):
        base = {"fresh":1.0, "stale":1.5, "suspect":2.0, "quota-paused":1.8}
        m = base.get(state, 1.5)
        if contradictory:
            m *= 1.5
        return m
