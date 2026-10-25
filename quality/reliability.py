from __future__ import annotations
import math


class BetaReliability:
    def __init__(self, alpha=1.0, beta=1.0):
        self.alpha = alpha
        self.beta = beta

    def update(self, success: bool):
        if success:
            self.alpha += 1
        else:
            self.beta += 1

    def mean(self):
        return self.alpha / (self.alpha + self.beta)

    def variance(self):
        a, b = self.alpha, self.beta
        return (a*b) / (((a+b)**2)*(a+b+1))

    def state(self, age_minutes: int, contradictory: bool = False):
        if age_minutes > 120:
            return "stale"
        if contradictory:
            return "suspect"
        if self.mean() < 0.4:
            return "suspect"
        return "fresh"
