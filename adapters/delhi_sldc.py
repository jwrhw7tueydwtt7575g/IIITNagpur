from __future__ import annotations
from .generic import GenericAdapter

class DelhiSldcAdapter(GenericAdapter):
    source_id = "delhi_sldc"
    fixture_name = "delhi_sldc.json"
    quota_per_hour = 100
    env_flag = "USE_LIVE_FEEDS"

    def normalize(self, payload, fetch_time):
        return []
