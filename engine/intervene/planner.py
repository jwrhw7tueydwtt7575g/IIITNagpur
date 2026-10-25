from __future__ import annotations
from typing import Dict, List


ACTIONS = {
    "mobile_pumps": {"cost":1,"units":1,"lead":15,"effect":0.15},
    "generators": {"cost":1,"units":1,"lead":30,"effect":0.10},
    "ambulances": {"cost":1,"units":1,"lead":10,"effect":0.08},
    "road_closure": {"cost":1,"units":1,"lead":5,"effect":0.07},
    "evacuation": {"cost":2,"units":2,"lead":60,"effect":0.12},
    "surge_beds": {"cost":2,"units":1,"lead":45,"effect":0.10},
    "transfers": {"cost":1,"units":1,"lead":20,"effect":0.09},
    "load_shedding": {"cost":1,"units":1,"lead":5,"effect":0.08},
    "sandbagging": {"cost":1,"units":2,"lead":30,"effect":0.06},
}


def apply_action(risk, action, targets):
    out = dict(risk)
    eff = ACTIONS[action]["effect"]
    for t in targets:
        if t in out:
            out[t] = max(0.0, out[t] - eff)
    return out


def broken_links(before_edges, after_risk):
    # an edge breaks if source no longer high
    broken = []
    for e in before_edges:
        if after_risk.get(e["source"], 0) < 0.5 and e.get("source") in after_risk:
            broken.append({"source": e["source"], "target": e["target"]})
    return broken


def side_effects(model_transition, before, after):
    # derived as nodes whose risk increased beyond tolerance
    se = []
    for n in before:
        if after.get(n,0) > before.get(n,0) + 0.05:
            se.append({"node": n, "delta": round(after[n]-before[n],3)})
    return se


def plan(risk, edges, budget, rng_seed=0):
    # common random numbers: deterministic noise not used; just deterministic
    candidates = []
    for action in ACTIONS:
        for target in list(risk.keys())[:5]:
            cost = ACTIONS[action]["cost"]
            if cost <= budget:
                new_risk = apply_action(risk, action, [target])
                benefit = sum(risk.values()) - sum(new_risk.values())
                broken = broken_links(edges, new_risk)
                se = side_effects(lambda x:x, risk, new_risk)
                marg = benefit / max(1, cost)
                candidates.append({
                    "action": action, "target": target, "cost": cost,
                    "benefit": round(benefit, 4), "marginal": round(marg,4),
                    "broken_links": broken, "side_effects": se,
                })
    candidates.sort(key=lambda c: c["marginal"], reverse=True)
    # greedy top 3 distinct plans
    chosen = []
    spent = 0
    for c in candidates:
        if spent + c["cost"] <= budget and len(chosen) < 3:
            chosen.append(c)
            spent += c["cost"]
    return {"budget": budget, "spent": spent, "plans": chosen}


def plan_interventions(risk, budget=3, cost_per_node=1):
    edges = []
    res = plan(risk, edges, budget)
    iv = []
    for pl in res["plans"]:
        iv.append({"node": pl["target"], "risk_before": risk.get(pl["target"],0)})
    if not iv:
        iv.append({"node": max(risk, key=lambda k:risk[k]), "risk_before": max(risk.values())})
    res["interventions"] = iv
    return res
