from __future__ import annotations
import statistics
from collections import deque


def robust_z_scores(values):
    if len(values) < 3:
        return [0.0]*len(values)
    med = statistics.median(values)
    mad = statistics.median([abs(v-med) for v in values]) or 1e-6
    scale = 1.4826 * mad
    return [(v-med)/scale for v in values]


def hampel_flags(values, threshold=3.0):
    zs = robust_z_scores(values)
    return [abs(z) > threshold for z in zs]


def stuck_at(values, min_run=5):
    if len(values) < min_run:
        return False
    last = values[-min_run:]
    return len(set(round(v,6) for v in last)) == 1


def cusum_drift(values, k=0.5, h=5.0):
    # cumulative sum of deviations from mean; alarm if exceed h
    if not values:
        return False
    mean = sum(values)/len(values)
    s_pos = 0.0
    s_neg = 0.0
    for v in values:
        s_pos = max(0, s_pos + (v - mean - k))
        s_neg = min(0, s_neg + (v - mean + k))
        if s_pos > h or abs(s_neg) > h:
            return True
    return False


def cross_source_contradiction(series_a, series_b, threshold=0.5):
    # compare last values normalized
    if not series_a or not series_b:
        return False
    a = series_a[-1]
    b = series_b[-1]
    # scale-invariant-ish simple
    if a == 0:
        return abs(b) > threshold
    return abs(a - b) / max(abs(a), 1e-6) > threshold
