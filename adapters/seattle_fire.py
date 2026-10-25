from __future__ import annotations
from .generic import GenericAdapter

class SeattleFireAdapter(GenericAdapter):
    source_id = "seattle_fire"
    fixture_name = "seattle_fire.json"
    quota_per_hour = 100
    env_flag = "USE_LIVE_FEEDS"

    def normalize(self, payload, fetch_time):
        return []
