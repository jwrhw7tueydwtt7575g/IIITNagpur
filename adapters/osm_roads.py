from __future__ import annotations
from .generic import GenericAdapter

class OsmRoadsAdapter(GenericAdapter):
    source_id = "osm_roads"
    fixture_name = "osm_roads.json"
    quota_per_hour = 10
    env_flag = "USE_LIVE_FEEDS"

    def normalize(self, payload, fetch_time):
        return []
