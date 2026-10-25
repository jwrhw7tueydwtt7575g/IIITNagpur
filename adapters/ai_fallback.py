"""Intelligent AI Fallback & Situational Disaster Synthesizer.

Acts as the Tier-2 AI fallback when real-time feeds fail or when place-specific disaster
simulations are requested. Automatically calls OpenAI with full situation context, and
gracefully falls back to Tier-3 (DisasterDatabaseManager) if OpenAI is unreachable or returns 401.
"""
from __future__ import annotations

import os
import json
import logging
from pathlib import Path
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional
from .disaster_db import DISASTER_DB

logger = logging.getLogger("citygraph.ai_fallback")
ROOT_DIR = Path(__file__).resolve().parent.parent


class AIFallbackClient:
    """Manages OpenAI calls with transparent fallback to local disaster database."""

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.model = "gpt-4o-mini"
        self._cache: Dict[str, Any] = {}

    def _call_openai(self, prompt: str, system_prompt: str, timeout_sec: int = 10) -> Optional[Dict[str, Any]]:
        """Call OpenAI API with JSON mode enabled and calibrated timeout."""
        token = os.getenv("OPENAI_API_KEY", self.api_key).strip()
        if not token or not token.startswith("sk-"):
            # Try reading directly from root .env if not yet exported
            try:
                env_path = ROOT_DIR / ".env"
                if env_path.exists():
                    for line in env_path.read_text(encoding="utf-8").splitlines():
                        if line.startswith("OPENAI_API_KEY="):
                            token = line.split("=", 1)[1].strip()
                            self.api_key = token
                            break
            except Exception:
                pass

        if not token or not token.startswith("sk-"):
            return None

        # Check in-memory cache to prevent duplicate remote calls
        cache_key = f"{self.model}:{prompt[:100]}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        url = "https://api.openai.com/v1/chat/completions"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
            "max_tokens": 400,
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=timeout_sec) as response:
                if response.status == 200:
                    body = json.loads(response.read().decode("utf-8"))
                    content_str = body["choices"][0]["message"]["content"]
                    parsed = json.loads(content_str)
                    self._cache[cache_key] = parsed
                    logger.info("OpenAI synthesis completed successfully.")
                    return parsed
        except urllib.error.HTTPError as he:
            logger.warning("OpenAI API HTTP error %d: %s. Engaging local disaster database fallback.", he.code, he.reason)
        except Exception as e:
            logger.warning("OpenAI API network exception: %s. Engaging local disaster database fallback.", e)

        return None

    def synthesize_place_disaster(
        self,
        place_name: str,
        disaster_type: str = "flood",
        severity: int = 75,
        city_id: str = "delhi_ncr",
    ) -> Dict[str, Any]:
        """Synthesize place disaster impact via OpenAI, falling back to local disaster DB."""
        matched = DISASTER_DB.match_landmark(place_name, city_id)
        suggested_id = matched.get("associated_node_id", "node_43") if matched else "node_43"

        system_prompt = (
            "You are the CityGraph Disaster Physics Engine. Given a landmark and disaster event, "
            "return a JSON object with: "
            "place_name (str), rainfall_mm_hr (float), water_depth_m (float), "
            "primary_node: {id, name, status, current_load, risk_score, failure_reason}, "
            "secondary_nodes: array of {id, status, risk_score, reason}, "
            "chokepoints_breached: array of strings, "
            "directives: array of {priority, action, location}."
        )

        user_prompt = (
            f"City: {city_id}\n"
            f"Landmark: {place_name} (Primary Node: {suggested_id})\n"
            f"Disaster Event: {disaster_type}, Severity: {severity}%\n"
            "Return concise JSON with calibrated failure metrics."
        )

        # Attempt OpenAI
        ai_result = self._call_openai(user_prompt, system_prompt, timeout_sec=12)
        if ai_result and "primary_node" in ai_result:
            ai_result["provenance"] = "openai_dynamic_synthesis"
            ai_result["place_name"] = ai_result.get("place_name") or place_name
            ai_result["disaster_type"] = disaster_type
            ai_result["severity"] = severity

            # Ensure required fields exist
            p = ai_result["primary_node"]
            if not p.get("id") or not str(p.get("id")).startswith("node_"):
                p["id"] = suggested_id
            failed_ids = [p["id"]] if p.get("status") in ["failed", "critical"] else []
            affected_ids = [s.get("id") for s in ai_result.get("secondary_nodes", []) if s.get("id")]
            ai_result["failed_nodes"] = failed_ids or [suggested_id]
            ai_result["affected_nodes"] = affected_ids

            ai_result["actionable_directives"] = [
                d.get("action") if isinstance(d, dict) else str(d)
                for d in ai_result.get("directives", [])
            ]

            node_updates = {
                p["id"]: {
                    "status": p.get("status", "failed"),
                    "load": round(p.get("current_load", 95) / 100.0, 2) if p.get("current_load", 95) > 1 else p.get("current_load", 0.95),
                    "risk": p.get("risk_score", 0.95) if p.get("risk_score", 0.95) <= 1.5 else round(p.get("risk_score", 95) / 100.0, 2),
                }
            }
            for s in ai_result.get("secondary_nodes", []):
                if s.get("id"):
                    node_updates[s["id"]] = {
                        "status": s.get("status", "affected"),
                        "risk": s.get("risk_score", 0.65) if s.get("risk_score", 0.65) <= 1.5 else round(s.get("risk_score", 65) / 100.0, 2),
                    }
            ai_result["node_updates"] = node_updates
            return ai_result

        # Fallback to local curated disaster database (Tier 3)
        return DISASTER_DB.simulate_place_disaster(
            place_name=place_name,
            disaster_type=disaster_type,
            severity=severity,
            city_id=city_id,
        )

    def simulate_place_disaster(
        self,
        place_name: str,
        disaster_type: str = "flood",
        severity: int = 75,
        city_id: str = "delhi_ncr",
        city: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Convenience alias for synthesize_place_disaster."""
        return self.synthesize_place_disaster(
            place_name=place_name,
            disaster_type=disaster_type,
            severity=severity,
            city_id=city or city_id,
        )

    def synthesize_feed_fallback(
        self,
        source_id: Optional[str] = None,
        city_id: str = "delhi_ncr",
        feed_name: Optional[str] = None,
        city: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Synthesize sensory feed data when real-time sensor API fails."""
        src = feed_name or source_id or "generic"
        cid = city or city_id
        return DISASTER_DB.get_feed_fallback(source_id=src, city_id=cid)


# Singleton instance
AI_FALLBACK = AIFallbackClient()
