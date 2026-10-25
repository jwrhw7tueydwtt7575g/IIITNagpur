from __future__ import annotations
from .generic import GenericAdapter

class MumbaiMesonetAdapter(GenericAdapter):
    source_id = "mumbai_mesonet"
    fixture_name = "mumbai_mesonet.json"
    quota_per_hour = 100
    env_flag = "USE_LIVE_FEEDS"

    def normalize(self, payload, fetch_time):
        return []
