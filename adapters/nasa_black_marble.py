from __future__ import annotations
from .generic import GenericAdapter

class NasaBlackMarbleAdapter(GenericAdapter):
    source_id = "nasa_black_marble"
    fixture_name = "nasa_black_marble.json"
    quota_per_hour = 100
    env_flag = "USE_LIVE_FEEDS"

    def normalize(self, payload, fetch_time):
        return []
