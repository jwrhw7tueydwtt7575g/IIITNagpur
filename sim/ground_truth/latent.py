from __future__ import annotations
from dataclasses import dataclass, field
import math


@dataclass
class ZoneLatent:
    zone_id: str
    population: int
    elevation_m: float
    drainage_capacity: float
    hospital_facilities: int
    substation_coverage: float
    ambulance_depots: int
    neighbors: list
    river_gauge: str | None

    # latent state
    rainfall_mm_hr: float = 0.0
    soil_saturation: float = 0.1
    drain_fill: float = 0.0
    surface_water_depth_m: float = 0.0
    river_level_m: float = 205.0
    road_capacity: float = 1.0
    congestion: float = 0.0
    power_supply_ratio: float = 1.0
    substation_flood_exposure: float = 0.0
    telecom_load: float = 0.2
    ambulance_response_time_min: float = 8.0
    hospital_occupancy: float = 0.3
    medicine_stock: float = 1.0
    emergency_call_rate: float = 0.5

    # lags
    _rain_lag: list = field(default_factory=lambda: [])

    def clamp(self):
        self.soil_saturation = max(0, min(1, self.soil_saturation))
        self.drain_fill = max(0, min(1.2, self.drain_fill))
        self.surface_water_depth_m = max(0, self.surface_water_depth_m)
        self.road_capacity = max(0.05, min(1, self.road_capacity))
        self.congestion = max(0, min(1, self.congestion))
        self.power_supply_ratio = max(0, min(1, self.power_supply_ratio))
        self.telecom_load = max(0, min(1, self.telecom_load))
        self.hospital_occupancy = max(0, min(1.2, self.hospital_occupancy))
        self.medicine_stock = max(0, min(1, self.medicine_stock))


def update_zone(z: ZoneLatent, global_rain: float, river_level: float, heatwave: float, disease: float, rng):
    # lags: store last 4 rainfall
    z._rain_lag.append(global_rain)
    z._rain_lag = z._rain_lag[-4:]
    # rain-induced soil saturation
    z.rainfall_mm_hr = global_rain
    z.soil_saturation += 0.02 * global_rain * (1 - z.drainage_capacity) - 0.015 * z.soil_saturation
    # river level global
    z.river_level_m = river_level + (205-z.elevation_m)*0.0  # placeholder
    # river backflow into drains
    backflow = max(0, (river_level - 206.0)) * 0.08 * (1 - z.drainage_capacity)
    z.drain_fill += 0.03 * z.soil_saturation + backflow - 0.02 * z.drainage_capacity
    # surface water
    z.surface_water_depth_m += 0.12 * max(0, z.drain_fill - 0.7) + 0.05 * backflow - 0.08 * z.surface_water_depth_m
    # road capacity loss
    z.road_capacity = 1.0 - 0.35 * min(1, z.surface_water_depth_m / 1.5) - 0.15 * max(0, z.drain_fill-0.8)
    if z.road_capacity < 0.4:
        z.road_capacity -= 0.05
    z.road_capacity = max(0.05, z.road_capacity)
    # congestion
    base_cong = (1 - z.road_capacity) * 0.9
    spillover = 0.0
    # neighbors handled outside perhaps
    z.congestion = 0.6 * z.congestion + 0.4 * (base_cong + 0.1*spillover + rng.gauss(0, 0.02))
    # power
    z.substation_flood_exposure = 0.7*z.substation_flood_exposure + 0.3*min(1, z.surface_water_depth_m/1.2 * (1-z.substation_coverage))
    z.power_supply_ratio = 1.0 - 0.6*min(1, z.substation_flood_exposure) + (0.1 if z.substation_flood_exposure<0.2 else 0)
    z.power_supply_ratio = max(0, min(1, z.power_supply_ratio))
    # pump failure if power low -> water increases
    if z.power_supply_ratio < 0.5:
        z.drain_fill += 0.02
        z.surface_water_depth_m += 0.03
    # telecom
    z.telecom_load = 0.5*z.telecom_load + 0.5*(0.2 + 0.6*(1-z.power_supply_ratio) + 0.2*z.congestion)
    # signals degrade; congestion externalities
    # ambulance
    z.ambulance_response_time_min = 8 + 25*z.congestion + 15*max(0, 1-z.road_capacity) + rng.gauss(0,1)
    z.ambulance_response_time_min = max(2, z.ambulance_response_time_min)
    # hospital
    load = z.hospital_occupancy
    emergency_boost = 0.02* (z.emergency_call_rate) + 0.03*heatwave + 0.05*disease
    if z.power_supply_ratio < 0.6 and z.hospital_facilities>0:
        emergency_boost += 0.04
    occ_increase = 0.03*z.congestion + emergency_boost - 0.02*(z.hospital_occupancy-0.4)
    z.hospital_occupancy += occ_increase
    # medicine stock depletes with occupancy
    z.medicine_stock = max(0, z.medicine_stock - 0.005*z.hospital_occupancy + (0.01 if z.power_supply_ratio>0.8 else 0))
    # emergency call rate
    z.emergency_call_rate = 0.5*z.emergency_call_rate + 0.5*(0.5 + 8*z.surface_water_depth_m + 3*heatwave + 4*disease + 2*z.congestion)
    z.clamp()
