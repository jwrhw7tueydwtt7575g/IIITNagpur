from __future__ import annotations
from collections import deque

class IsotonicCalibrator:
    def __init__(self):
        self.pairs = deque(maxlen=500)
    def update(self, pred, observed):
        self.pairs.append((pred, 1.0 if observed else 0.0))
    def calibrate(self, p):
        if not self.pairs:
            return p
        # bin-based monotonic calibration
        bins = [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9]
        for b in bins:
            subset = [o for (pr,o) in self.pairs if pr <= b]
            if subset and p <= b:
                rate = sum(subset)/len(subset)
                return max(0.0, min(1.0, rate))
        return p

class ConformalCorrector:
    def __init__(self, alpha=0.1):
        self.alpha = alpha
        self.residuals = deque(maxlen=200)
    def update(self, pred, observed):
        self.residuals.append(abs(pred-observed))
    def quantile(self):
        if not self.residuals:
            return 0.1
        r = sorted(self.residuals)
        idx = int((1-self.alpha)*len(r))
        idx = min(len(r)-1, max(0, idx))
        return r[idx]
