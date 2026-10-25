from __future__ import annotations
import math
from typing import Dict, List


class OnlineRLS:
    """Recursive least squares with forgetting and L1 pruning."""
    def __init__(self, n_features: int, forgetting: float = 0.98, l1_pen: float = 0.01):
        self.n = n_features
        self.lam = forgetting
        self.l1 = l1_pen
        self.w = [0.0]*n_features
        # covariance
        self.P = [[(1.0 if i==j else 0.0)*10.0 for j in range(n_features)] for i in range(n_features)]

    def predict(self, x):
        return sum(self.w[i]*x[i] for i in range(self.n))

    def update(self, x, y):
        # prediction
        yhat = self.predict(x)
        e = y - yhat
        # gain
        Px = [sum(self.P[i][j]*x[j] for j in range(self.n)) for i in range(self.n)]
        denom = self.lam + sum(x[i]*Px[i] for i in range(self.n))
        k = [Px[i]/denom for i in range(self.n)]
        for i in range(self.n):
            self.w[i] += k[i]*e
            for j in range(self.n):
                self.P[i][j] = (self.P[i][j] - k[i]*Px[j]) / self.lam
        # L1 pruning
        for i in range(self.n):
            if abs(self.w[i]) < self.l1:
                self.w[i] = 0.0
        return e

    def prune(self, threshold=1e-3):
        self.w = [ (w if abs(w)>=threshold else 0.0) for w in self.w]
