from __future__ import annotations
from .generic import GenericAdapter

class NasaGpmAdapter(GenericAdapter):
    source_id = "nasa_gpm"
    fixture_name = "nasa_gpm.json"
    quota_per_hour = 100
    env_flag = "USE_LIVE_FEEDS"

    def normalize(self, payload, fetch_time):
        return []
