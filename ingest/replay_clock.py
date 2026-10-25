from __future__ import annotations


class ReplayClock:
    def __init__(self, start: int = 0):
        self.current_time = int(start)
        self.state = "paused"  # playing|paused
        self.speed = 1
        self._min_speed = 1
        self._max_speed = 3600

    @property
    def now(self):
        return self.current_time

    def play(self):
        self.state = "playing"

    def pause(self):
        self.state = "paused"

    def seek(self, t: int):
        if t < 0:
            raise ValueError("seek target must be non-negative")
        self.current_time = int(t)

    def set_speed(self, multiplier: int):
        if not (self._min_speed <= multiplier <= self._max_speed):
            raise ValueError("speed out of range")
        self.speed = int(multiplier)

    def tick(self, delta_seconds: int = 1):
        if self.state == "playing":
            self.current_time += int(delta_seconds * self.speed)
        return self.current_time

    def can_access(self, record_time: int) -> bool:
        return int(record_time) <= self.current_time
