from __future__ import annotations
import os
from .generic import GenericAdapter


class TelegramCitizenAdapter(GenericAdapter):
    source_id = "telegram_citizen"
    fixture_name = "telegram_citizen.json"
    quota_per_hour = 60  # Strict rate limit protection
    env_flag = "USE_LIVE_FEEDS"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        self.endpoint_live = f"https://api.telegram.org/bot{token}/getUpdates"

    def normalize(self, payload, fetch_time):
        return []
