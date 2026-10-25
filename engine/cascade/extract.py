"""Cascade extraction from dependency graph and risk trajectories."""
from __future__ import annotations
from typing import Dict, List


def extract_cascades(risk_now: Dict[str, float], deps: dict, threshold: float = 0.5):
    """Return list of (source, target) activated edges where source risk high."""
    edges = []
    for target, srcs in deps.items():
        for src, weight in srcs:
            if risk_now.get(src, 0) >= threshold and risk_now.get(target, 0) >= threshold * 0.6:
                edges.append({"source": src, "target": target, "weight": weight})
    # group into simple chains
    chains = []
    for e in edges:
        chains.append([e["source"], e["target"]])
    return {"edges": edges, "chains": chains}
