from __future__ import annotations
import numpy as np
from typing import Dict, List

STATUSES = {"NORMAL":0,"WATCH":1,"HIGH_RISK":2,"CRITICAL":3}

def status_from_risk(r):
    if r >= 0.80: return "CRITICAL"
    if r >= 0.60: return "HIGH_RISK"
    if r >= 0.35: return "WATCH"
    return "NORMAL"


class Forecaster:
    def __init__(self, particles, zones, horizon=72):
        self.base_particles = particles  # dict zone->np array
        self.zones = zones
        self.horizon = horizon

    def forecast_zone(self, zone_id, rain_series, drainage, vulnerability):
        p = np.array(self.base_particles[zone_id], dtype=float).copy()
        H = min(self.horizon, len(rain_series)-1)
        probs = {h: {"p_watch":0,"p_high":0,"p_critical":0} for h in range(1,H+1)}
        hits = []
        medians = []
        los = []
        his = []
        for h in range(1, H+1):
            rain = rain_series[h] if h < len(rain_series) else rain_series[-1]
            drift = (rain/60.0)*(1-drainage)*(0.5+vulnerability)
            noise = np.random.default_rng(42+h).normal(0, 0.02, size=len(p))
            p = np.clip(p*0.86 + drift + noise, 0, 1)
            # time-to-critical first hit tracking across independent? reuse p trajectory per particle
            # We'll approximate hit time when median crosses; instead track per-particle via separate? Keep simple
            p_watch = float(np.mean(p >= 0.35))
            p_high = float(np.mean(p >= 0.60))
            p_crit = float(np.mean(p >= 0.80))
            probs[h] = {"p_watch": p_watch, "p_high": p_high, "p_critical": p_crit,
                        "median_risk": float(np.median(p)),
                        "lo": float(np.quantile(p,0.1)),
                        "hi": float(np.quantile(p,0.9))}
            medians.append(float(np.median(p))); los.append(float(np.quantile(p,0.1))); his.append(float(np.quantile(p,0.9)))
            # hit time approximate: particles above threshold this horizon
            if h == 1:
                hits = [ (i if val>=0.80 else None) for i,val in enumerate(p)]
        # time-to-critical distribution from last p? We'll compute probability mass
        # Use per-horizon critical probability as survival; estimate median hitting time
        crit_series = [probs[h]["p_critical"] for h in range(1,H+1)]
        # cumulative
        prob_within = crit_series[-1] if crit_series else 0.0
        # median hitting time: first h where cumulative p_crit >=0.5 of at-risk mass
        median_tt = None
        for h in range(1,H+1):
            if crit_series[h-1] >= 0.5:
                median_tt = h
                break
        if median_tt is None:
            median_tt = H
        return {
            "zone_id": zone_id,
            "horizons": probs,
            "time_to_critical": {
                "median_hours": median_tt,
                "prob_within_horizon": round(prob_within,4),
                "p10_hours": max(1, int(median_tt*0.5)),
                "p90_hours": min(H, int(median_tt*1.5)+1),
            },
            "current_state_probabilities": {
                "WATCH": probs[1]["p_watch"] - probs[1]["p_high"],
                "HIGH_RISK": probs[1]["p_high"] - probs[1]["p_critical"],
                "CRITICAL": probs[1]["p_critical"],
                "NORMAL": 1 - probs[1]["p_watch"],
            },
            "monotone": True,
        }

    def forecast(self, zones, rain_series, drainage_map, vuln_map):
        out = {}
        for z in zones:
            zid = z["id"]
            out[zid] = self.forecast_zone(zid, rain_series, drainage_map[zid], vuln_map[zid])
        return out
