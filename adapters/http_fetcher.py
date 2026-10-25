from __future__ import annotations
import time
import urllib.request
import urllib.error
from typing import Any, Dict


class HttpFetcher:
    def __init__(self, raw_dir: str = "data/raw_responses", max_retries: int = 3, backoff: float = 1.0):
        self.raw_dir = raw_dir
        self.max_retries = max_retries
        self.backoff = backoff

    def get(self, url: str, params: Dict[str, Any] | None = None, headers: Dict[str, str] | None = None, timeout: int = 10):
        q = ""
        if params:
            from urllib.parse import urlencode
            q = "?" + urlencode(params)
        full = url + q
        headers = headers or {}
        last = None
        for attempt in range(self.max_retries):
            try:
                req = urllib.request.Request(full, headers=headers)
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    data = resp.read().decode("utf-8")
                return data
            except Exception as e:
                last = e
                time.sleep(self.backoff * (2 ** attempt))
        raise RuntimeError(f"HTTP fetch failed: {last}")
