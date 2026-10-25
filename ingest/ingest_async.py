from __future__ import annotations
import asyncio
from typing import Callable, Awaitable

from .store import EventTimeStore
from .raw_persist import persist_raw_response


async def ingest_from_adapter(store: EventTimeStore, adapter, raw_dir: str, to_records: Callable):
    """Async ingestion helper. to_records(payload) -> list of record dicts."""
    loop = asyncio.get_event_loop()
    payload = await loop.run_in_executor(None, adapter.fetch)
    fetch_time = int(__import__("time").time())
    persist_raw_response(raw_dir, getattr(adapter, "id", "adapter"), payload, fetch_time)
    records = to_records(payload, fetch_time)
    # annotate arrival_time if missing
    for r in records:
        r.setdefault("arrival_time", fetch_time)
    store.insert(records)
    return records
