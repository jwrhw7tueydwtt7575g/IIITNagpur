from __future__ import annotations
from .generic import GenericAdapter

class GdeltNewsAdapter(GenericAdapter):
    source_id = "gdelt_news"
    fixture_name = "gdelt_news.json"
    quota_per_hour = 100
    env_flag = "USE_LIVE_FEEDS"

    def normalize(self, payload, fetch_time):
        return []
