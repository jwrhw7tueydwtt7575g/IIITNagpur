from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Dict, List
import time
import math

from .regression import OnlineRLS
from .drift import PageHinkley


@dataclass
class Edge:
    source: str
    target: str
    lag: int
    sign: int
    effect_size: float
    confidence: float
    first_seen: int
    last_confirmed: int
    drift_log: list


class DependencyDiscovery:
    def __init__(self, max_lag_steps=48, lags_minutes=15):
        self.max_lag = max_lag_steps
        self.edges: Dict[str, Edge] = {}  # key src->tgt@lag
        self.models: Dict[str, OnlineRLS] = {}
        self.drift_monitors: Dict[str, PageHinkley] = {}
        self.first_seen_map = {}

    def _key(self, src, tgt, lag):
        return f"{src}->{tgt}@{lag}"

    def update(self, target: str, candidates: List[str], lagged_values: Dict[str, List[float]], y_series: List[float]):
        # candidates feature names aligned with lagged_values keys
        if target not in self.models:
            self.models[target] = OnlineRLS(len(candidates), forgetting=0.97, l1_pen=0.02)
            self.drift_monitors[target] = PageHinkley()
        model = self.models[target]
        # use latest row
        x = [lagged_values[c][-1] if lagged_values[c] else 0.0 for c in candidates]
        y = y_series[-1] if y_series else 0.0
        err = model.update(x, y)
        # drift recovery
        drift = self.drift_monitors[target].update(err)
        if drift:
            for k in list(self.edges.keys()):
                if k.startswith(f"*->{target}") or (f"->{target}@" in k):
                    e = self.edges[k]
                    e.drift_log.append({"t": int(time.time()), "type": "page-hinkley"})
        # create/update edges where coefficient nonzero
        now = int(time.time())
        for i, c in enumerate(candidates):
            w = model.w[i]
            if abs(w) > 1e-3:
                # parse src and lag from candidate name convention: "src_lag"
                parts = c.rsplit("_lag", 1)
                src = parts[0]
                lag = int(parts[1]) if len(parts) == 2 else 1
                k = self._key(src, target, lag)
                conf = min(1.0, abs(w) / (abs(w) + 0.1))
                if k not in self.edges:
                    self.edges[k] = Edge(src, target, lag, int(math.copysign(1, w)), abs(w), conf, now, now, [])
                    self.first_seen_map[k] = now
                else:
                    e = self.edges[k]
                    e.effect_size = abs(w)
                    e.sign = int(math.copysign(1, w))
                    e.confidence = conf
                    e.last_confirmed = now

    def pcmci_check(self, data: Dict[str, List[float]]):
        # simple: keep edges with |corr| above 0.1; remove others (drift prune)
        confirmed = []
        for k, e in list(self.edges.items()):
            src_series = data.get(e.source, [])
            tgt_series = data.get(e.target, [])
            if len(src_series) < 5 or len(tgt_series) < 5:
                continue
            # lagged correlation
            if e.lag < len(src_series):
                a = src_series[:-e.lag] if e.lag else src_series
                b = tgt_series[e.lag:]
                n = min(len(a), len(b))
                if n < 3:
                    continue
                import statistics
                # pearson
                ma = sum(a[:n])/n; mb=sum(b[:n])/n
                num=sum((a[i]-ma)*(b[i]-mb) for i in range(n))
                den=math.sqrt(sum((a[i]-ma)**2 for i in range(n))*sum((b[i]-mb)**2 for i in range(n)))+1e-9
                corr=abs(num/den)
                if corr < 0.08:
                    del self.edges[k]
                else:
                    e.last_confirmed = int(time.time())
                    e.confidence = min(1.0, e.confidence + 0.05)
                    confirmed.append(k)
        return confirmed

    def edge_list(self):
        return [asdict(e) for e in self.edges.values()]

    def spatial_prior_weak(self, neighbors):
        # returns set of candidate links only; not enforced
        return set(neighbors)
