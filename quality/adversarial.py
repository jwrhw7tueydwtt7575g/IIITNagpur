"""Adversarial data quality checks for sensors and citizen reports."""
from __future__ import annotations
from typing import Dict


def sensor_quality(obs: dict, history: list) -> float:
    """Return quality score 0-1. Low for stuck/impossible/outlier sensors."""
    q = 1.0
    if obs.get("sensor_quality", 1.0) < 0.5:
        q -= 0.4
    # range checks
    for field, lo, hi in [("traffic_index", 0, 1), ("hospital_load", 0, 1), ("power_load", 0, 1), ("rain_mm_hr", 0, 500)]:
        v = obs.get(field)
        if v is None or v < lo or v > hi:
            q -= 0.2
    # stuck detection: same last 5
    if len(history) >= 5:
        vals = [h.get("traffic_index") for h in history[-5:]]
        if len(set(round(v, 3) for v in vals if v is not None)) == 1:
            q -= 0.2
    return max(0.0, min(1.0, round(q, 3)))


def report_credibility(report_text: str, source_reputation: float = 0.5) -> float:
    base = source_reputation
    # simple heuristics: too short or all-caps lower credibility
    if len(report_text.strip()) < 10:
        base -= 0.2
    if report_text.isupper() and len(report_text) > 10:
        base -= 0.15
    return max(0.0, min(1.0, round(base, 3)))


def consensus_score(reports: list) -> float:
    if not reports:
        return 0.0
    credible = [report_credibility(r) for r in reports]
    return round(sum(credible) / len(credible), 3)
