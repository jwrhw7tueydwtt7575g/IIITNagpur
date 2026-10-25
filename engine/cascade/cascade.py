from __future__ import annotations
from typing import Dict, List


def threshold_crossings(series, threshold=0.6):
    out = []
    for i, v in enumerate(series):
        if v >= threshold:
            out.append(i)
    return out


def detect_loops(edges):
    # edges: list of (src,dst)
    adj = {}
    for s, d in edges:
        adj.setdefault(s, []).append(d)
    loops = []
    visited = set()
    def dfs(node, path):
        if node in path:
            idx = path.index(node)
            loops.append(path[idx:] + [node])
            return
        if node in visited:
            return
        visited.add(node)
        for nb in adj.get(node, []):
            dfs(nb, path + [node])
    for n in list(adj.keys()):
        dfs(n, [])
    # unique
    uniq = []
    for l in loops:
        if l not in uniq:
            uniq.append(l)
    return uniq


def extract_cascades(risk_now: Dict[str, float], deps_edges: list, top_k: int = 5):
    high_nodes = [n for n, r in risk_now.items() if r >= 0.35]
    edges = [
        (e["source"], e["target"])
        for e in deps_edges
        if risk_now.get(e["source"], 0.4) >= 0.35 and risk_now.get(e["target"], 0.4) >= 0.25
    ]
    if not edges and deps_edges:
        edges = [(e["source"], e["target"]) for e in deps_edges[:8]]

    chains = []
    # Build 1-hop and 2-hop chains
    for src, dst in edges:
        p_src = risk_now.get(src, 0.5)
        p_dst = risk_now.get(dst, 0.5)
        chains.append({"path": [src, dst], "probability": round((p_src + p_dst) / 2.0, 3), "stages": [src, dst]})
        # Look for 2-hop extensions
        for s2, d2 in edges:
            if s2 == dst and d2 != src:
                p_d2 = risk_now.get(d2, 0.5)
                chains.append({
                    "path": [src, dst, d2],
                    "probability": round((p_src + p_dst + p_d2) / 3.0, 3),
                    "stages": [src, dst, d2],
                })

    # merge points
    incoming = {}
    for s, d in edges:
        incoming.setdefault(d, []).append(s)
    merges = [n for n, ps in incoming.items() if len(ps) >= 2]

    # branching
    outgoing = {}
    for s, d in edges:
        outgoing.setdefault(s, []).append(d)
    branches = [n for n, ds in outgoing.items() if len(ds) >= 2]
    loops = detect_loops(edges)

    # top-k by risk and path length
    chains_sorted = sorted(
        chains,
        key=lambda c: (len(c["path"]), risk_now.get(c["path"][-1], 0)),
        reverse=True,
    )[:top_k]

    return {
        "high_nodes": high_nodes,
        "edges": edges,
        "chains": chains_sorted,
        "loops": loops,
        "feedback_loops": loops,
        "merge_points": merges,
        "merges": merges,
        "branch_points": branches,
        "branches": branches,
        "top_k": top_k,
    }
