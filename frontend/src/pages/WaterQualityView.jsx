import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './WaterQualityView.css';
import { API_BASE } from '../config.js';

// Fix Leaflet bundler default icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PRESET_OPTIONS = [
  { key: 'delhi', name: 'Yamuna River (Okhla Barrage)', city: 'Delhi', coords: [28.5441, 77.3094] },
  { key: 'delhi_bhalswa', name: 'Bhalswa Horseshoe Lake', city: 'Delhi', coords: [28.7412, 77.1611] },
  { key: 'mumbai', name: 'Powai Lake', city: 'Mumbai', coords: [19.1257, 72.9051] },
  { key: 'mumbai_vihar', name: 'Vihar Lake Reservoir', city: 'Mumbai', coords: [19.1415, 72.9158] },
];

export default function WaterQualityView() {
  const [selectedPreset, setSelectedPreset] = useState('delhi');
  const [selectedCoords, setSelectedCoords] = useState({ lat: 28.5441, lon: 77.3094 });
  const [locationName, setLocationName] = useState('Yamuna River (Okhla Barrage)');
  const [isCustomPoint, setIsCustomPoint] = useState(false);

  // Optical analysis data
  const [waterData, setWaterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // OpenAI NGO & Hospital Dispatch Alert state
  const [recipientType, setRecipientType] = useState('both');
  const [customNotes, setCustomNotes] = useState('');
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [facilities, setFacilities] = useState(null);

  // Leaflet map refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const activePinRef = useRef(null);

  // Fetch preset facilities metadata on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/cities`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.facilities) setFacilities(data.facilities);
      })
      .catch(() => {});
  }, []);

  // Fetch water quality analysis for preset or custom point
  const fetchAnalysis = useCallback(async (presetKey, customLat = null, customLon = null, name = null) => {
    setLoading(true);
    setError('');
    try {
      let url = '';
      if (customLat !== null && customLon !== null) {
        url = `${API_BASE}/api/v1/water-quality/point?lat=${customLat}&lon=${customLon}&location_name=${encodeURIComponent(name || 'Custom Coordinates')}`;
      } else {
        url = `${API_BASE}/api/v1/water-quality/city/${presetKey}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setWaterData(data);
      if (data.coordinates) {
        setSelectedCoords({ lat: data.coordinates.latitude, lon: data.coordinates.longitude });
      }
      setLocationName(data.location_name);
    } catch (err) {
      console.error('Failed to load optical water quality analysis:', err);
      setError('Unable to fetch satellite optical indicators from JalNetra service.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Preset selection handler
  const handleSelectPreset = useCallback((key) => {
    setSelectedPreset(key);
    setIsCustomPoint(false);
    const target = PRESET_OPTIONS.find((p) => p.key === key);
    if (target) {
      setSelectedCoords({ lat: target.coords[0], lon: target.coords[1] });
      setLocationName(target.name);
      fetchAnalysis(key);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo(target.coords, 13, { duration: 1.2 });
      }
    }
  }, [fetchAnalysis]);

  const handleSelectPresetRef = useRef(handleSelectPreset);
  const fetchAnalysisRef = useRef(fetchAnalysis);
  useEffect(() => {
    handleSelectPresetRef.current = handleSelectPreset;
    fetchAnalysisRef.current = fetchAnalysis;
  }, [handleSelectPreset, fetchAnalysis]);

  // Initial fetch on mount / preset change
  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/water-quality/city/${selectedPreset}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!ignore) {
          setWaterData(data);
          if (data.coordinates) {
            setSelectedCoords({ lat: data.coordinates.latitude, lon: data.coordinates.longitude });
          }
          setLocationName(data.location_name);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          console.warn('Initial water quality fetch:', err);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [selectedPreset]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [28.5441, 77.3094],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      subdomains: 'abc',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);

    // Plot preset water stations
    PRESET_OPTIONS.forEach((opt) => {
      const isDelhi = opt.city === 'Delhi';
      const markerHtml = `
        <div class="water-station-marker ${isDelhi ? 'delhi-marker' : 'mumbai-marker'}">
          <span class="marker-pulse"></span>
          <span class="marker-icon">💧</span>
        </div>
      `;
      const icon = L.divIcon({
        className: 'custom-water-marker',
        html: markerHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const m = L.marker(opt.coords, { icon });
      m.bindPopup(`
        <div style="font-size:12px; font-family:sans-serif; min-width:180px;">
          <strong style="color:#0f172a; font-size:13px;">${opt.name}</strong><br/>
          <span style="color:#64748b; font-size:11px;">${opt.city} · Sentinel-2 Station</span><br/>
          <button style="margin-top:6px; padding:4px 8px; font-size:11px; background:#2563eb; color:white; border:none; border-radius:4px; cursor:pointer;" onclick="window.jalnetra_inspect('${opt.key}')">Inspect Optical Indices</button>
        </div>
      `);
      markersLayerRef.current.addLayer(m);
    });

    // Handle map click for custom coordinate analysis
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const roundedLat = Number(lat.toFixed(4));
      const roundedLon = Number(lng.toFixed(4));
      const customName = `Custom Reach (${roundedLat}, ${roundedLon})`;

      setSelectedCoords({ lat: roundedLat, lon: roundedLon });
      setLocationName(customName);
      setIsCustomPoint(true);
      if (fetchAnalysisRef.current) {
        fetchAnalysisRef.current('custom', roundedLat, roundedLon, customName);
      }

      if (activePinRef.current) {
        map.removeLayer(activePinRef.current);
      }
      activePinRef.current = L.marker([roundedLat, roundedLon], {
        icon: L.divIcon({
          className: 'active-pin-marker',
          html: '<div style="background:#dc2626; color:white; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; box-shadow:0 0 0 3px white;">📍</div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map);
    });

    window.jalnetra_inspect = (presetKey) => {
      if (handleSelectPresetRef.current) {
        handleSelectPresetRef.current(presetKey);
      }
    };

    mapInstanceRef.current = map;

    return () => {
      delete window.jalnetra_inspect;
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Trigger OpenAI Dispatch Alert
  const handleDispatchAlert = async () => {
    if (!waterData) return;
    setDispatchLoading(true);
    setDispatchResult(null);
    try {
      const payload = {
        city: waterData.city || 'Delhi',
        location_name: waterData.location_name || locationName,
        coordinates: selectedCoords,
        severity: waterData.anomaly_assessment?.severity || 'ADVISORY',
        contamination_score: waterData.anomaly_assessment?.contamination_score || 50.0,
        primary_indicator: waterData.anomaly_assessment?.primary_indicator || 'turbidity',
        optical_indices: waterData.optical_indices || {},
        recipient_type: recipientType,
        custom_notes: customNotes.trim() || undefined,
      };

      const res = await fetch(`${API_BASE}/api/v1/water-quality/dispatch-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDispatchResult(data);
    } catch (err) {
      console.error('Alert dispatch failed:', err);
      setError('Emergency dispatch request failed. Please check network connection.');
    } finally {
      setDispatchLoading(false);
    }
  };

  const getSeverityBadgeClass = (sev) => {
    switch (sev) {
      case 'ALERT':
        return 'badge-alert';
      case 'ADVISORY':
        return 'badge-advisory';
      case 'WATCH':
        return 'badge-watch';
      default:
        return 'badge-normal';
    }
  };

  const cityKey = (waterData?.city || '').toLowerCase().includes('mumbai') ? 'mumbai' : 'delhi';
  const nearbyHospitals = facilities?.[cityKey]?.hospitals || [];
  const nearbyNgos = facilities?.[cityKey]?.ngos || [];

  return (
    <div className="water-quality-page">
      {/* 1. Header Bar */}
      <header className="wq-header">
        <div className="wq-title-group">
          <div className="wq-badge-row">
            <span className="wq-live-dot" />
            <span className="wq-chip">SENTINEL-2 L2A OPTICAL MULTISPECTRAL</span>
            <span className="wq-chip-outline">JALNETRA MICROSERVICE</span>
          </div>
          <h1 className="wq-title">JalNetra Optical Water Intelligence</h1>
          <p className="wq-subtitle">
            Satellite-Derived Surface Reflectance Indicators (MNDWI · NDTI · NDCI · FAI) & OpenAI Emergency Hospital/NGO Coordination
          </p>
        </div>

        {/* Preset Selector */}
        <div className="wq-controls-row">
          <div className="wq-preset-select-wrapper">
            <label htmlFor="wq-preset-select">Monitored Waterbody:</label>
            <select
              id="wq-preset-select"
              value={isCustomPoint ? 'custom' : selectedPreset}
              onChange={(e) => {
                if (e.target.value !== 'custom') {
                  handleSelectPreset(e.target.value);
                }
              }}
              className="wq-select"
            >
              {PRESET_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.city === 'Delhi' ? '🏛️' : '🌊'} {opt.name} ({opt.city})
                </option>
              ))}
              {isCustomPoint && <option value="custom">📍 {locationName}</option>}
            </select>
          </div>

          <button
            type="button"
            className="wq-refresh-btn"
            onClick={() => {
              if (isCustomPoint) {
                fetchAnalysis('custom', selectedCoords.lat, selectedCoords.lon, locationName);
              } else {
                fetchAnalysis(selectedPreset);
              }
            }}
            disabled={loading}
          >
            {loading ? 'Fetching Sentinel Pass...' : '🔄 Re-query Satellites'}
          </button>
        </div>
      </header>

      {error && <div className="wq-error-banner">{error}</div>}

      {/* 2. Top Metric Cards: Contamination Severity & 5 Optical Indicators */}
      <section className="wq-metrics-overview">
        {/* Anomaly & Risk Summary Card */}
        <div className={`wq-summary-card ${getSeverityBadgeClass(waterData?.anomaly_assessment?.severity)}`}>
          <div className="summary-card-header">
            <span className="summary-title">OPTICAL ANOMALY RISK</span>
            <span className={`severity-pill ${getSeverityBadgeClass(waterData?.anomaly_assessment?.severity)}`}>
              {waterData?.anomaly_assessment?.severity || 'NORMAL'}
            </span>
          </div>
          <div className="summary-score-row">
            <span className="score-num">{(waterData?.anomaly_assessment?.contamination_score || 0).toFixed(0)}</span>
            <span className="score-max">/ 100</span>
          </div>
          <div className="summary-meter-bar">
            <div
              className="meter-fill"
              style={{ width: `${Math.min(100, waterData?.anomaly_assessment?.contamination_score || 0)}%` }}
            />
          </div>
          <p className="summary-desc">{waterData?.anomaly_assessment?.summary_diagnosis || 'Analyzing baseline surface reflectance...'}</p>
          <div className="summary-action-box">
            <strong>Recommended Action:</strong> {waterData?.anomaly_assessment?.recommended_action || 'Routine monitoring.'}
          </div>
        </div>

        {/* 5 Core Optical Indices Grid */}
        <div className="wq-indices-grid">
          {/* 1. Water Extent (MNDWI) */}
          <div className="index-card">
            <div className="index-header">
              <span className="index-code">MNDWI</span>
              <span className={`index-status ${waterData?.optical_indices?.is_water_detected ? 'status-good' : 'status-bad'}`}>
                {waterData?.optical_indices?.is_water_detected ? 'Water Detected' : 'Dry / Land'}
              </span>
            </div>
            <div className="index-val">{(waterData?.optical_indices?.mndwi_extent ?? 0).toFixed(4)}</div>
            <div className="index-label">Modified Normalized Difference Water Index</div>
            <div className="index-formula">(Green - SWIR) / (Green + SWIR) &gt; 0.0</div>
          </div>

          {/* 2. Turbidity Index (NDTI) */}
          <div className="index-card">
            <div className="index-header">
              <span className="index-code">NDTI</span>
              <span className="index-status status-warn">{waterData?.anomaly_assessment?.turbidity_status || 'Assessing'}</span>
            </div>
            <div className="index-val">{(waterData?.optical_indices?.ndti_turbidity ?? 0).toFixed(4)}</div>
            <div className="index-label">Normalized Difference Turbidity Index</div>
            <div className="index-formula">(Red - Green) / (Red + Green)</div>
          </div>

          {/* 3. Chlorophyll-a / Algae (NDCI) */}
          <div className="index-card">
            <div className="index-header">
              <span className="index-code">NDCI</span>
              <span className="index-status status-alert">{waterData?.anomaly_assessment?.algal_bloom_risk || 'Assessing'}</span>
            </div>
            <div className="index-val">{(waterData?.optical_indices?.ndci_chlorophyll ?? 0).toFixed(4)}</div>
            <div className="index-label">Normalized Difference Chlorophyll Index</div>
            <div className="index-formula">(RedEdge - Red) / (RedEdge + Red)</div>
          </div>

          {/* 4. Floating Algae Index (FAI) */}
          <div className="index-card">
            <div className="index-header">
              <span className="index-code">FAI</span>
              <span className="index-status">Scum Index</span>
            </div>
            <div className="index-val">{(waterData?.optical_indices?.fai_floating_algae ?? 0).toFixed(4)}</div>
            <div className="index-label">Floating Algae Surface Scum Index</div>
            <div className="index-formula">NIR - [Red + (SWIR - Red) * 0.187]</div>
          </div>

          {/* 5. Suspended Sediment Proxy */}
          <div className="index-card">
            <div className="index-header">
              <span className="index-code">SEDIMENT</span>
              <span className="index-status status-warn">{waterData?.anomaly_assessment?.sediment_status || 'Assessing'}</span>
            </div>
            <div className="index-val">{(waterData?.optical_indices?.sediment_reflectance ?? 0).toFixed(4)}</div>
            <div className="index-label">Suspended Silt / Sediment Reflectance</div>
            <div className="index-formula">B04 Red Reflectance (over water)</div>
          </div>
        </div>
      </section>

      {/* 3. Main Center Split: Interactive Satellite GIS Map & Multispectral Bands */}
      <div className="wq-main-layout">
        {/* Left Column: Interactive Leaflet Map */}
        <section className="wq-map-section">
          <div className="wq-card-header">
            <div>
              <h3>Interactive Multispectral Water Observation Map</h3>
              <p>Click any waterbody or station to extract Bottom-Of-Atmosphere reflectance & indices</p>
            </div>
            <div className="coords-chip">
              📍 {selectedCoords.lat.toFixed(4)}° N, {selectedCoords.lon.toFixed(4)}° E
            </div>
          </div>

          <div className="wq-map-container" ref={mapContainerRef} />

          <div className="wq-map-footer">
            <span>Click anywhere on riverbanks or reservoirs to analyze custom GPS coordinates.</span>
            <span className="mission-tag">Satellite: {waterData?.satellite_mission || 'Sentinel-2 L2A'} · Cloud: {waterData?.cloud_cover_pct || 1.8}%</span>
          </div>
        </section>

        {/* Right Column: Sentinel-2 L2A Bands Decomposition */}
        <section className="wq-bands-section">
          <div className="wq-card-header">
            <div>
              <h3>Sentinel-2 L2A BOA Reflectance Bands</h3>
              <p>Calibrated Bottom-Of-Atmosphere spectral signatures (0.0 to 1.0)</p>
            </div>
          </div>

          <div className="bands-cards-list">
            <div className="band-row">
              <div className="band-meta">
                <span className="band-chip chip-blue">B02 Blue</span>
                <span className="band-nm">490 nm · 10m</span>
              </div>
              <div className="band-bar-track">
                <div className="band-bar-fill fill-blue" style={{ width: `${(waterData?.bands_reflectance?.b02_blue || 0) * 400}%` }} />
              </div>
              <span className="band-val">{(waterData?.bands_reflectance?.b02_blue ?? 0).toFixed(4)}</span>
            </div>

            <div className="band-row">
              <div className="band-meta">
                <span className="band-chip chip-green">B03 Green</span>
                <span className="band-nm">560 nm · 10m</span>
              </div>
              <div className="band-bar-track">
                <div className="band-bar-fill fill-green" style={{ width: `${(waterData?.bands_reflectance?.b03_green || 0) * 400}%` }} />
              </div>
              <span className="band-val">{(waterData?.bands_reflectance?.b03_green ?? 0).toFixed(4)}</span>
            </div>

            <div className="band-row">
              <div className="band-meta">
                <span className="band-chip chip-red">B04 Red</span>
                <span className="band-nm">665 nm · 10m</span>
              </div>
              <div className="band-bar-track">
                <div className="band-bar-fill fill-red" style={{ width: `${(waterData?.bands_reflectance?.b04_red || 0) * 400}%` }} />
              </div>
              <span className="band-val">{(waterData?.bands_reflectance?.b04_red ?? 0).toFixed(4)}</span>
            </div>

            <div className="band-row">
              <div className="band-meta">
                <span className="band-chip chip-rededge">B05 Red-Edge</span>
                <span className="band-nm">705 nm · 20m</span>
              </div>
              <div className="band-bar-track">
                <div className="band-bar-fill fill-rededge" style={{ width: `${(waterData?.bands_reflectance?.b05_rededge || 0) * 400}%` }} />
              </div>
              <span className="band-val">{(waterData?.bands_reflectance?.b05_rededge ?? 0).toFixed(4)}</span>
            </div>

            <div className="band-row">
              <div className="band-meta">
                <span className="band-chip chip-nir">B08 NIR</span>
                <span className="band-nm">842 nm · 10m</span>
              </div>
              <div className="band-bar-track">
                <div className="band-bar-fill fill-nir" style={{ width: `${(waterData?.bands_reflectance?.b08_nir || 0) * 400}%` }} />
              </div>
              <span className="band-val">{(waterData?.bands_reflectance?.b08_nir ?? 0).toFixed(4)}</span>
            </div>

            <div className="band-row">
              <div className="band-meta">
                <span className="band-chip chip-swir">B11 SWIR</span>
                <span className="band-nm">1610 nm · 20m</span>
              </div>
              <div className="band-bar-track">
                <div className="band-bar-fill fill-swir" style={{ width: `${(waterData?.bands_reflectance?.b11_swir || 0) * 400}%` }} />
              </div>
              <span className="band-val">{(waterData?.bands_reflectance?.b11_swir ?? 0).toFixed(4)}</span>
            </div>
          </div>

          <div className="disclaimer-mini">
            {waterData?.product_boundary_disclaimer}
          </div>
        </section>
      </div>

      {/* 4. OpenAI-Powered Emergency NGO & Hospital Dispatch Panel */}
      <section className="wq-dispatch-section">
        <div className="dispatch-header">
          <div className="dispatch-title-box">
            <span className="dispatch-badge">PUBLIC HEALTH RAPID RESPONSE GATEWAY</span>
            <h2>Emergency Hospital & NGO Coordination Hub</h2>
            <p>Connects satellite optical alerts to nearby medical centers and water NGOs using OpenAI Intelligence</p>
          </div>

          <div className="dispatch-recipients-selector">
            <label>Notify Recipients:</label>
            <div className="radio-pills">
              <button
                type="button"
                className={`pill-btn ${recipientType === 'hospitals' ? 'active' : ''}`}
                onClick={() => setRecipientType('hospitals')}
              >
                🏥 Emergency Hospitals ({nearbyHospitals.length})
              </button>
              <button
                type="button"
                className={`pill-btn ${recipientType === 'ngos' ? 'active' : ''}`}
                onClick={() => setRecipientType('ngos')}
              >
                🤝 Water Relief NGOs ({nearbyNgos.length})
              </button>
              <button
                type="button"
                className={`pill-btn ${recipientType === 'both' ? 'active' : ''}`}
                onClick={() => setRecipientType('both')}
              >
                🌐 Combined Multi-Agency
              </button>
            </div>
          </div>
        </div>

        {/* Target Facilities Previews */}
        <div className="facilities-preview-grid">
          {(recipientType === 'hospitals' || recipientType === 'both') && (
            <div className="facilities-column">
              <h4>🏥 Nearby Designated Emergency Hospitals ({waterData?.city || 'Region'})</h4>
              <div className="facility-cards-list">
                {nearbyHospitals.map((h) => (
                  <div key={h.id} className="facility-card">
                    <div className="fac-top">
                      <span className="fac-name">{h.name}</span>
                      <span className="fac-dist">{h.distance_km} km</span>
                    </div>
                    <div className="fac-sub">{h.specialty}</div>
                    <div className="fac-bottom">
                      <span className="fac-tag">{h.icu_readiness}</span>
                      <span className="fac-contact">📞 {h.contact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(recipientType === 'ngos' || recipientType === 'both') && (
            <div className="facilities-column">
              <h4>🤝 Verified Water Relief & Testing NGOs ({waterData?.city || 'Region'})</h4>
              <div className="facility-cards-list">
                {nearbyNgos.map((n) => (
                  <div key={n.id} className="facility-card">
                    <div className="fac-top">
                      <span className="fac-name">{n.name}</span>
                      <span className="fac-dist">{n.readiness}</span>
                    </div>
                    <div className="fac-sub">{n.focus}</div>
                    <div className="fac-bottom">
                      <span className="fac-tag">FIELD READY</span>
                      <span className="fac-contact">✉️ {n.contact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Dispatch Input & Button */}
        <div className="dispatch-action-row">
          <input
            type="text"
            className="dispatch-notes-input"
            placeholder="Optional operator notes (e.g. Sluice gate surge reported, rapid water discoloration)..."
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
          />
          <button
            type="button"
            className="btn-trigger-dispatch"
            onClick={handleDispatchAlert}
            disabled={dispatchLoading || !waterData}
          >
            {dispatchLoading ? 'Synthesizing with OpenAI...' : '⚡ Generate & Dispatch AI Emergency Protocol'}
          </button>
        </div>

        {/* Dispatch Result Presentation Dossier */}
        {dispatchResult && (
          <div className="dispatch-result-dossier">
            <div className="dossier-top">
              <div>
                <span className="dossier-docid">{dispatchResult.doc_id}</span>
                <h3>Official Water Contamination Emergency Advisory</h3>
                <span className="dossier-meta">
                  Location: {dispatchResult.location_name} ({dispatchResult.city}) · Status: {dispatchResult.status}
                </span>
              </div>
              <div className="dossier-badge-box">
                <span className="auth-chip">OFFICIALLY AUTHORIZED</span>
                <span className="ai-chip">{dispatchResult.ai_synthesized ? 'OpenAI GPT-4o Protocol' : 'Calibrated Safe Fallback'}</span>
              </div>
            </div>

            <div className="dossier-summary-box">
              <p>{dispatchResult.executive_advisory}</p>
            </div>

            <div className="dossier-split-lists">
              <div className="dossier-col">
                <h4>🏥 Hospital Clinical & Triage Precautions</h4>
                <ul>
                  {dispatchResult.clinical_precautions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="dossier-col">
                <h4>🤝 Immediate NGO & Field Containment Actions</h4>
                <ul>
                  {dispatchResult.immediate_field_actions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="dossier-recipients-sent">
              <strong>Active Dispatch Transmitted To:</strong>{' '}
              {dispatchResult.target_recipients.map((r, i) => (
                <span key={i} className="sent-pill">
                  {r.name} ({r.type === 'EMERGENCY_HOSPITAL' ? '🏥' : '🤝'})
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
