from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class CausalGraph:
    nodes: list
    edges: list = field(default_factory=list)

    def add(self, src, dst, lag_steps=0, threshold=None):
        self.edges.append({"src": src, "dst": dst, "lag": lag_steps, "threshold": threshold})

    def parents(self, node):
        return [e for e in self.edges if e["dst"] == node]
