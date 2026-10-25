from __future__ import annotations
from .generic import GenericAdapter

class CopernicusGfmAdapter(GenericAdapter):
    source_id = "copernicus_gfm"
    fixture_name = "copernicus_gfm.json"
    quota_per_hour = 100
    env_flag = "USE_LIVE_FEEDS"

    def normalize(self, payload, fetch_time):
        return []
