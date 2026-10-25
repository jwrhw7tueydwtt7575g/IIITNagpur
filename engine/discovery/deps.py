"""Dependency discovery from observed time series (no hardcoded links)."""
from __future__ import annotations

import numpy as np
from typing import Dict, List


def lagged_corr(x, y, lag=1):
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    if len(x) < lag + 2:
        return 0.0
    # correlation between x[t] and y[t+lag]
    if lag == 0:
        a, b = x, y
    else:
        a, b = x[:-lag], y[lag:]
    if a.std() == 0 or b.std() == 0:
        return 0.0
    return float(np.corrcoef(a, b)[0, 1])


def discover_dependencies(series: Dict[str, List[float]], threshold: float = 0.35, lag: int = 1):
    """series: zone_id -> list of risk proxy. Returns adjacency dict."""
    zones = list(series.keys())
    adj = {z: [] for z in zones}
    for a in zones:
        for b in zones:
            if a == b:
                continue
            c = lagged_corr(series[a], series[b], lag=lag)
            if abs(c) >= threshold:
                adj[b].append((a, round(c, 3)))
    return adj


def bootstrap_stability(series, n_boot=20, threshold=0.35):
    """Return fraction of bootstrap samples in which each edge appears."""
    n = len(next(iter(series.values())))
    edges = {}
    zones = list(series.keys())
    for _ in range(n_boot):
        idx = np.random.randint(0, n, size=n)
        boot = {z: [series[z][i] for i in idx] for z in zones}
        adj = discover_dependencies(boot, threshold=threshold)
        for dst, srcs in adj.items():
            for src, _ in srcs:
                edges.setdefault((src, dst), 0)
                edges[(src, dst)] += 1
    total = max(1, n_boot)
    return {k: v / total for k, v in edges.items()}
