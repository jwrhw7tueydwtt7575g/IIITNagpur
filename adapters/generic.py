from __future__ import annotations
import time
from typing import Any, Dict, List
from .base import BaseAdapter
from .http_fetcher import HttpFetcher


class GenericAdapter(BaseAdapter):
    endpoint_live: str = ""
    endpoint_range: str = ""
    params_live: dict = {}
    params_range: dict = {}
    use_fixture_on_failure: bool = True

    def fetch_live(self):
        fetch_time = int(time.time())
        if not self.live_enabled() or not self._quota_ok():
            payload = self._load_fixture()
            payload.setdefault("stale", True)
            self._record_raw(payload, fetch_time)
            return payload
        try:
            raw = self.http.get(self.endpoint_live, params=self.params_live)
            payload = {"raw": raw, "live": True}
            self._record_raw(payload, fetch_time)
            return payload
        except Exception:
            try:
                from .ai_fallback import AI_FALLBACK
                synth = AI_FALLBACK.synthesize_feed_fallback(self.source_id)
                if synth:
                    payload = dict(synth)
                    payload["stale"] = True
                    payload["suspect"] = True
                    self._record_raw(payload, fetch_time)
                    return payload
            except Exception:
                pass
            payload = self._load_fixture()
            payload["stale"] = True
            payload["suspect"] = True
            self._record_raw(payload, fetch_time)
            return payload

    def fetch_range(self, start, end):
        fetch_time = int(time.time())
        if not self.live_enabled() or not self._quota_ok():
            payload = self._load_fixture()
            payload.setdefault("stale", True)
            self._record_raw(payload, fetch_time)
            return payload
        try:
            params = dict(self.params_range)
            params.update({"start": start, "end": end})
            raw = self.http.get(self.endpoint_range or self.endpoint_live, params=params)
            payload = {"raw": raw, "live": True, "range": [start, end]}
            self._record_raw(payload, fetch_time)
            return payload
        except Exception:
            payload = self._load_fixture()
            payload["stale"] = True
            payload["suspect"] = True
            self._record_raw(payload, fetch_time)
            return payload

    def normalize(self, payload, fetch_time):
        # Default: wrap fixture/live payload as a single record if it has value
        return []
