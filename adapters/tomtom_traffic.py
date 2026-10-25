from __future__ import annotations
import os
from .generic import GenericAdapter


class TomTomTrafficAdapter(GenericAdapter):
    source_id = "tomtom_traffic"
    fixture_name = "tomtom_traffic.json"
    quota_per_hour = 60  # Strict rate limit protection (max 1/min)
    env_flag = "USE_LIVE_FEEDS"
    endpoint_live = "https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        api_key = os.getenv("TOMTOM_API_KEY", "")
        self.params_live = {
            "point": "28.6139,77.2090",  # Delhi Central coordinate
            "key": api_key,
        }

    def normalize(self, payload, fetch_time):
        return []
