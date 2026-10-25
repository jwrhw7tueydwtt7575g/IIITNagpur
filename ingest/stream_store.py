"""Simple append-only stream store for replayed observations."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, List


class StreamStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, record: dict) -> None:
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")

    def read_all(self) -> List[dict]:
        if not self.path.exists():
            return []
        out = []
        with self.path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    out.append(json.loads(line))
        return out

    def read_until(self, t: int, time_field: str = "t") -> List[dict]:
        return [r for r in self.read_all() if r.get(time_field, 0) <= t]

    def reset(self) -> None:
        if self.path.exists():
            self.path.unlink()

    def bulk_load(self, records: Iterable[dict]) -> None:
        for r in records:
            self.append(r)
