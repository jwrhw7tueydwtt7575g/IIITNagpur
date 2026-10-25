from __future__ import annotations
import math


def physical_plausibility(lat, lon, elev_m, claim_elev_m):
    # simple elevation consistency
    return abs(elev_m - claim_elev_m) < 50


def geography_consistent(lat, lon, bounds):
    (lat0, lat1), (lon0, lon1) = bounds
    return lat0 <= lat <= lat1 and lon0 <= lon <= lon1


def burst_score(timestamps):
    if len(timestamps) < 3:
        return 0.0
    # high score if many reports within short time
    span = max(timestamps) - min(timestamps)
    if span == 0:
        return 1.0
    rate = len(timestamps) / span
    return min(1.0, rate * 10)


def credibility(physical, geo, burst, corroboration, reporter_history, weights=None):
    weights = weights or {"physical": 0.25, "geo":0.2, "burst":0.1, "corr":0.25, "hist":0.2}
    score = (weights["physical"]*(1 if physical else 0) +
            weights["geo"]*(1 if geo else 0) +
            weights["burst"]*(1-burst) +  # bursts lower credibility
            weights["corr"]*corroboration +
            weights["hist"]*reporter_history)
    return max(0.0, min(1.0, round(score, 3)))
