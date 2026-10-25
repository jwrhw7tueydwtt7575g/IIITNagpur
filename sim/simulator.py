from __future__ import annotations

import json
import math
import random
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import yaml

from sim.ground_truth.latent import ZoneLatent, update_zone
from sim.ground_truth.truth import zone_status, city_wide, risk_score

STATE_ORDER = ["NORMAL", "WATCH", "HIGH_RISK", "CRITICAL"]


def load_yaml(path):
    with open(path) as f:
        return yaml.safe_load(f)


def load_city(path):
    return load_yaml(path)


def load_scenario(path):
    return load_yaml(path)


class Simulator:
    def __init__(self, city_path="configs/cities/delhi_ncr.yaml", scenario_path="configs/scenarios/quiet_baseline.yaml", seed=None):
        self.city_cfg = load_city(city_path)
        self.scn_cfg = load_scenario(scenario_path)
        self.seed = self.city_cfg.get("seed", 42) if seed is None else seed
        self.seed += self.scn_cfg.get("seed_offset", 0)
        self.rng = random.Random(self.seed)
        self.np_rng = np.random.default_rng(self.seed)
        self.step_minutes = self.city_cfg.get("step_minutes", 15)
        self.horizon_hours = self.scn_cfg.get("duration_hours", self.city_cfg.get("horizon_hours", 72))
        self.n_steps = int(self.horizon_hours * 60 / self.step_minutes)
        self.zones: List[ZoneLatent] = []
        for z in self.city_cfg["zones"]:
            self.zones.append(ZoneLatent(
                zone_id=z["id"],
                population=z["population"],
                elevation_m=z["elevation_m"],
                drainage_capacity=z["drainage_capacity"],
                hospital_facilities=z["hospital_facilities"],
                substation_coverage=z["substation_coverage"],
                ambulance_depots=z["ambulance_depots"],
                neighbors=list(z.get("neighbors", [])),
                river_gauge=z.get("river_gauge"),
            ))
        self.zone_by_id = {z.zone_id: z for z in self.zones}
        # power-down duration tracking
        self.power_down_steps = {z.zone_id: 0 for z in self.zones}
        self.hospital_access_lost = {z.zone_id: False for z in self.zones}
        self.observations = []
        self.ground_truth = []
        self.fault_log = []
        self.drift_log = []
        self._heatwave = 1.0 if self.scn_cfg.get("heatwave") else 0.0
        self._disease = 1.0 if self.scn_cfg.get("disease_outbreak") else 0.0
        self._dam = 1.0 if self.scn_cfg.get("dam_release") else 0.0
        self._cloud = 1.0 if self.scn_cfg.get("cloudburst") else 0.0

    def _rain_at(self, step):
        hour = step * self.step_minutes / 60.0
        # base diurnal
        base = 2 + 6 * max(0, math.sin((hour % 24) / 24 * math.pi))
        sid = self.scn_cfg["scenario_id"]
        rain = base
        if self._cloud:
            if 18 <= hour <= 24:
                rain += 45 + self.rng.random() * 20
            elif 44 <= hour <= 48:
                rain += 30
        if sid == "upstream_dam_release":
            rain += 8 if 0 <= hour <= 72 else 0
        if sid == "compound_flood_epidemic":
            if 12 <= hour <= 30:
                rain += 38
            if 50 <= hour <= 60:
                rain += 20
        if sid == "heatwave_grid_stress":
            rain += 3
        if sid == "quiet_baseline":
            rain = max(0, rain * 0.6)
        # random storm noise
        rain += self.np_rng.normal(0, 1.5)
        return max(0.0, round(rain, 2))

    def _river_at(self, step, cum_rain):
        base = 205.2
        level = base + 0.0025 * cum_rain + (2.5 if self._dam else 0)
        # pulse for dam release
        hour = step * self.step_minutes / 60.0
        if self._dam and 6 <= hour <= 18:
            level += 1.8
        level += self.np_rng.normal(0, 0.03)
        return round(level, 3)

    def _apply_drift(self, step):
        hour = step * self.step_minutes / 60.0
        for d in self.scn_cfg.get("concept_drifts", []):
            if abs(hour - d["at_hour"]) < self.step_minutes/60.0 + 1e-6:
                dtype = d["type"]
                if dtype == "pump_degradation":
                    for z in self.zones:
                        z.drainage_capacity = max(0.1, z.drainage_capacity - self.rng.uniform(0.05, 0.15))
                    self.drift_log.append({"step": step, "hour": hour, "type": dtype, "detail": "drainage capacity reduced"})
                elif dtype == "new_road_link":
                    # add neighbor link between first two
                    if len(self.zones) >= 2:
                        a, b = self.zones[0].zone_id, self.zones[1].zone_id
                        if b not in self.zone_by_id[a].neighbors:
                            self.zone_by_id[a].neighbors.append(b)
                        self.zone_by_id[a].road_capacity = min(1, self.zone_by_id[a].road_capacity + 0.2)
                    self.drift_log.append({"step": step, "hour": hour, "type": dtype, "detail": "new road link opened"})
                elif dtype == "substation_reroute":
                    for z in self.zones:
                        z.substation_coverage = min(1.0, z.substation_coverage + self.rng.uniform(0.05, 0.15))
                    self.drift_log.append({"step": step, "hour": hour, "type": dtype, "detail": "substation rerouted"})
                elif dtype == "population_shift":
                    for z in self.zones:
                        shift = self.rng.randint(-5000, 5000)
                        z.population = max(10000, z.population + shift)
                    self.drift_log.append({"step": step, "hour": hour, "type": dtype, "detail": "population shifted"})
                # inject a fault too
                self.fault_log.append({"step": step, "hour": hour, "injected": dtype})

    def _neighbor_spillover(self):
        # congestion spillover
        snap = {z.zone_id: z.congestion for z in self.zones}
        for z in self.zones:
            neigh_cong = [snap[n] for n in z.neighbors if n in snap]
            if neigh_cong:
                z.congestion = min(1, z.congestion + 0.05 * (sum(neigh_cong)/len(neigh_cong)))

    def _update_power_down_tracking(self):
        for z in self.zones:
            if z.power_supply_ratio < 0.1:
                self.power_down_steps[z.zone_id] += 1
            else:
                self.power_down_steps[z.zone_id] = 0
            # hospital access lost rule
            if z.road_capacity < 0.15 or z.hospital_facilities == 0:
                self.hospital_access_lost[z.zone_id] = True
            else:
                self.hospital_access_lost[z.zone_id] = False

    def _generate_observation(self, step, z: ZoneLatent):
        # delay: observation may be for current or previous step
        delay_steps = self.rng.choice([0, 1, 2, 3])
        obs_t = step + delay_steps
        noise = lambda x, scale=0.05: x + self.np_rng.normal(0, scale)
        sensor_drift = self.rng.random() < 0.05
        missing = self.rng.random() < 0.08
        contradiction = self.rng.random() < 0.05
        fake_report = self.rng.random() < 0.03
        obs = {
            "t": obs_t,
            "source_t": step,
            "zone_id": z.zone_id,
            "rain_mm_hr": round(max(0, noise(z.rainfall_mm_hr, 2.0)), 2),
            "river_level_m": round(noise(z.river_level_m, 0.05), 3),
            "traffic_index": round(max(0, min(1, noise(z.congestion, 0.06))), 3),
            "hospital_occupancy": None if missing else round(max(0, noise(z.hospital_occupancy, 0.05)), 3),
            "power_supply_ratio": round(noise(z.power_supply_ratio, 0.05), 3),
            "ambulance_response_time_min": round(max(0, noise(z.ambulance_response_time_min, 2.0)), 1),
            "emergency_call_rate": round(max(0, noise(z.emergency_call_rate, 0.5)), 2),
            "telecom_load": round(max(0, min(1, noise(z.telecom_load, 0.05))), 3),
            "surface_water_depth_m": round(max(0, noise(z.surface_water_depth_m, 0.05)), 3),
            "sensor_quality": round(self.rng.uniform(0.6, 1.0), 3),
        }
        if sensor_drift:
            obs["sensor_quality"] = round(obs["sensor_quality"] * 0.5, 3)
            obs["traffic_index"] = round(max(0, min(1, obs["traffic_index"] + 0.3)), 3)
        if contradiction:
            # flip traffic vs surface water
            obs["traffic_index"] = round(1 - obs["traffic_index"], 3)
        if missing:
            obs["hospital_occupancy"] = None
            obs["power_supply_ratio"] = None
        # fake reports count
        obs["news_report_count"] = (self.rng.randint(3, 8) if fake_report else self.rng.randint(0, 2))
        # delays/noise metadata
        obs["delay_steps"] = delay_steps
        obs["is_fake_report"] = fake_report  # hidden; engine should detect
        # don't include is_fake? requirement observed stream includes fake reports; engine detects. We can include for eval but engine shouldn't trust. Keep field.
        return obs

    def run(self):
        cum_rain = 0.0
        for step in range(self.n_steps):
            self._apply_drift(step)
            rain = self._rain_at(step)
            cum_rain += rain
            river = self._river_at(step, cum_rain)
            heat = self._heatwave
            disease = self._disease
            for z in self.zones:
                update_zone(z, rain, river, heat, disease, self.rng)
            self._neighbor_spillover()
            self._update_power_down_tracking()
            # ground truth labeling
            city_statuses = {}
            pop_map = {}
            for z in self.zones:
                power_hours = self.power_down_steps[z.zone_id] * self.step_minutes / 60.0
                r, st, forced = zone_status(z, power_hours, self.hospital_access_lost[z.zone_id])
                self.ground_truth.append({
                    "t": step,
                    "step_minutes": self.step_minutes,
                    "zone_id": z.zone_id,
                    "risk": r,
                    "status": st,
                    "forced_critical": forced,
                    "latent": {
                        "rainfall_mm_hr": z.rainfall_mm_hr,
                        "soil_saturation": round(z.soil_saturation, 4),
                        "drain_fill": round(z.drain_fill, 4),
                        "surface_water_depth_m": round(z.surface_water_depth_m, 4),
                        "river_level_m": z.river_level_m,
                        "road_capacity": round(z.road_capacity, 4),
                        "congestion": round(z.congestion, 4),
                        "power_supply_ratio": round(z.power_supply_ratio, 4),
                        "substation_flood_exposure": round(z.substation_flood_exposure, 4),
                        "telecom_load": round(z.telecom_load, 4),
                        "ambulance_response_time_min": round(z.ambulance_response_time_min, 3),
                        "hospital_occupancy": round(z.hospital_occupancy, 4),
                        "medicine_stock": round(z.medicine_stock, 4),
                        "emergency_call_rate": round(z.emergency_call_rate, 3),
                    },
                })
                city_statuses[z.zone_id] = st
                pop_map[z.zone_id] = z.population
            # city-wide critical override for labels? We'll add a separate record
            cw = city_wide(city_statuses, pop_map)
            self.ground_truth.append({
                "t": step,
                "city_wide": True,
                "city_critical": cw,
                "critical_zones": [z for z, s in city_statuses.items() if s == "CRITICAL"],
            })
            # inject faults maybe random road closure
            if self.rng.random() < 0.02:
                z = self.rng.choice(self.zones)
                z.road_capacity = max(0.05, z.road_capacity - 0.3)
                self.fault_log.append({"step": step, "type": "road_closure", "zone": z.zone_id})
            # observations
            for z in self.zones:
                obs = self._generate_observation(step, z)
                self.observations.append(obs)
        return self

    def save_ground_truth(self, path):
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("w") as f:
            for r in self.ground_truth:
                f.write(json.dumps(r) + "\n")
        return p

    def save_observations(self, path):
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("w") as f:
            for o in self.observations:
                f.write(json.dumps(o) + "\n")
        return p

    def save_logs(self, fault_path, drift_path):
        Path(fault_path).parent.mkdir(parents=True, exist_ok=True)
        Path(drift_path).parent.mkdir(parents=True, exist_ok=True)
        Path(fault_path).write_text(json.dumps(self.fault_log, indent=2))
        Path(drift_path).write_text(json.dumps(self.drift_log, indent=2))
