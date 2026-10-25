from __future__ import annotations
import json
import urllib.request
from .base import Adapter


class WeatherAdapter(Adapter):
    """Open-Meteo public adapter with offline fallback."""
    def __init__(self, lat=28.6, lon=77.2, offline=True):
        self.lat = lat
        self.lon = lon
        self.offline = offline

    def fetch(self):
        if self.offline:
            return {"source": "fixture", "rain_mm_hr": 12.0}
        try:
            url = f"https://api.open-meteo.com/v1/forecast?latitude={self.lat}&longitude={self.lon}&hourly=precipitation"
            with urllib.request.urlopen(url, timeout=5) as r:
                data = json.loads(r.read())
            return {"source": "open-meteo", "hourly": data.get("hourly", {})}
        except Exception as e:
            return {"source": "fallback", "error": str(e), "rain_mm_hr": 12.0}
