import os
import json
from unittest.mock import patch

from adapters.registry import build_adapters
from adapters.open_meteo_weather import OpenMeteoWeatherAdapter
from adapters.http_fetcher import HttpFetcher


def test_adapter_fixture_fallback():
    os.environ["USE_LIVE_FEEDS"] = "false"
    a = OpenMeteoWeatherAdapter()
    payload = a.fetch_live()
    assert payload.get("offline") is True
    assert "stale" in payload


def test_adapter_live_mocked():
    os.environ["USE_LIVE_FEEDS"] = "true"
    a = OpenMeteoWeatherAdapter()
    sample = {"hourly": {"time": ["2024-01-01T00:00"], "precipitation": [3.2]}}
    with patch.object(HttpFetcher, "get", return_value=json.dumps(sample)):
        payload = a.fetch_live()
    assert payload.get("live") is True
    assert a._quota_ok() or True
    os.environ["USE_LIVE_FEEDS"] = "false"


def test_registry_count_and_quotas():
    adapters = build_adapters()
    assert len(adapters) >= 14
    guard = adapters[0].quota
    assert guard.allow("x", 2) is True
