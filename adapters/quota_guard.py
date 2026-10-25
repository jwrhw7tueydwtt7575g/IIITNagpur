from __future__ import annotations
import time
from collections import defaultdict
from typing import Dict


class QuotaGuard:
    def __init__(self):
        self._counts: Dict[str, list] = defaultdict(list)

    def allow(self, source_id: str, limit_per_hour: int) -> bool:
        now = time.time()
        cutoff = now - 3600
        self._counts[source_id] = [t for t in self._counts[source_id] if t > cutoff]
        if len(self._counts[source_id]) >= limit_per_hour:
            return False
        self._counts[source_id].append(now)
        return True
