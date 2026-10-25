from __future__ import annotations


class PageHinkley:
    def __init__(self, delta=0.005, threshold=50, alpha=0.999):
        self.delta = delta
        self.threshold = threshold
        self.alpha = alpha
        self.mean = 0.0
        self.cumulative = 0.0
        self.min_cum = 0.0
        self.n = 0
        self.drift = False

    def update(self, value):
        self.n += 1
        self.mean = self.alpha * self.mean + (1 - self.alpha) * value
        self.cumulative += value - self.mean - self.delta
        self.min_cum = min(self.min_cum, self.cumulative)
        self.drift = (self.cumulative - self.min_cum) > self.threshold
        return self.drift


class ADWIN:
    def __init__(self, delta=0.002):
        self.delta = delta
        self.window = []
        self.drift = False

    def update(self, value):
        self.window.append(value)
        if len(self.window) < 10:
            return False
        # simple split test
        half = len(self.window)//2
        left = self.window[:half]
        right = self.window[half:]
        m1 = sum(left)/len(left)
        m2 = sum(right)/len(right)
        self.drift = abs(m1 - m2) > self.delta * 10
        if self.drift:
            self.window = right.copy()
        # bound memory
        if len(self.window) > 500:
            self.window = self.window[-250:]
        return self.drift
