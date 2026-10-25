from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime


def persist_raw_response(directory, adapter_id, payload, fetch_time=None):
    d = Path(directory)
    d.mkdir(parents=True, exist_ok=True)
    ts = fetch_time or int(datetime.utcnow().timestamp())
    path = d / f"{adapter_id}_{ts}.json"
    path.write_text(json.dumps({"adapter_id": adapter_id, "fetch_time": ts, "payload": payload}, indent=2))
    return path
