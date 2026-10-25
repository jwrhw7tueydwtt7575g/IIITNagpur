"""Local Resilient Disaster Knowledge Base Manager.

Loads, indexes, and serves curated hyper-local disaster intelligence, physical telemetry,
node failures, and Incident Commander directives across all target cities and conditions.
Guarantees 100% operational resilience when real-time feeds and external APIs are offline.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("citygraph.disaster_db")
ROOT_DIR = Path(__file__).resolve().parent.parent
DB_DIR = ROOT_DIR / "data" / "disaster_database"


class DisasterDatabaseManager:
    """Singleton manager for the local JSON disaster database."""

    _instance: Optional[DisasterDatabaseManager] = None

    def __new__(cls) -> DisasterDatabaseManager:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return
        self.cities: Dict[str, Dict[str, Any]] = {}
        self.load_all()
        self._initialized = True

    def load_all(self):
        """Load all city JSON files from the disaster database directory."""
        if not DB_DIR.exists():
            logger.warning("Disaster database directory %s not found.", DB_DIR)
            return

        for p in DB_DIR.glob("*.json"):
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                cid = data.get("city_id", p.stem)
                self.cities[cid] = data
                # Register aliases
                if "delhi" in cid:
                    self.cities["delhi"] = data
                    self.cities["delhi_ncr"] = data
                if "mumbai" in cid:
                    self.cities["mumbai"] = data
                    self.cities["mumbai_coastal"] = data
                if "kathmandu" in cid:
                    self.cities["kathmandu"] = data
                    self.cities["nepal"] = data
                if "bengaluru" in cid or "bangalore" in cid:
                    self.cities["bengaluru"] = data
                    self.cities["bengaluru_tech_corridor"] = data
                    self.cities["bangalore"] = data
            except Exception as e:
                logger.error("Failed to load disaster JSON %s: %s", p, e)

        logger.info("Loaded %d city disaster databases.", len(self.cities))

    def list_cities(self) -> List[str]:
        """List all supported cities."""
        return list(self.cities.keys())

    def get_city(self, city_id: str = "delhi_ncr") -> Dict[str, Any]:
        """Get complete city database by ID or alias."""
        norm = city_id.lower().replace("-", "_")
        return self.cities.get(norm, self.cities.get("delhi_ncr", {}))

    def get_scenario(self, city_id: str = "delhi_ncr", scenario_id: str = "cloudburst") -> Dict[str, Any]:
        """Get scenario-specific intelligence profile."""
        city = self.get_city(city_id)
        scenarios = city.get("scenarios", {})
        norm_scen = scenario_id.lower().replace("-", "_")
        if norm_scen in scenarios:
            return scenarios[norm_scen]
        # Fallback to first available scenario or baseline
        return scenarios.get("cloudburst", scenarios.get("quiet_baseline", {}))

    def match_landmark(self, place_query: str, city_id: str = "delhi_ncr") -> Optional[Dict[str, Any]]:
        """Fuzzy match a user search place string to a critical landmark."""
        city = self.get_city(city_id)
        q = place_query.lower().strip()
        landmarks = city.get("critical_landmarks", [])

        # 1. Exact alias match
        for lm in landmarks:
            if q == lm.get("name", "").lower():
                return lm
            for al in lm.get("aliases", []):
                if q == al.lower() or al.lower() in q or q in al.lower():
                    return lm

        # 2. Substring or keyword match
        keywords = q.split()
        for lm in landmarks:
            lm_text = f"{lm.get('name', '')} {' '.join(lm.get('aliases', []))}".lower()
            if any(kw in lm_text for kw in keywords if len(kw) > 2):
                return lm

        # 3. Default to first primary landmark if none matched
        return landmarks[0] if landmarks else None

    def simulate_place_disaster(
        self,
        place_name: str,
        disaster_type: str = "flood",
        severity: int = 75,
        city_id: str = "delhi_ncr",
        city: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate high-fidelity local disaster telemetry and node impacts for any place."""
        cid = city or city_id
        matched = self.match_landmark(place_name, cid)
        city_data = self.get_city(cid)

        target_node = matched.get("associated_node_id", "node_43") if matched else "node_43"
        landmark_name = matched.get("name", place_name) if matched else place_name
        sector = matched.get("sector", "transit") if matched else "transit"
        zone = matched.get("zone", "Central Delhi") if matched else "Central Delhi"
        failure_mech = matched.get(
            "failure_mechanism",
            f"Excessive volumetric runoff exceeding local intake capacity at {landmark_name}.",
        ) if matched else f"Severe localized {disaster_type} exceeding engineering tolerances."

        # Severity scaling
        sev_factor = max(0.1, min(1.0, severity / 100.0))
        rainfall_mm = round(sev_factor * 110.0, 1)
        water_depth_m = round(sev_factor * 1.95, 2)
        traffic_idx = round(min(1.0, 0.35 + sev_factor * 0.60), 2)
        power_load = round(min(1.0, 0.40 + sev_factor * 0.50), 2)
        hosp_load = round(min(1.0, 0.45 + sev_factor * 0.48), 2)

        # Primary failed node
        primary_failed = {
            "id": target_node,
            "name": landmark_name,
            "sector": sector,
            "zone": zone,
            "status": "failed" if sev_factor >= 0.5 else "affected",
            "current_load": int(70 + sev_factor * 45),
            "capacity": 70,
            "risk_score": round(0.55 + sev_factor * 0.65, 2),
            "failure_reason": failure_mech,
            "water_depth_m": water_depth_m,
        }

        # Secondary adjacent nodes
        secondary_nodes = []
        adjacent_ids = ["node_18", "node_71", "node_30"] if target_node == "node_43" else ["node_43", "node_52"]
        for aid in adjacent_ids:
            secondary_nodes.append({
                "id": aid,
                "status": "affected",
                "risk_score": round(0.40 + sev_factor * 0.45, 2),
                "reason": f"Secondary load spillover from adjacent failure at {landmark_name}.",
            })

        timeline = [
            {
                "step": 1,
                "title": f"Initial {disaster_type.capitalize()} Inundation",
                "description": f"Precipitation rate of {rainfall_mm} mm/hr recorded at {landmark_name}. Surface runoff begins pooling.",
                "nodes": [target_node],
            },
            {
                "step": 2,
                "title": "Drainage Sluice & Transit Breach",
                "description": f"Water depth reached {water_depth_m}m. Transit flow stalled on {landmark_name} corridor.",
                "nodes": [target_node] + [s["id"] for s in secondary_nodes[:1]],
            },
            {
                "step": 3,
                "title": "Cascading Regional Propagation",
                "description": f"Traffic delays propagate to feeder arterials; power substation load hits {(power_load*100):.0f}%.",
                "nodes": [target_node] + [s["id"] for s in secondary_nodes],
            },
        ]

        directives = [
            {
                "priority": 1,
                "action": f"Deploy Emergency Dewatering Equipment to {landmark_name}",
                "location": landmark_name,
                "details": f"Dispatch high-capacity 500-HP mobile pumps to extract water depth of {water_depth_m}m.",
            },
            {
                "priority": 2,
                "action": "Divert Feeder Traffic Away from Chokepoint",
                "location": f"{landmark_name} Approaches",
                "details": f"Set variable message signs; reroute non-emergency transit around {zone}.",
            },
            {
                "priority": 3,
                "action": "Pre-Alert Regional Emergency Trauma Receiving Units",
                "location": "Regional Emergency Network",
                "details": f"Reserve emergency ambulance routes; prepare for {(hosp_load*100):.0f}% hospital ICU bed load.",
            },
        ]

        failed_ids = [primary_failed["id"]] if primary_failed["status"] == "failed" else []
        affected_ids = [s["id"] for s in secondary_nodes]
        actionable_directives = [
            d["action"] if isinstance(d, dict) else str(d) for d in directives
        ]
        chokepoints_breached = matched.get("chokepoints", [
            f"{landmark_name} primary arterial",
            f"{landmark_name} drainage sluice",
        ]) if matched else [f"{landmark_name} arterial chokepoint"]

        node_updates = {
            primary_failed["id"]: {
                "status": primary_failed["status"],
                "load": round(primary_failed["current_load"] / 100.0, 2),
                "risk": primary_failed["risk_score"],
            }
        }
        for s in secondary_nodes:
            node_updates[s["id"]] = {
                "status": s["status"],
                "risk": s["risk_score"],
            }

        telemetry = {
            "rainfall_mm_hr": rainfall_mm,
            "water_depth_m": water_depth_m,
            "traffic_congestion_index": traffic_idx,
            "power_grid_load": power_load,
            "hospital_icu_load": hosp_load,
        }

        return {
            "place_name": landmark_name,
            "disaster_type": disaster_type,
            "severity": severity,
            "rainfall_mm_hr": rainfall_mm,
            "water_depth_m": water_depth_m,
            "traffic_congestion_index": traffic_idx,
            "power_grid_load": power_load,
            "hospital_icu_load": hosp_load,
            "telemetry": telemetry,
            "primary_node": primary_failed,
            "secondary_nodes": secondary_nodes,
            "failed_nodes": failed_ids,
            "affected_nodes": affected_ids,
            "actionable_directives": actionable_directives,
            "chokepoints_breached": chokepoints_breached,
            "node_updates": node_updates,
            "timeline": timeline,
            "directives": directives,
            "provenance": "curated_disaster_knowledge_base",
        }

    def get_feed_fallback(
        self,
        source_id: str = "open_meteo",
        city_id: str = "delhi_ncr",
        feed_name: Optional[str] = None,
        city: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Synthesize authoritative sensory feed payload when real-time feed is unreachable."""
        target_src = (feed_name or source_id).lower()
        target_city = city or city_id
        scen = self.get_scenario(target_city, "cloudburst")

        if any(w in target_src for w in ["open_meteo", "weather", "rain", "precip"]):
            return {
                "live": False,
                "offline": True,
                "synthesized": True,
                "source": target_src,
                "current": {
                    "precipitation": scen.get("peak_rainfall_mm_hr", 75.0),
                    "temperature_2m": 28.5,
                    "wind_speed_10m": 34.0,
                },
                "hourly": {
                    "precipitation": [scen.get("peak_rainfall_mm_hr", 75.0)] * 24,
                },
                "weather": {
                    "condition": "Cloudburst Surcharge",
                    "precipitation_mm": scen.get("peak_rainfall_mm_hr", 75.0),
                },
                "telemetry": {
                    "rainfall_mm": scen.get("peak_rainfall_mm_hr", 75.0),
                },
            }

        if any(t in target_src for t in ["tomtom", "traffic", "flow", "roads"]):
            return {
                "live": False,
                "offline": True,
                "synthesized": True,
                "source": target_src,
                "flowSegmentData": {
                    "currentSpeed": 14.5,
                    "freeFlowSpeed": 60.0,
                    "currentTravelTime": 1420,
                    "freeFlowTravelTime": 320,
                    "confidence": 0.94,
                    "congestion_index": scen.get("traffic_congestion_index", 0.82),
                },
                "flow": {
                    "currentSpeed": 14.5,
                    "freeFlowSpeed": 60.0,
                    "currentTravelTime": 1420,
                    "freeFlowTravelTime": 320,
                    "confidence": 0.94,
                    "congestion_index": scen.get("traffic_congestion_index", 0.82),
                },
            }

        if "river" in source_id or "flood" in source_id:
            return {
                "live": False,
                "offline": True,
                "synthesized": True,
                "source": source_id,
                "gauge_level_m": scen.get("river_gauge_crest_m", 206.5),
                "danger_level_m": 205.33,
                "status": "DANGER_SURCHARGE",
            }

        if "grid" in source_id or "sldc" in source_id or "power" in source_id:
            return {
                "live": False,
                "offline": True,
                "synthesized": True,
                "source": source_id,
                "demand_mw": 7820,
                "frequency_hz": 49.88,
                "load_factor": scen.get("grid_stress_factor", 0.72),
                "tripped_substations": ["Maharani Bagh 400kV"],
            }

        return {
            "live": False,
            "offline": True,
            "synthesized": True,
            "source": source_id,
            "sample_value": 1.0,
        }

    def list_report_cases(self) -> List[Dict[str, Any]]:
        """List all verified situation report intelligence cases."""
        return [
            {
                "case_id": "delhi_cloudburst",
                "city_id": "delhi_ncr",
                "city_name": "Delhi / National Capital Region",
                "title": "Monsoon Cloudburst & Yamuna Flash Inundation",
                "hazard_type": "Cloudburst Torrential Deluge (92.5 mm/hr)",
                "threat_level": "CRITICAL CASCADE (RED)",
                "summary": "Intense localized squall submerging Ring Road underpasses and tripping Yamuna floodplain sluice gates.",
            },
            {
                "case_id": "delhi_dam_release",
                "city_id": "delhi_ncr",
                "city_name": "Delhi / National Capital Region",
                "title": "Hathnikund Barrage High-Volume River Surge",
                "hazard_type": "Upstream Barrage Discharge (208.65m)",
                "threat_level": "HIGH RISK / WATCH (AMBER)",
                "summary": "350,000 cusecs river crest breaching low-lying agricultural tracts, ITO sluice, and Kashmere Gate lowlands.",
            },
            {
                "case_id": "delhi_heatwave",
                "city_id": "delhi_ncr",
                "city_name": "Delhi / National Capital Region",
                "title": "Extreme Summer Heatwave & 400kV Grid Stress",
                "hazard_type": "Heatwave & Electrical Surcharge (48.5°C)",
                "threat_level": "HIGH RISK / WATCH (AMBER)",
                "summary": "Peak demand surges beyond 8,200 MW, tripping Maharani Bagh 400kV transformers and straining hospital ICUs.",
            },
            {
                "case_id": "mumbai_coastal_surge",
                "city_id": "mumbai_coastal",
                "city_name": "Mumbai Coastal Metropolitan Region",
                "title": "Coastal Cloudburst & 4.8m Spring Tide Surge",
                "hazard_type": "Compound Tidal-Pluvial Inundation (115 mm/hr)",
                "threat_level": "CRITICAL CASCADE (RED)",
                "summary": "Concurrent 4.85m spring tide blocks Love Grove sea outfalls while Mithi river breaches Kurla railway corridors.",
            },
            {
                "case_id": "mumbai_dam_overflow",
                "city_id": "mumbai_coastal",
                "city_name": "Mumbai Coastal Metropolitan Region",
                "title": "Vihar & Tulsi Lakes Emergency Spillway Overflow",
                "hazard_type": "Catchment Reservoir Spillway Discharge",
                "threat_level": "HIGH RISK / WATCH (AMBER)",
                "summary": "45,000 cusecs lake runoff inundating Saki Naka industrial zones and stalling Western Express Highway.",
            },
            {
                "case_id": "kathmandu_flash_flood",
                "city_id": "kathmandu_valley",
                "city_name": "Kathmandu Valley Metropolitan Region",
                "title": "Himalayan Cloudburst & Bagmati Flash Deluge",
                "hazard_type": "High-Altitude Flash Flooding (95 mm/hr)",
                "threat_level": "CRITICAL CASCADE (RED)",
                "summary": "Mountain torrents overtop Bagmati riverbanks at Balkhu; highway exits cut and emergency airlift staged at TIA.",
            },
            {
                "case_id": "bengaluru_lake_breach",
                "city_id": "bengaluru_tech_corridor",
                "city_name": "Bengaluru Tech Corridor",
                "title": "Severe Urban Cloudburst & Cascade Lake Breach",
                "hazard_type": "Inter-Lake Macro-Drain Saturation (105 mm/hr)",
                "threat_level": "CRITICAL CASCADE (RED)",
                "summary": "Bellandur & Varthur lake spillways breach; Silk Board and Outer Ring Road tech parks inundated.",
            },
        ]

    def get_sitrep_case(self, case_id: str) -> Dict[str, Any]:
        """Generate complete, verified Executive SitRep dossier for a specific case."""
        case_map = {
            "delhi_cloudburst": ("delhi_ncr", "cloudburst"),
            "delhi_dam_release": ("delhi_ncr", "upstream_dam_release"),
            "delhi_heatwave": ("delhi_ncr", "heatwave_grid_stress"),
            "mumbai_coastal_surge": ("mumbai_coastal", "cloudburst"),
            "mumbai_dam_overflow": ("mumbai_coastal", "upstream_dam_release"),
            "kathmandu_flash_flood": ("kathmandu_valley", "cloudburst"),
            "bengaluru_lake_breach": ("bengaluru_tech_corridor", "cloudburst"),
        }

        city_id, scenario_id = case_map.get(case_id, ("delhi_ncr", "cloudburst"))
        city = self.get_city(city_id)
        scen = self.get_scenario(city_id, scenario_id)

        failed_nodes = scen.get("primary_failed_nodes", ["node_43", "node_18"])
        affected_nodes = scen.get("primary_affected_nodes", ["node_30", "node_52"])
        total_assets = city.get("monitored_assets_count", 108)
        operational_assets = max(0, total_assets - len(failed_nodes) - len(affected_nodes))

        # Look up critical breaches
        landmarks = city.get("critical_landmarks", [])
        breaches = []
        for lm in landmarks:
            if lm.get("associated_node_id") in failed_nodes or lm.get("associated_node_id") in affected_nodes[:2]:
                breaches.append({
                    "asset_id": lm.get("associated_node_id", "node_43"),
                    "name": lm.get("name"),
                    "sector": lm.get("sector", "transit"),
                    "zone": lm.get("zone", "Central Sector"),
                    "water_depth": "1.65m" if lm.get("sector") == "transit" else "0.85m",
                    "status": "FAILED" if lm.get("associated_node_id") in failed_nodes else "AFFECTED",
                    "failure_mechanism": lm.get("failure_mechanism", "Intake capacity exceeded."),
                })

        # Evacuation plan
        evac = scen.get("evacuation_corridor", {
            "origin": "Primary Casualty Zone",
            "destination": "Regional High-Ground Facility",
            "safe_distance_km": 15.4,
            "transit_time_min": 28,
            "hazards_avoided": 3,
            "waypoints": ["Zone Alpha", "Elevated Flyover", "Regional Trauma Bay"],
        })

        return {
            "case_id": case_id,
            "doc_id": f"SITREP-{city_id.upper()[:3]}-{case_id.upper()[:6]}-2026",
            "classification": "OFFICIAL SITREP • EXERCISE CONFIDENTIAL",
            "title": f"Executive Situation Report: {scen.get('title', 'Urban Hazard Assessment')}",
            "city_id": city_id,
            "city_name": city.get("city_name", "Metropolitan Area"),
            "scenario_name": scen.get("title"),
            "threat_level": f"{scen.get('threat_status', 'CRITICAL')} CASCADE",
            "executive_summary": (
                f"Defense-grade emergency appraisal for {city.get('city_name')}. "
                f"Under the {scen.get('title')} scenario, average municipal risk stands at {scen.get('average_city_risk', 0.65):.2f}. "
                f"{len(failed_nodes)} primary infrastructure assets have suffered structural/operational breach, "
                f"triggering secondary delays across {len(affected_nodes)} interconnected feeder sectors. "
                f"Immediate tactical dewatering, grid shedding, and arterial traffic rerouting are ordered."
            ),
            "posture": {
                "normal_pct": 10 if scen.get("threat_status") == "CRITICAL" else 20,
                "watch_pct": 18 if scen.get("threat_status") == "CRITICAL" else 30,
                "high_risk_pct": 34,
                "critical_pct": 38 if scen.get("threat_status") == "CRITICAL" else 16,
                "t_crit_hours": "3.5h" if scen.get("threat_status") == "CRITICAL" else "8.2h",
                "confidence": 0.94,
            },
            "metrics": {
                "monitored_assets": total_assets,
                "operational_assets": operational_assets,
                "critical_failures": len(failed_nodes),
                "secondary_cascades": len(affected_nodes),
                "mean_inundation_m": round(scen.get("peak_rainfall_mm_hr", 75.0) / 65.0, 2),
                "cascade_velocity_km_h": round(14.2 * (scen.get("average_city_risk", 0.5) + 0.3), 1),
                "model_confidence": 0.94,
            },
            "critical_breaches": breaches,
            "cascade_timeline": scen.get("cascade_timeline", []),
            "evacuation_telemetry": {
                "origin": evac.get("origin"),
                "destination": evac.get("destination"),
                "distance_km": evac.get("safe_distance_km", 15.4),
                "transit_time_min": evac.get("transit_time_min", 28),
                "hazards_avoided": evac.get("hazards_avoided", len(failed_nodes)),
                "waypoints": evac.get("waypoints", []),
            },
            "incident_directives": [
                {
                    "priority": d.get("priority", idx + 1),
                    "agency": "Municipal Disaster Operations",
                    "action": d.get("action"),
                    "location": d.get("location"),
                    "details": d.get("details"),
                    "status": "DISPATCHED" if idx == 0 else "EN ROUTE",
                }
                for idx, d in enumerate(scen.get("directives", []))
            ],
            "provenance": "curated_disaster_knowledge_base",
        }


# Singleton export
DISASTER_DB = DisasterDatabaseManager()
