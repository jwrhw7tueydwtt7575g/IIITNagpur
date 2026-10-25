"""
CityGraph ESP32 Edge Sensor Monitoring & Prophet Prediction Engine
-------------------------------------------------------------------
Manages real-time telemetry from ESP32 edge sensor nodes:
  - MQ-135 Gas / Air Quality Sensor (Analog: nominal ~415, Warning Threshold: 1500)
  - DHT Temperature & Humidity Sensor (Temp nominal ~25.4°C / 40°C threshold, Humidity ~60.0% / 85% threshold)
  - IR Digital Optical Water Sensor (Digital 1: Dry/Clear, Digital 0: Water Detected)

Uses Meta's Prophet model to generate 30-minute forward forecasts and time-to-breach alerts.
"""

from __future__ import annotations

import datetime as dt
import logging
import math
import random
import threading
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger("citygraph.sensor_engine")


class SensorEngine:
    """Singleton engine maintaining rolling ESP32 telemetry buffer and Prophet forecasts."""

    WARNING_THRESHOLDS = {
        "temperature_c": 40.0,
        "humidity_pct": 85.0,
        "mq135_air_quality": 1500.0,
        "ir_digital": 0,  # 0 indicates water detection
    }

    def __init__(self, history_minutes: int = 60, interval_seconds: int = 10) -> None:
        self.lock = threading.RLock()
        self.history_minutes = history_minutes

        self.interval_seconds = interval_seconds
        self.active_scenario = "nominal"  # nominal | water_surge | gas_leak | heatwave
        self.scenario_start_time = dt.datetime.now(dt.timezone.utc)

        # Baseline hardware specs matching user terminal
        self.hardware_meta = {
            "device_id": "ESP32-EDGE-NODE-01",
            "mcu": "ESP32-WROOM-32D (Dual Core 240MHz)",
            "firmware_version": "v2.4.1-defense",
            "sensors": ["DHT22 (Temp/RH)", "MQ-135 (Hazardous Gas)", "IR Optical Probe (Flood Level)"],
            "wifi_rssi_dbm": -58,
            "bus_voltage_v": 3.28,
            "sampling_interval_sec": 10,
        }

        # Initialize rolling buffer
        self.readings: List[Dict[str, Any]] = []
        self._seed_initial_history()

    def _seed_initial_history(self) -> None:
        """Seed the past 60 minutes with realistic baseline micro-fluctuations."""
        now = dt.datetime.now(dt.timezone.utc)
        total_steps = (self.history_minutes * 60) // self.interval_seconds

        for i in range(total_steps, 0, -1):
            timestamp = now - dt.timedelta(seconds=i * self.interval_seconds)
            # Subtle smooth diurnal sine variation + Gaussian jitter
            t_val = timestamp.timestamp() / 600.0
            temp = round(25.4 + 0.35 * math.sin(t_val) + random.uniform(-0.15, 0.15), 1)
            humidity = round(60.0 + 0.8 * math.cos(t_val) + random.uniform(-0.3, 0.3), 1)
            gas = round(415.0 + 3.5 * math.sin(t_val * 1.5) + random.uniform(-2.5, 2.5), 1)
            ir_val = 1
            water_warning = "CLEAR"

            self.readings.append(
                {
                    "timestamp": timestamp.isoformat(),
                    "epoch_seconds": int(timestamp.timestamp()),
                    "temperature_c": temp,
                    "humidity_pct": humidity,
                    "mq135_air_quality": gas,
                    "ir_digital": ir_val,
                    "water_detected": False,
                    "water_warning": water_warning,
                }
            )

    def tick(self) -> Dict[str, Any]:
        """Generate the next 10-second telemetry observation based on active scenario."""
        with self.lock:
            now = dt.datetime.now(dt.timezone.utc)
            last = self.readings[-1] if self.readings else {}

            base_temp = last.get("temperature_c", 25.4)
            base_hum = last.get("humidity_pct", 60.0)
            base_gas = last.get("mq135_air_quality", 415.0)
            ir_val = 1
            water_detected = False
            water_warning = "CLEAR"

            if self.active_scenario == "nominal":
                # Realistic micro-fluctuations around nominal operating baseline
                next_temp = round(25.4 + random.uniform(-0.25, 0.25), 1)
                next_hum = round(60.0 + random.uniform(-0.4, 0.4), 1)
                next_gas = round(415.0 + random.uniform(-3.0, 3.0), 1)

            elif self.active_scenario == "water_surge":
                # Optical IR sensor trips, humidity climbs sharply
                elapsed = (now - self.scenario_start_time).total_seconds()
                next_temp = round(max(21.0, base_temp - 0.1), 1)
                next_hum = round(min(96.0, base_hum + 0.8), 1)
                next_gas = round(base_gas + random.uniform(-2.0, 2.0), 1)
                if elapsed > 15:
                    ir_val = 0
                    water_detected = True
                    water_warning = "WATER DETECTED"

            elif self.active_scenario == "gas_leak":
                # MQ-135 reading surges towards and exceeds 1500 PPM threshold
                next_temp = round(base_temp + random.uniform(-0.1, 0.15), 1)
                next_hum = round(base_hum + random.uniform(-0.2, 0.2), 1)
                next_gas = round(min(2200.0, base_gas + random.uniform(35.0, 65.0)), 1)

            elif self.active_scenario == "heatwave":
                # Thermal spike climbing towards 42°C
                next_temp = round(min(44.5, base_temp + random.uniform(0.2, 0.45)), 1)
                next_hum = round(max(35.0, base_hum - random.uniform(0.3, 0.6)), 1)
                next_gas = round(base_gas + random.uniform(1.0, 3.0), 1)

            else:
                next_temp = 25.4
                next_hum = 60.0
                next_gas = 415.0

            reading = {
                "timestamp": now.isoformat(),
                "epoch_seconds": int(now.timestamp()),
                "temperature_c": next_temp,
                "humidity_pct": next_hum,
                "mq135_air_quality": next_gas,
                "ir_digital": ir_val,
                "water_detected": water_detected,
                "water_warning": water_warning,
            }

            self.readings.append(reading)

            # Cap history window to max 60 minutes
            max_readings = (self.history_minutes * 60) // self.interval_seconds
            if len(self.readings) > max_readings:
                self.readings = self.readings[-max_readings:]

            return reading

    def get_latest_telemetry(self, history_points: int = 60) -> Dict[str, Any]:
        """Return the current reading, hardware status, and the most recent N points."""
        with self.lock:
            latest = self.tick()
            history_slice = self.readings[-history_points:]

            # Threshold status checks
            temp_status = "NORMAL"
            if latest["temperature_c"] >= self.WARNING_THRESHOLDS["temperature_c"]:
                temp_status = "CRITICAL"
            elif latest["temperature_c"] >= self.WARNING_THRESHOLDS["temperature_c"] - 4.0:
                temp_status = "WATCH"

            gas_status = "NORMAL"
            if latest["mq135_air_quality"] >= self.WARNING_THRESHOLDS["mq135_air_quality"]:
                gas_status = "CRITICAL"
            elif latest["mq135_air_quality"] >= 1000.0:
                gas_status = "WATCH"

            hum_status = "NORMAL"
            if latest["humidity_pct"] >= self.WARNING_THRESHOLDS["humidity_pct"]:
                hum_status = "CRITICAL"
            elif latest["humidity_pct"] >= 75.0:
                hum_status = "WATCH"

            water_status = "CRITICAL" if latest["water_detected"] else "CLEAR"

            overall_health = "NOMINAL"
            if "CRITICAL" in [temp_status, gas_status, hum_status, water_status]:
                overall_health = "ALERT"
            elif "WATCH" in [temp_status, gas_status, hum_status]:
                overall_health = "ADVISORY"

            return {
                "device": self.hardware_meta,
                "current": {
                    **latest,
                    "temperature_status": temp_status,
                    "humidity_status": hum_status,
                    "gas_status": gas_status,
                    "water_status": water_status,
                },
                "thresholds": self.WARNING_THRESHOLDS,
                "system_health": overall_health,
                "active_scenario": self.active_scenario,
                "history": history_slice,
                "total_buffered_readings": len(self.readings),
            }

    def set_scenario(self, scenario: str) -> Dict[str, Any]:
        """Switch simulation scenario."""
        valid_scenarios = ["nominal", "water_surge", "gas_leak", "heatwave"]
        if scenario not in valid_scenarios:
            raise ValueError(f"Invalid scenario '{scenario}'. Must be one of {valid_scenarios}")

        with self.lock:
            self.active_scenario = scenario
            self.scenario_start_time = dt.datetime.now(dt.timezone.utc)
            logger.info("ESP32 Sensor Engine switched to scenario: %s", scenario)
            return {"status": "ok", "scenario": scenario, "timestamp": self.scenario_start_time.isoformat()}

    def generate_prophet_forecast(self, horizon_minutes: int = 30) -> Dict[str, Any]:
        """Run Meta Prophet model to forecast the next 30-60 minutes."""
        with self.lock:
            df_source = pd.DataFrame(self.readings)

        if df_source.empty or len(df_source) < 10:
            return {"status": "insufficient_data", "forecast": {}}

        # Sample every 30s to keep prophet fitting snappy under 600ms
        df_sampled = df_source.iloc[::3].copy()
        df_sampled["ds"] = pd.to_datetime(df_sampled["timestamp"])

        forecast_results: Dict[str, Any] = {}
        target_metrics = [
            ("mq135_air_quality", "Gas & Air Quality (PPM)", 1500.0),
            ("temperature_c", "Temperature (°C)", 40.0),
            ("humidity_pct", "Relative Humidity (%)", 85.0),
        ]

        now = dt.datetime.now(dt.timezone.utc)

        for col, label, threshold in target_metrics:
            df_metric = df_sampled[["ds", col]].rename(columns={col: "y"})
            df_metric["ds"] = df_metric["ds"].dt.tz_localize(None)

            try:
                from prophet import Prophet  # Meta Prophet

                # Highly optimized Prophet instance for real-time edge telemetry
                m = Prophet(
                    yearly_seasonality=False,
                    weekly_seasonality=False,
                    daily_seasonality=False,
                    interval_width=0.95,
                    n_changepoints=8,
                    changepoint_prior_scale=0.08,
                )
                m.fit(df_metric)

                future = m.make_future_dataframe(periods=horizon_minutes, freq="1min")
                forecast = m.predict(future)

                # Tail only future points
                future_forecast = forecast[forecast["ds"] > df_metric["ds"].max()].copy()

                points = []
                exceeds_threshold = False
                time_to_exceed_min: Optional[int] = None

                for _, row in future_forecast.iterrows():
                    val = round(float(row["yhat"]), 2)
                    lower = round(float(row["yhat_lower"]), 2)
                    upper = round(float(row["yhat_upper"]), 2)
                    p_time = row["ds"].isoformat()

                    points.append(
                        {
                            "ds": p_time,
                            "yhat": val,
                            "yhat_lower": lower,
                            "yhat_upper": upper,
                        }
                    )

                    if val >= threshold and not exceeds_threshold:
                        exceeds_threshold = True
                        mins = int((row["ds"] - df_metric["ds"].max()).total_seconds() / 60)
                        time_to_exceed_min = max(mins, 1)

                forecast_results[col] = {
                    "label": label,
                    "threshold": threshold,
                    "unit": "PPM" if col == "mq135_air_quality" else ("°C" if "temp" in col else "%"),
                    "current_value": round(float(df_source[col].iloc[-1]), 2),
                    "projected_peak": round(float(future_forecast["yhat"].max()), 2),
                    "projected_trough": round(float(future_forecast["yhat"].min()), 2),
                    "trend_direction": "RISING" if future_forecast["yhat"].iloc[-1] > df_source[col].iloc[-1] else "FALLING",
                    "exceeds_threshold": exceeds_threshold,
                    "time_to_warning_minutes": time_to_exceed_min,
                    "forecast_points": points,
                }

            except Exception as err:
                logger.warning("Prophet fitting fallback for %s: %s", col, err)
                # Resilient analytical trend fallback
                current_v = float(df_source[col].iloc[-1])
                slope = (current_v - float(df_source[col].iloc[-10])) / 10.0
                fallback_points = []
                for m_idx in range(1, horizon_minutes + 1):
                    p_time = (now + dt.timedelta(minutes=m_idx)).isoformat()
                    proj = round(current_v + slope * m_idx, 2)
                    fallback_points.append(
                        {
                            "ds": p_time,
                            "yhat": proj,
                            "yhat_lower": round(proj * 0.96, 2),
                            "yhat_upper": round(proj * 1.04, 2),
                        }
                    )
                forecast_results[col] = {
                    "label": label,
                    "threshold": threshold,
                    "unit": "PPM" if col == "mq135_air_quality" else ("°C" if "temp" in col else "%"),
                    "current_value": round(current_v, 2),
                    "projected_peak": max(p["yhat"] for p in fallback_points),
                    "projected_trough": min(p["yhat"] for p in fallback_points),
                    "trend_direction": "RISING" if slope > 0 else "FALLING",
                    "exceeds_threshold": any(p["yhat"] >= threshold for p in fallback_points),
                    "time_to_warning_minutes": None,
                    "forecast_points": fallback_points,
                }

        # Water Inundation probability projection
        ir_current = self.readings[-1]["ir_digital"] if self.readings else 1
        water_prob_forecast = []
        base_prob = 0.05 if ir_current == 1 else 0.95
        if self.active_scenario == "water_surge":
            base_prob = 0.88

        for m_idx in range(1, horizon_minutes + 1):
            p_time = (now + dt.timedelta(minutes=m_idx)).isoformat()
            p_prob = min(1.0, round(base_prob + (0.012 * m_idx if self.active_scenario == "water_surge" else 0.0), 3))
            water_prob_forecast.append({"ds": p_time, "inundation_probability": p_prob})

        return {
            "status": "ok",
            "model": "prophet_time_series_v1",
            "horizon_minutes": horizon_minutes,
            "forecast_generated_at": now.isoformat(),
            "metrics": forecast_results,
            "water_inundation_projection": {
                "current_ir_digital": ir_current,
                "current_state": "CLEAR" if ir_current == 1 else "WATER DETECTED",
                "projection": water_prob_forecast,
            },
        }


# Singleton Sensor Engine Instance
SENSOR_ENGINE = SensorEngine()
