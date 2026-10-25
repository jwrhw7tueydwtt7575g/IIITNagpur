from __future__ import annotations
from typing import Dict, List


def estimate_zone_risk(obs_by_zone: dict) -> Dict[str, float]:
    out = {}
    for z, o in obs_by_zone.items():
        r = (
            0.35 * o.get("traffic_index", 0.0)
            + 0.25 * o.get("hospital_load", 0.0)
            + 0.20 * o.get("power_load", 0.0)
            + 0.15 * min(1.0, o.get("emergency_calls", 0) / 12.0)
            + 0.10 * min(1.0, o.get("news_report_count", 0) / 5.0)
        )
        out[z] = max(0.0, min(1.0, round(r, 4)))
    return out


class PersistenceBaseline:
    def forecast(self, risk_est, horizons):
        return {h: dict(risk_est) for h in horizons}


def persistence_forecast(risk_est: dict, horizons: list) -> dict:
    return {h: dict(risk_est) for h in horizons}


class ThresholdRuleBaseline:
    def forecast(self, obs_by_zone, horizons):
        out = {}
        for h in horizons:
            d = {}
            for z, o in obs_by_zone.items():
                sw = o.get("surface_water_depth_m", 0.0)
                d[z] = 0.9 if sw > 0.8 else (0.5 if sw > 0.3 else 0.1)
            out[h] = d
        return out


class PerZoneOnlineBaseline:
    def __init__(self):
        self.last = {}
    def update(self, zone, risk):
        self.last[zone] = risk
    def forecast(self, zones, horizons):
        out = {}
        for h in horizons:
            out[h] = {z: self.last.get(z, 0.1) for z in zones}
        return out


def apply_rain_adjustment(forecast: dict, rain_mm_hr: float) -> dict:
    out = {}
    for h, risks in forecast.items():
        adj = {}
        for z, r in risks.items():
            bump = min(0.25, rain_mm_hr / 200.0)
            adj[z] = max(0.0, min(1.0, round(r + bump * (h / 72.0), 4)))
        out[h] = adj
    return out
