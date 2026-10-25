from __future__ import annotations
from typing import Dict, List


def ranked_drivers(drivers: Dict[str, float], observed_delta: Dict[str, float] | None = None):
    out = []
    for name, val in drivers.items():
        delta = (observed_delta or {}).get(name, 0.0)
        out.append({"driver": name, "value": val, "delta": delta})
    out.sort(key=lambda x: abs(x["delta"]) if x["delta"] != 0 else abs(x["value"]), reverse=True)
    return out


def ablation_attribution(risk_base: float, risk_without: Dict[str, float]):
    # risk_without maps ablated feature -> new risk
    attr = {}
    for feat, r in risk_without.items():
        attr[feat] = round(risk_base - r, 4)
    return sorted(attr.items(), key=lambda kv: abs(kv[1]), reverse=True)


def evidence(recent_obs: List[dict], provenance: dict):
    ev = []
    for o in recent_obs[-5:]:
        ev.append({"field": o.get("variable"), "value": o.get("value"),
                   "source": provenance.get("source"), "freshness": provenance.get("freshness"),
                   "reliability": provenance.get("reliability")})
    return ev


def chain_support(chain: List[str], provenance_map: dict):
    out = []
    for n in chain:
        p = provenance_map.get(n, {})
        out.append({"node": n, "source": p.get("source"), "provenance": p.get("provenance"),
                    "freshness": p.get("freshness"), "reliability": p.get("reliability")})
    return out


def narrative(chain: List[str], risk: float):
    # template-based, numbers from inputs only
    steps = " -> ".join(chain)
    return f"Risk {risk:.2f}: cascade path {steps}. Drivers increase load; intervention can break links."
