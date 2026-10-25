from __future__ import annotations
import json
import time
from .generic import GenericAdapter


class OpenMeteoWeatherAdapter(GenericAdapter):
    source_id = "open_meteo_weather"
    fixture_name = "open_meteo_weather.json"
    quota_per_hour = 1000
    env_flag = "USE_LIVE_FEEDS"
    endpoint_live = "https://api.open-meteo.com/v1/forecast"

    def normalize(self, payload, fetch_time):
        records = []
        raw = payload.get("raw")
        data = None
        if isinstance(raw, str):
            try:
                data = json.loads(raw)
            except Exception:
                data = None
        elif isinstance(raw, dict):
            data = raw
        elif isinstance(payload, dict) and "hourly" in payload:
            data = payload
        if not data or "hourly" not in data:
            # fixture fallback: no detailed records
            return records
        hourly = data["hourly"]
        times = hourly.get("time", [])
        precip = hourly.get("precipitation", [])
        for i, t in enumerate(times):
            val = precip[i] if i < len(precip) else None
            records.append({
                "source": self.source_id,
                "stream": "weather",
                "station_id": None,
                "zone_id": None,
                "variable": "rain_mm_hr",
                "value": val,
                "unit": "mm/hr",
                "event_time": int(time.time()),
                "arrival_time": fetch_time,
                "quality_flags": [],
            })
        return records
