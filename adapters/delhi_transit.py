from __future__ import annotations
from .generic import GenericAdapter

class DelhiTransitAdapter(GenericAdapter):
    source_id = "delhi_transit"
    fixture_name = "delhi_transit.json"
    quota_per_hour = 100
    env_flag = "USE_LIVE_FEEDS"

    def normalize(self, payload, fetch_time):
        return []
