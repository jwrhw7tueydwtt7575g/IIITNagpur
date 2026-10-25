"""Causal explainability: evidence-backed chain links."""
from __future__ import annotations


def explain_chain(cascade: dict, risk_now: dict, drivers: dict):
    out = []
    for chain in cascade.get("chains", []):
        steps = []
        for node in chain:
            steps.append({
                "node": node,
                "risk": risk_now.get(node),
                "evidence": drivers.get(node, {}),
            })
        out.append({"chain": chain, "steps": steps})
    return out
