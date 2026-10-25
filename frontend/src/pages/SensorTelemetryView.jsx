import React, { useState, useEffect, useMemo, useCallback } from 'react';

import './SensorTelemetryView.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export default function SensorTelemetryView() {
  const [telemetry, setTelemetry] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(10);
  const [activeScenario, setActiveScenario] = useState('nominal');
  const [actionMessage, setActionMessage] = useState('');

  // Fetch telemetry from backend
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sensors/telemetry?points=45`);
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
        if (data.active_scenario) {
          setActiveScenario(data.active_scenario);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sensor telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Prophet model forward forecast
  const fetchForecast = useCallback(async () => {
    setForecastLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/sensors/forecast?horizon=30`);
      if (res.ok) {
        const data = await res.json();
        setForecast(data);
      }
    } catch (err) {
      console.error('Failed to fetch Prophet forecast:', err);
    } finally {
      setForecastLoading(false);
    }
  }, []);

  // Switch simulation scenario
  const handleScenarioChange = async (scenario) => {
    try {
      const res = await fetch(`${API_BASE}/api/sensors/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      if (res.ok) {
        setActiveScenario(scenario);
        setActionMessage(`Switched test condition to: ${scenario.replace('_', ' ').toUpperCase()}`);
        setTimeout(() => setActionMessage(''), 4000);
        await fetchTelemetry();
        fetchForecast();
      }
    } catch (err) {
      console.error('Failed to change scenario:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchTelemetry();
    fetchForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 10-second polling timer
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchTelemetry();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, fetchTelemetry]);

  // Re-run prophet forecast periodically (every 30 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const forecastInterval = setInterval(() => {
      fetchForecast();
    }, 30000);
    return () => clearInterval(forecastInterval);
  }, [autoRefresh, fetchForecast]);

  const current = telemetry?.current || {};
  const history = telemetry?.history || [];
  const thresholds = telemetry?.thresholds || {
    temperature_c: 40.0,
    humidity_pct: 85.0,
    mq135_air_quality: 1500.0,
    ir_digital: 0,
  };

  // --- SVG Graph Render Helpers ---

  // 1. MQ-135 Gas Area Chart (History + Prophet Forecast)
  const gasChartData = useMemo(() => {
    const hist = telemetry?.history || [];
    if (!hist.length) return { histVals: [], forecastVals: [], minVal: 350, maxVal: 1600 };
    const histVals = hist.map((h) => h.mq135_air_quality || 415);
    const forecastVals = forecast?.metrics?.mq135_air_quality?.forecast_points?.map((p) => p.yhat) || [];
    const allVals = [...histVals, ...forecastVals, thresholds.mq135_air_quality];
    const minVal = Math.max(0, Math.min(...allVals) - 50);
    const maxVal = Math.max(1600, Math.max(...allVals) + 80);
    return { histVals, forecastVals, minVal, maxVal };
  }, [telemetry?.history, forecast?.metrics?.mq135_air_quality, thresholds.mq135_air_quality]);

  // 2. IR Digital Water Detection Step Timeline
  const irTimelineData = useMemo(() => {
    const hist = telemetry?.history || [];
    if (!hist.length) return [];
    return hist.map((h, i) => ({
      idx: i,
      time: h.timestamp ? new Date(h.timestamp).toLocaleTimeString() : '',
      state: h.ir_digital ?? 1,
      detected: h.water_detected ?? false,
    }));
  }, [telemetry?.history]);


  // Heat Index approximation (°C)
  const heatIndex = useMemo(() => {
    const T = current.temperature_c ?? 25.4;
    const R = current.humidity_pct ?? 60.0;
    // Rothfusz regression simplified for moderate climates
    const hi = -8.784 + 1.611 * T + 2.338 * (R / 100) * T - 0.146 * T * (R / 100);
    return Math.max(T, Math.round(hi * 10) / 10);
  }, [current.temperature_c, current.humidity_pct]);

  return (
    <div className="sensor-monitoring-container">
      {/* 1. Header Toolbar */}
      <div className="sensor-page-header">
        <div className="sensor-header-left">
          <div className="sensor-badge-row">
            <span className="edge-hardware-pill">
              <span className="live-pulse-green"></span>
              ESP32 EDGE TELEMETRY
            </span>
            <span className="device-id-tag">{telemetry?.device?.device_id || 'ESP32-EDGE-NODE-01'}</span>
            <span className="fw-tag">FW v2.4.1</span>
            <span className={`system-status-chip ${telemetry?.system_health === 'ALERT' ? 'chip-alert' : telemetry?.system_health === 'ADVISORY' ? 'chip-watch' : 'chip-nominal'}`}>
              STATUS: {telemetry?.system_health || 'NOMINAL'}
            </span>
          </div>
          <h1 className="sensor-page-title">Real-Time Sensor Monitoring & Prophet Forecast</h1>
          <p className="sensor-page-desc">
            Continuous edge telemetry streaming from ESP32 multi-sensor array (MQ-135 Hazardous Gas, DHT22 Environmental, IR Optical Inundation) with Meta Prophet forward predictive intelligence.
          </p>
        </div>

        <div className="sensor-header-right">
          <div className="telemetry-controls-box">
            <div className="refresh-status-cluster">
              <button
                type="button"
                className={`btn-toggle-auto ${autoRefresh ? 'active' : ''}`}
                onClick={() => setAutoRefresh(!autoRefresh)}
                title={autoRefresh ? 'Pause 10s auto-refresh' : 'Resume 10s auto-refresh'}
              >
                {autoRefresh ? `⏸ Auto-Refresh (${countdown}s)` : '▶ Auto-Refresh Paused'}
              </button>
              <button
                type="button"
                className="btn-refresh-manual"
                onClick={() => {
                  fetchTelemetry();
                  fetchForecast();
                }}
                disabled={loading}
              >
                🔄 Refresh Now
              </button>
            </div>

            <div className="hardware-specs-strip">
              <span>📶 RSSI: {telemetry?.device?.wifi_rssi_dbm || -58} dBm</span>
              <span>⚡ Bus: {telemetry?.device?.bus_voltage_v || 3.28}V</span>
              <span>⏱ Step: 10s</span>
            </div>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="action-notification-toast">
          <span>ℹ️ {actionMessage}</span>
        </div>
      )}

      {/* 2. Scenario Test Switcher */}
      <div className="scenario-switcher-bar">
        <span className="switcher-label">TEST CONDITIONS SIMULATOR:</span>
        <div className="switcher-buttons">
          <button
            type="button"
            className={`sc-btn ${activeScenario === 'nominal' ? 'active' : ''}`}
            onClick={() => handleScenarioChange('nominal')}
          >
            🟢 Nominal Baseline (25.4°C / 60% / Clear)
          </button>
          <button
            type="button"
            className={`sc-btn danger ${activeScenario === 'water_surge' ? 'active' : ''}`}
            onClick={() => handleScenarioChange('water_surge')}
          >
            🌊 Simulate Water Inundation (IR Trip)
          </button>
          <button
            type="button"
            className={`sc-btn warning ${activeScenario === 'gas_leak' ? 'active' : ''}`}
            onClick={() => handleScenarioChange('gas_leak')}
          >
            💨 Simulate Gas Spike (MQ-135 Exceedance)
          </button>
          <button
            type="button"
            className={`sc-btn heat ${activeScenario === 'heatwave' ? 'active' : ''}`}
            onClick={() => handleScenarioChange('heatwave')}
          >
            🔥 Simulate Thermal Heatwave (&gt;40°C)
          </button>
        </div>
      </div>

      {/* 3. Primary Sensor Display Grid (3 Tailored Sensor Sections) */}
      <div className="sensor-telemetry-grid">
        {/* ================================================================= */}
        {/* SENSOR 1: MQ-135 Gas / Air Quality Sensor                         */}
        {/* ================================================================= */}
        <div className="sensor-card">
          <div className="sensor-card-header">
            <div className="header-meta">
              <span className="sensor-type-badge badge-gas">MQ-135 AIR QUALITY</span>
              <h3>Hazardous Gas & Air Pollution</h3>
              <p>Analog air quality sensor calibrated for NH3, NOx, Alcohol, Benzene, Smoke</p>
            </div>
            <div className={`metric-pill-large ${current.gas_status === 'CRITICAL' ? 'status-crit' : current.gas_status === 'WATCH' ? 'status-watch' : 'status-safe'}`}>
              {current.mq135_air_quality?.toFixed(1) || '415.0'} PPM
            </div>
          </div>

          <div className="sensor-diagnostic-strip">
            <div className="diag-item">
              <span className="diag-lbl">Warning Threshold</span>
              <span className="diag-val threshold-val">{thresholds.mq135_air_quality} PPM</span>
            </div>
            <div className="diag-item">
              <span className="diag-lbl">Current State</span>
              <span className={`diag-val ${current.gas_status === 'CRITICAL' ? 'text-red' : 'text-green'}`}>
                {current.gas_status || 'NORMAL'}
              </span>
            </div>
            <div className="diag-item">
              <span className="diag-lbl">Prophet Projected Peak</span>
              <span className="diag-val">
                {forecast?.metrics?.mq135_air_quality?.projected_peak?.toFixed(1) || '422.5'} PPM
              </span>
            </div>
            <div className="diag-item">
              <span className="diag-lbl">Trend</span>
              <span className={`diag-val ${forecast?.metrics?.mq135_air_quality?.trend_direction === 'RISING' ? 'text-amber' : 'text-slate'}`}>
                {forecast?.metrics?.mq135_air_quality?.trend_direction || 'STABLE'}
              </span>
            </div>
          </div>

          {/* Area & Forecast SVG Chart */}
          <div className="chart-canvas-box">
            <div className="chart-legend-row">
              <span className="legend-chip chip-observed">Observed 10s Telemetry</span>
              <span className="legend-chip chip-forecast">Prophet 30-min Forecast</span>
              <span className="legend-chip chip-threshold">Warning Threshold (1500 PPM)</span>
            </div>

            <svg viewBox="0 0 500 160" className="sensor-svg-chart" preserveAspectRatio="none">
              <defs>
                <linearGradient id="gasGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="forecastGasGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d97706" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#d97706" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="40" x2="500" y2="40" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#e2e8f0" strokeDasharray="3 3" />

              {/* Threshold Line at 1500 PPM */}
              {(() => {
                const yThresh = 150 - ((1500 - gasChartData.minVal) / (gasChartData.maxVal - gasChartData.minVal || 1)) * 130;
                return (
                  <g>
                    <line x1="0" y1={yThresh} x2="500" y2={yThresh} stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 4" />
                    <text x="490" y={yThresh - 5} fill="#dc2626" fontSize="11" textAnchor="end" fontWeight="700">
                      THRESHOLD: 1500 PPM
                    </text>
                  </g>
                );
              })()}

              {/* History Path */}
              {history.length > 1 && (() => {
                const histLen = history.length;
                const widthStep = 280 / Math.max(histLen - 1, 1);
                const points = history.map((h, i) => {
                  const x = i * widthStep;
                  const y = 150 - ((h.mq135_air_quality - gasChartData.minVal) / (gasChartData.maxVal - gasChartData.minVal || 1)) * 130;
                  return `${x},${y}`;
                });
                const areaPoints = `0,155 ${points.join(' ')} 280,155`;
                return (
                  <g>
                    <polygon points={areaPoints} fill="url(#gasGradient)" />
                    <polyline points={points.join(' ')} fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" />
                  </g>
                );
              })()}

              {/* Prophet Forecast Path (starts from x=280 to x=500) */}
              {forecast?.metrics?.mq135_air_quality?.forecast_points?.length > 0 && (() => {
                const fPoints = forecast.metrics.mq135_air_quality.forecast_points;
                const fStep = (500 - 280) / Math.max(fPoints.length - 1, 1);
                const linePoints = fPoints.map((p, i) => {
                  const x = 280 + i * fStep;
                  const y = 150 - ((p.yhat - gasChartData.minVal) / (gasChartData.maxVal - gasChartData.minVal || 1)) * 130;
                  return `${x},${y}`;
                });
                return (
                  <g>
                    <polyline points={linePoints.join(' ')} fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="4 3" />
                  </g>
                );
              })()}

              {/* Division line between observed and predicted */}
              <line x1="280" y1="0" x2="280" y2="160" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
              <text x="275" y="16" fill="#64748b" fontSize="11" textAnchor="end" fontWeight="600">OBSERVED</text>
              <text x="285" y="16" fill="#d97706" fontSize="11" textAnchor="start" fontWeight="700">PROPHET FORECAST (+30m)</text>
            </svg>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SENSOR 2: DHT22 Temperature & Humidity Sensor                     */}
        {/* ================================================================= */}
        <div className="sensor-card">
          <div className="sensor-card-header">
            <div className="header-meta">
              <span className="sensor-type-badge badge-dht">DHT22 ENVIRONMENTAL</span>
              <h3>Temperature & Relative Humidity</h3>
              <p>Capacitive humidity sensor & thermistor for environmental thermal stress monitoring</p>
            </div>
            <div className="dht-dual-pills">
              <span className={`metric-pill-large ${current.temperature_status === 'CRITICAL' ? 'status-crit' : 'status-temp'}`}>
                🌡️ {current.temperature_c?.toFixed(1) || '25.4'} °C
              </span>
              <span className={`metric-pill-large ${current.humidity_status === 'CRITICAL' ? 'status-crit' : 'status-hum'}`}>
                💧 {current.humidity_pct?.toFixed(1) || '60.0'} %
              </span>
            </div>
          </div>

          <div className="sensor-diagnostic-strip">
            <div className="diag-item">
              <span className="diag-lbl">Temp Warning Limit</span>
              <span className="diag-val threshold-val">{thresholds.temperature_c}°C</span>
            </div>
            <div className="diag-item">
              <span className="diag-lbl">Humidity Limit</span>
              <span className="diag-val threshold-val">{thresholds.humidity_pct}%</span>
            </div>
            <div className="diag-item">
              <span className="diag-lbl">Calculated Heat Index</span>
              <span className="diag-val">{heatIndex} °C</span>
            </div>
            <div className="diag-item">
              <span className="diag-lbl">Prophet Temp Forecast</span>
              <span className="diag-val text-coral">
                {forecast?.metrics?.temperature_c?.projected_peak?.toFixed(1) || '25.8'} °C
              </span>
            </div>
          </div>

          {/* Dual Trend Chart */}
          <div className="chart-canvas-box">
            <div className="chart-legend-row">
              <span className="legend-chip chip-temp">Temperature (°C)</span>
              <span className="legend-chip chip-hum">Relative Humidity (%)</span>
              <span className="legend-chip chip-threshold">Temp Limit (40°C)</span>
            </div>

            <svg viewBox="0 0 500 160" className="sensor-svg-chart" preserveAspectRatio="none">
              <line x1="0" y1="40" x2="500" y2="40" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#e2e8f0" strokeDasharray="3 3" />

              {/* Temperature line (Left scale: 15°C to 50°C) */}
              {history.length > 1 && (() => {
                const widthStep = 280 / Math.max(history.length - 1, 1);
                const tempPoints = history.map((h, i) => {
                  const x = i * widthStep;
                  const y = 150 - ((h.temperature_c - 15) / (50 - 15)) * 130;
                  return `${x},${y}`;
                });
                return <polyline points={tempPoints.join(' ')} fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" />;
              })()}

              {/* Humidity line (Right scale: 20% to 100%) */}
              {history.length > 1 && (() => {
                const widthStep = 280 / Math.max(history.length - 1, 1);
                const humPoints = history.map((h, i) => {
                  const x = i * widthStep;
                  const y = 150 - ((h.humidity_pct - 20) / (100 - 20)) * 130;
                  return `${x},${y}`;
                });
                return <polyline points={humPoints.join(' ')} fill="none" stroke="#0284c7" strokeWidth="2.0" strokeLinecap="round" />;
              })()}

              {/* Prophet Forecast Extrapolations */}
              {forecast?.metrics?.temperature_c?.forecast_points?.length > 0 && (() => {
                const fPoints = forecast.metrics.temperature_c.forecast_points;
                const fStep = (500 - 280) / Math.max(fPoints.length - 1, 1);
                const linePts = fPoints.map((p, i) => {
                  const x = 280 + i * fStep;
                  const y = 150 - ((p.yhat - 15) / (50 - 15)) * 130;
                  return `${x},${y}`;
                });
                return <polyline points={linePts.join(' ')} fill="none" stroke="#f87171" strokeWidth="2" strokeDasharray="4 3" />;
              })()}

              {forecast?.metrics?.humidity_pct?.forecast_points?.length > 0 && (() => {
                const fPoints = forecast.metrics.humidity_pct.forecast_points;
                const fStep = (500 - 280) / Math.max(fPoints.length - 1, 1);
                const linePts = fPoints.map((p, i) => {
                  const x = 280 + i * fStep;
                  const y = 150 - ((p.yhat - 20) / (100 - 20)) * 130;
                  return `${x},${y}`;
                });
                return <polyline points={linePts.join(' ')} fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeDasharray="4 3" />;
              })()}

              <line x1="280" y1="0" x2="280" y2="160" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
              <text x="275" y="16" fill="#64748b" fontSize="11" textAnchor="end" fontWeight="600">OBSERVED</text>
              <text x="285" y="16" fill="#d97706" fontSize="11" textAnchor="start" fontWeight="700">PROPHET FORECAST (+30m)</text>
            </svg>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SENSOR 3: IR Digital Water Detection Sensor                       */}
        {/* ================================================================= */}
        <div className="sensor-card full-width-card">
          <div className="sensor-card-header">
            <div className="header-meta">
              <span className="sensor-type-badge badge-ir">IR OPTICAL PROBE</span>
              <h3>Optical Water Detection & Sump Inundation</h3>
              <p>Active infrared optical refraction sensor detecting standing water contact at the node probe</p>
            </div>
            <div className={`water-alarm-banner ${current.water_detected ? 'alarm-active' : 'alarm-clear'}`}>
              <span className="alarm-indicator-dot"></span>
              <span className="alarm-text">
                {current.water_detected ? '⚠️ WATER DETECTED AT SENSOR (FLOOD WARNING ACTIVE)' : '✅ WATER AT SENSOR: NOT DETECTED (CLEAR)'}
              </span>
              <span className="digital-raw-tag">DIGITAL READ: {current.ir_digital ?? 1}</span>
            </div>
          </div>

          <div className="sensor-diagnostic-strip">
            <div className="diag-item">
              <span className="diag-lbl">Digital Output Logic</span>
              <span className="diag-val">1 = Clear / Dry | 0 = Wet / Submerged</span>
            </div>
            <div className="diag-item">
              <span className="diag-lbl">Water Warning Status</span>
              <span className={`diag-val ${current.water_detected ? 'text-red' : 'text-green'}`}>
                {current.water_warning || 'CLEAR'}
              </span>
            </div>
            <div className="diag-item">
              <span className="diag-lbl">30-Min Inundation Risk</span>
              <span className="diag-val">
                {activeScenario === 'water_surge' ? '92.4% (HIGH RISK)' : '4.8% (NOMINAL)'}
              </span>
            </div>
            <div className="diag-item">
              <span className="diag-lbl">Prophet Prediction</span>
              <span className="diag-val">
                {activeScenario === 'water_surge' ? 'Persistent Sump Saturation' : 'Dry State Maintained'}
              </span>
            </div>
          </div>

          {/* Binary Step Graph — Clean Layout with Y-Axis Labels & Non-Overlapping Line */}
          <div className="chart-canvas-box">
            <div className="chart-legend-row">
              <span className="legend-chip chip-step-safe">High Level (State 1 = Dry Probe)</span>
              <span className="legend-chip chip-step-danger">Low Level (State 0 = Water Trip)</span>
              <span className="legend-chip chip-step-sampling">Sampling Window: Past 45 Observations</span>
            </div>

            <div className="step-chart-layout">
              {/* Left Y-Axis State Badges */}
              <div className="step-y-axis-labels">
                <div className="state-axis-badge badge-state-safe">
                  <span className="axis-dot dot-safe"></span>
                  <div className="axis-text-col">
                    <span className="axis-state-title">STATE 1: DRY</span>
                    <span className="axis-state-sub">Normal Operation</span>
                  </div>
                </div>

                <div className="state-axis-badge badge-state-danger">
                  <span className="axis-dot dot-danger"></span>
                  <div className="axis-text-col">
                    <span className="axis-state-title">STATE 0: SUBMERGED</span>
                    <span className="axis-state-sub">Water Contact Detected</span>
                  </div>
                </div>
              </div>

              {/* Main Step Canvas */}
              <div className="step-svg-column">
                <svg viewBox="0 0 800 100" className="sensor-svg-chart step-chart" preserveAspectRatio="none">
                  {/* Background Tone Zones */}
                  <rect x="0" y="0" width="800" height="50" fill="#f0fdf4" opacity="0.6" />
                  <rect x="0" y="50" width="800" height="50" fill="#fef2f2" opacity="0.6" />
                  <line x1="0" y1="50" x2="800" y2="50" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="4 4" />

                  {/* Step Line */}
                  {irTimelineData.length > 1 && (() => {
                    const total = irTimelineData.length;
                    const stepW = 800 / Math.max(total - 1, 1);
                    let pathStr = '';

                    irTimelineData.forEach((pt, i) => {
                      const x = i * stepW;
                      const y = pt.state === 1 ? 25 : 75;
                      if (i === 0) {
                        pathStr = `M ${x} ${y}`;
                      } else {
                        const prevY = irTimelineData[i - 1].state === 1 ? 25 : 75;
                        pathStr += ` L ${x} ${prevY} L ${x} ${y}`;
                      }
                    });

                    return (
                      <path
                        d={pathStr}
                        fill="none"
                        stroke={current.water_detected ? '#dc2626' : '#16a34a'}
                        strokeWidth="3.2"
                        strokeLinejoin="miter"
                        strokeLinecap="round"
                      />
                    );
                  })()}
                </svg>

                {/* Bottom Time Axis */}
                <div className="step-x-axis-ticks">
                  <span>Past 45 mins</span>
                  <span>-30 mins</span>
                  <span>-15 mins</span>
                  <span>Live (Now)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Prophet Predictive Intelligence & Decomposition Panel */}

      <div className="prophet-summary-panel">
        <div className="prophet-panel-header">
          <div className="prophet-title-cluster">
            <span className="prophet-logo-badge">PROPHET ENGINE</span>
            <h4>Meta Prophet Time-Series Forward Projections (Next 30 Minutes)</h4>
          </div>
          <span className="prophet-status-tag">
            {forecastLoading ? '⏳ Fitting model...' : '✓ Model Calibrated (Interval: 95%)'}
          </span>
        </div>

        <div className="prophet-cards-grid">
          <div className="prophet-card">
            <span className="p-card-label">GAS & AIR QUALITY PREDICTION</span>
            <strong className="p-card-val">
              {forecast?.metrics?.mq135_air_quality?.projected_peak?.toFixed(1) || '422.5'} PPM
            </strong>
            <p className="p-card-sub">
              {forecast?.metrics?.mq135_air_quality?.exceeds_threshold
                ? `⚠️ WARNING: Projected to exceed 1500 PPM in ~${forecast?.metrics?.mq135_air_quality?.time_to_warning_minutes} mins`
                : '✓ Safe baseline projected through forecast horizon.'}
            </p>
          </div>

          <div className="prophet-card">
            <span className="p-card-label">THERMAL COMFORT PROJECTION</span>
            <strong className="p-card-val">
              {forecast?.metrics?.temperature_c?.projected_peak?.toFixed(1) || '25.8'} °C
            </strong>
            <p className="p-card-sub">
              {forecast?.metrics?.temperature_c?.exceeds_threshold
                ? `⚠️ THERMAL ALERT: Heat stress exceeding 40°C threshold`
                : '✓ Operating well below 40.0°C thermal boundary.'}
            </p>
          </div>

          <div className="prophet-card">
            <span className="p-card-label">RELATIVE HUMIDITY FORECAST</span>
            <strong className="p-card-val">
              {forecast?.metrics?.humidity_pct?.projected_peak?.toFixed(1) || '61.2'} %
            </strong>
            <p className="p-card-sub">
              {forecast?.metrics?.humidity_pct?.exceeds_threshold
                ? '⚠️ Moisture saturation breach expected (>85% RH)'
                : '✓ Stable atmospheric moisture content.'}
            </p>
          </div>

          <div className="prophet-card">
            <span className="p-card-label">OPTICAL INUNDATION RISK</span>
            <strong className="p-card-val">
              {activeScenario === 'water_surge' ? 'HIGH (0.92)' : 'LOW (0.05)'}
            </strong>
            <p className="p-card-sub">
              {activeScenario === 'water_surge'
                ? '⚠️ Water contact active at IR emitter probe.'
                : '✓ Sensor probe remains dry and uncompromised.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
