from __future__ import annotations
import yaml
from pathlib import Path


def _load_states():
    p = Path("configs/states.yaml")
    return yaml.safe_load(p.open())["states"]


THRESHOLDS = {"NORMAL": 0.35, "WATCH": 0.60, "HIGH_RISK": 0.80}  # CRITICAL >=0.8


def risk_score(z) -> float:
    components = [
        min(1, z.surface_water_depth_m / 1.5),
        z.congestion,
        1 - z.power_supply_ratio,
        min(1, max(0, z.hospital_occupancy)),
        min(1, z.ambulance_response_time_min / 60.0),
        min(1, z.emergency_call_rate / 20.0),
        1 - z.medicine_stock,
        z.substation_flood_exposure,
    ]
    return sum(components) / len(components)


def zone_status(z, power_down_hours: float = 0.0, hospital_access_lost: bool = False) -> tuple:
    r = risk_score(z)
    forced = False
    if z.hospital_occupancy > 1.0:
        forced = True
    if hospital_access_lost:
        forced = True
    if power_down_hours > 1.0:
        forced = True
    if forced:
        r = max(r, 0.80)
    if r >= 0.80:
        status = "CRITICAL"
    elif r >= 0.60:
        status = "HIGH_RISK"
    elif r >= 0.35:
        status = "WATCH"
    else:
        status = "NORMAL"
    return round(r, 4), status, forced


def city_wide (zone_statuses, zone_populations) -> bool:
    crit_zones = [z for z, s in zone_statuses.items() if s == "CRITICAL"]
    if len(crit_zones) >= 2:
        return True
    total_pop = sum(zone_populations.values())
    crit_pop = sum(zone_populations[z] for z in crit_zones)
    if total_pop > 0 and crit_pop / total_pop >= 0.15:
        return True
    return False
