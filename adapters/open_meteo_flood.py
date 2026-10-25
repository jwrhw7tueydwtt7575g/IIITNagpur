from __future__ import annotations
from .generic import GenericAdapter

class OpenMeteoFloodAdapter(GenericAdapter):
    source_id = "open_meteo_flood"
    fixture_name = "open_meteo_flood.json"
    quota_per_hour = 100
    env_flag = "USE_LIVE_FEEDS"

    def normalize(self, payload, fetch_time):
        return []
