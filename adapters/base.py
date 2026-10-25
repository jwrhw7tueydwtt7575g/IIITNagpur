from __future__ import annotations
import os, time
from abc import ABC, abstractmethod
from typing import Any, Dict, List

from .quota_guard import QuotaGuard
from .fixture_loader import load_fixture
from .http_fetcher import HttpFetcher


class BaseAdapter(ABC):
    source_id: str = "base"
    env_flag: str = "USE_LIVE_FEEDS"
    fixture_name: str = "sample.json"
    quota_per_hour: int = 100
    poll_seconds: int = 300

    def __init__(self, raw_dir: str = "data/raw_responses", fixtures_dir: str = "fixtures"):
        self.raw_dir = raw_dir
        self.fixtures_dir = fixtures_dir
        self.quota = QuotaGuard()
        self.http = HttpFetcher(raw_dir=raw_dir)

    def live_enabled(self) -> bool:
        return os.getenv(self.env_flag, "false").lower() == "true"

    @abstractmethod
    def fetch_live(self) -> Dict[str, Any]:
        ...

    @abstractmethod
    def fetch_range(self, start: str, end: str) -> Dict[str, Any]:
        ...

    @abstractmethod
    def normalize(self, payload: Dict[str, Any], fetch_time: int) -> List[Dict[str, Any]]:
        ...

    def _quota_ok(self) -> bool:
        return self.quota.allow(self.source_id, self.quota_per_hour)

    def _record_raw(self, payload, fetch_time):
        from .raw_persist import persist_raw_response
        return persist_raw_response(f"{self.raw_dir}/{self.source_id}", self.source_id, payload, fetch_time)

    def _load_fixture(self):
        return load_fixture(self.fixtures_dir, self.fixture_name)
