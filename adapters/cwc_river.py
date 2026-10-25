from __future__ import annotations
from .generic import GenericAdapter

class CwcRiverAdapter(GenericAdapter):
    source_id = "cwc_river"
    fixture_name = "cwc_river.json"
    quota_per_hour = 100
    env_flag = "USE_LIVE_FEEDS"

    def normalize(self, payload, fetch_time):
        return []
