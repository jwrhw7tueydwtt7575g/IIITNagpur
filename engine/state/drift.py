"""Online concept drift handling via rolling z-score."""
from __future__ import annotations
import math
from collections import deque


class DriftMonitor:
    def __init__(self, window: int = 24, z_threshold: float = 2.5):
        self.window = window
        self.z_threshold = z_threshold
        self.buf = deque(maxlen=window)

    def update(self, value: float):
        self.buf.append(value)
        if len(self.buf) < 5:
            return False, 0.0
        mean = sum(self.buf) / len(self.buf)
        var = sum((v - mean) ** 2 for v in self.buf) / len(self.buf)
        std = math.sqrt(var + 1e-9)
        z = (value - mean) / std
        return abs(z) >= self.z_threshold, round(z, 3)
