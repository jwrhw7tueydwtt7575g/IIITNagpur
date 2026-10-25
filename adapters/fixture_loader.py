from __future__ import annotations
import json
from pathlib import Path


def load_fixture(fixtures_dir: str, name: str):
    p = Path(fixtures_dir) / name
    if not p.exists():
        return {"offline": True, "missing_fixture": str(p)}
    return json.loads(p.read_text())
