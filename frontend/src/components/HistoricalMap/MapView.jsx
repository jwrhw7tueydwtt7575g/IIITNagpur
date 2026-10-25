import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapView.css';
import HistoricalBanner from './HistoricalBanner.jsx';
import TimelineSlider from './TimelineSlider.jsx';
import EmergencyRouteCard from '../Common/EmergencyRouteCard.jsx';
import { useAuth } from '../../context/useAuth.js';

const DELHI_LOCATIONS = [
  { id: 'all', name: 'All Delhi Region', lat: 28.6500, lng: 77.2350, zoom: 12 },
  { id: 'kashmere_gate', name: 'Kashmere Gate ISBT', lat: 28.6675, lng: 77.2285, zoom: 14 },
  { id: 'monastery', name: 'Monastery Market Lowlands', lat: 28.6720, lng: 77.2310, zoom: 15 },
  { id: 'ito', name: 'ITO Drain #12 Regulator', lat: 28.6290, lng: 77.2450, zoom: 14 },
  { id: 'wazirabad', name: 'Wazirabad Water Treatment', lat: 28.7120, lng: 77.2320, zoom: 14 },
];

export default function MapView({ apiBaseUrl }) {
  const { fetchWithAuth } = useAuth();

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({
    flood: null,
    roads: null,
    infra: null,
    route: null,
  });

  const [metadata, setMetadata] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [selectedDate, setSelectedDate] = useState('2023-07-13');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // Layer Visibility Toggles
  const [visibleLayers, setVisibleLayers] = useState({
    flood: true,
    roads: true,
    hospitals: true,
    fireStations: true,
    drainage: true,
    waterPlants: true,
    route: true,
  });

  const [selectedLocation, setSelectedLocation] = useState('all');
  const routeSource = 'hosp_sushruta';
  const routeTarget = 'fire_dfs_hq';
  const [routeData, setRouteData] = useState(null);
  const [stats, setStats] = useState({
    totalNodes: 16,
    floodedNodes: 4,
    affectedRoads: 6,
    highestRisk: 'Drain #12 Sluice Breach',
  });

  // Fetch initial metadata and timeline
  useEffect(() => {
    async function loadMeta() {
      try {
        const [metaRes, timeRes] = await Promise.all([
          fetchWithAuth(`${apiBaseUrl}/api/historical/delhi/metadata`),
          fetchWithAuth(`${apiBaseUrl}/api/historical/delhi/timeline`),
        ]);

        if (!metaRes.ok || !timeRes.ok) {
          throw new Error('Failed to load historical Delhi metadata.');
        }

        const metaJson = await metaRes.json();
        const timeJson = await timeRes.json();

        setMetadata(metaJson);
        setTimeline(timeJson.timeline || []);
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    }
    loadMeta();
  }, [apiBaseUrl, fetchWithAuth]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [28.6500, 77.2350],
      zoom: 12,
      minZoom: 10,
      maxZoom: 17,
      zoomControl: false, // We render custom zoom controls
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map);

    layersRef.current.flood = L.layerGroup().addTo(map);
    layersRef.current.roads = L.layerGroup().addTo(map);
    layersRef.current.infra = L.layerGroup().addTo(map);
    layersRef.current.route = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle location pan
  const handleLocationChange = (locId) => {
    setSelectedLocation(locId);
    const loc = DELHI_LOCATIONS.find((l) => l.id === locId);
    if (loc && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([loc.lat, loc.lng], loc.zoom, {
        duration: 1.2,
      });
    }
  };

  // Toggle individual layers
  const toggleLayer = (layerKey) => {
    setVisibleLayers((prev) => ({
      ...prev,
      [layerKey]: !prev[layerKey],
    }));
  };

  // Automated Timeline Playback
  useEffect(() => {
    if (!isPlaying || timeline.length === 0) return;

    const interval = setInterval(() => {
      setSelectedDate((currentDate) => {
        const dates = timeline.map((t) => t.date);
        const currentIndex = dates.indexOf(currentDate);
        const nextIndex = (currentIndex + 1) % dates.length;
        return dates[nextIndex];
      });
    }, 2400);

    return () => clearInterval(interval);
  }, [isPlaying, timeline]);

  // Load geo layers when date or facilities change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    async function loadDateLayers() {
      setLoading(true);
      try {
        const [floodRes, roadsRes, infraRes, routeRes] = await Promise.all([
          fetchWithAuth(`${apiBaseUrl}/api/historical/delhi/flood-layer?date=${selectedDate}`),
          fetchWithAuth(`${apiBaseUrl}/api/historical/delhi/roads?date=${selectedDate}`),
          fetchWithAuth(`${apiBaseUrl}/api/historical/delhi/infrastructure?date=${selectedDate}`),
          fetchWithAuth(
            `${apiBaseUrl}/api/historical/delhi/safe-route?source=${routeSource}&target=${routeTarget}&date=${selectedDate}`
          ),
        ]);

        const [floodJson, roadsJson, infraJson, routeJson] = await Promise.all([
          floodRes.json(),
          roadsRes.json(),
          infraRes.json(),
          routeRes.json(),
        ]);

        setRouteData(routeJson);

        // Update Key Statistics
        const floodedRoadsCount = (roadsJson.features || []).filter(
          (r) => r.properties?.current_status === 'submerged'
        ).length;
        const failedInfraCount = (infraJson.features || []).filter(
          (i) => i.properties?.status === 'failed' || i.properties?.status === 'inundated'
        ).length;

        setStats({
          totalNodes: (infraJson.features || []).length + (roadsJson.features || []).length,
          floodedNodes: failedInfraCount,
          affectedRoads: floodedRoadsCount,
          highestRisk: selectedDate >= '2023-07-13' ? 'ITO Drain #12 Sluice Breach' : 'Monastery Market Lowlands',
        });

        // Clear existing layers
        layersRef.current.flood.clearLayers();
        layersRef.current.roads.clearLayers();
        layersRef.current.infra.clearLayers();
        layersRef.current.route.clearLayers();

        // 1. Render Flood Polygons
        if (visibleLayers.flood) {
          L.geoJSON(floodJson, {
            style: {
              color: '#38bdf8',
              fillColor: '#0284c7',
              fillOpacity: 0.55,
              weight: 2,
              dashArray: '3',
            },
            onEachFeature: (feature, layer) => {
              const p = feature.properties || {};
              layer.bindPopup(`
                <div class="custom-popup-box">
                  <h4>🌊 ${p.name || 'Flooded Zone'}</h4>
                  <p><strong>Date:</strong> ${p.date || selectedDate}</p>
                  <p><strong>Gauge Level:</strong> ${p.water_level_m || '208.66'}m</p>
                  <p><strong>Status:</strong> <span class="popup-tag" style="background:#7f1d1d;color:#fecaca">${p.severity || 'Critical'}</span></p>
                  <p>${p.description || ''}</p>
                </div>
              `);
            },
          }).addTo(layersRef.current.flood);
        }

        // 2. Render Arterial Roads
        if (visibleLayers.roads) {
          L.geoJSON(roadsJson, {
            style: (feature) => {
              const isSubmerged = feature?.properties?.current_status === 'submerged';
              return {
                color: isSubmerged ? '#ef4444' : '#64748b',
                weight: isSubmerged ? 4 : 2,
                dashArray: isSubmerged ? '6, 8' : undefined,
                opacity: isSubmerged ? 0.9 : 0.6,
              };
            },
            onEachFeature: (feature, layer) => {
              const p = feature.properties || {};
              const isSubmerged = p.current_status === 'submerged';
              layer.bindPopup(`
                <div class="custom-popup-box">
                  <h4>🛣️ ${p.name}</h4>
                  <p><strong>Status:</strong> ${
                    isSubmerged
                      ? '<span class="popup-tag" style="background:#7f1d1d;color:#fecaca">Submerged / Closed</span>'
                      : '<span class="popup-tag" style="background:#064e3b;color:#a7f3d0">Passable</span>'
                  }</p>
                  <p><strong>Length:</strong> ${p.distance_km} km</p>
                </div>
              `);
            },
          }).addTo(layersRef.current.roads);
        }

        // 3. Render Safe Emergency Detour Route
        if (visibleLayers.route && routeJson.success && routeJson.geojson) {
          L.geoJSON(routeJson.geojson, {
            style: {
              color: '#22c55e',
              weight: 5,
              opacity: 0.95,
            },
            onEachFeature: (feature, layer) => {
              layer.bindPopup(`
                <div class="custom-popup-box">
                  <h4>🚑 Safe Emergency Detour Corridor</h4>
                  <p><strong>Detour Distance:</strong> ${routeJson.distance_km} km</p>
                  <p>${routeJson.narrative}</p>
                </div>
              `);
            },
          }).addTo(layersRef.current.route);
        }

        // 4. Render Critical Infrastructure Markers
        (infraJson.features || []).forEach((feat) => {
          const [lng, lat] = feat.geometry.coordinates;
          const p = feat.properties;

          // Check visibility by type
          if (p.type === 'hospital' && !visibleLayers.hospitals) return;
          if (p.type === 'fire_station' && !visibleLayers.fireStations) return;
          if (p.type === 'drainage_regulator' && !visibleLayers.drainage) return;
          if (p.type === 'water_treatment_plant' && !visibleLayers.waterPlants) return;

          let iconEmoji = '📍';
          let iconClass = 'marker-hospital';

          if (p.type === 'hospital') {
            iconEmoji = '🏥';
            iconClass = 'marker-hospital';
          } else if (p.type === 'fire_station') {
            iconEmoji = '🚒';
            iconClass = 'marker-fire_station';
          } else if (p.type === 'water_treatment_plant') {
            iconEmoji = '💧';
            iconClass = 'marker-water_treatment_plant';
          } else if (p.type === 'drainage_regulator') {
            iconEmoji = '⚠️';
            iconClass = 'marker-drainage_regulator';
          }

          const customIcon = L.divIcon({
            className: 'map-custom-div-icon',
            html: `<div class="custom-map-marker ${iconClass}">${iconEmoji}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -18],
          });

          const marker = L.marker([lat, lng], { icon: customIcon });

          marker.bindPopup(`
            <div class="custom-popup-box">
              <h4>${iconEmoji} ${p.name}</h4>
              <p><strong>Category:</strong> ${p.type?.replace('_', ' ').toUpperCase()}</p>
              <p><strong>Status:</strong> ${p.status}</p>
              <p>${p.description || ''}</p>
            </div>
          `);

          marker.addTo(layersRef.current.infra);
        });
      } catch (err) {
        console.error('Failed to update map layers:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDateLayers();
  }, [selectedDate, routeSource, routeTarget, visibleLayers, apiBaseUrl, fetchWithAuth]);

  return (
    <div className="historical-dashboard-container">
      {/* Prominent Mandatory Historical Disclaimer Banner */}
      <HistoricalBanner metadata={metadata} />

      {/* 3-Panel Main Workspace matching Reference Image 2 */}
      <div className="historical-workspace-grid">
        {/* Left Panel: Location Selector & Layer Controls */}
        <aside className="hist-sidebar-left">
          {/* Location Selector */}
          <div className="hist-panel-card">
            <h3 className="hist-panel-title">Location Focus</h3>
            <p className="hist-panel-sub">Pan view to vulnerable Yamuna basin sectors</p>
            <div className="location-btn-grid">
              {DELHI_LOCATIONS.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  className={`loc-select-btn ${selectedLocation === loc.id ? 'active' : ''}`}
                  onClick={() => handleLocationChange(loc.id)}
                >
                  <span>{loc.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Layer Controls */}
          <div className="hist-panel-card">
            <h3 className="hist-panel-title">Infrastructure Layers</h3>
            <p className="hist-panel-sub">Toggle visualization overlay elements</p>

            <div className="layer-toggles-list">
              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={visibleLayers.roads}
                  onChange={() => toggleLayer('roads')}
                />
                <span className="layer-color-chip road-chip"></span>
                <span>Road Network & Detours</span>
              </label>

              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={visibleLayers.flood}
                  onChange={() => toggleLayer('flood')}
                />
                <span className="layer-color-chip flood-chip"></span>
                <span>Historical Flood Extents</span>
              </label>

              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={visibleLayers.hospitals}
                  onChange={() => toggleLayer('hospitals')}
                />
                <span className="layer-emoji">🏥</span>
                <span>Apex Trauma Centers</span>
              </label>

              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={visibleLayers.fireStations}
                  onChange={() => toggleLayer('fireStations')}
                />
                <span className="layer-emoji">🚒</span>
                <span>Fire & Rescue Stations</span>
              </label>

              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={visibleLayers.drainage}
                  onChange={() => toggleLayer('drainage')}
                />
                <span className="layer-emoji">⚠️</span>
                <span>Drainage Sluice Gates</span>
              </label>

              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={visibleLayers.waterPlants}
                  onChange={() => toggleLayer('waterPlants')}
                />
                <span className="layer-emoji">💧</span>
                <span>Water Treatment Plants</span>
              </label>

              <label className="layer-toggle-item">
                <input
                  type="checkbox"
                  checked={visibleLayers.route}
                  onChange={() => toggleLayer('route')}
                />
                <span className="layer-color-chip route-chip"></span>
                <span>Emergency Safe Detour</span>
              </label>
            </div>
          </div>

          {/* Replay Controls & Timeline Play/Pause */}
          <div className="hist-panel-card">
            <div className="replay-header">
              <div>
                <h3 className="hist-panel-title">Historical Replay</h3>
                <p className="hist-panel-sub">Chronological flood progression (July 2023)</p>
              </div>
              <button
                type="button"
                className={`play-timeline-btn ${isPlaying ? 'playing' : ''}`}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play Timeline'}
              </button>
            </div>

            <TimelineSlider
              timeline={timeline}
              selectedDate={selectedDate}
              onDateChange={(d) => {
                setSelectedDate(d);
                setIsPlaying(false);
              }}
            />
          </div>
        </aside>

        {/* Center Panel: Map & Legend */}
        <section className="hist-map-center-panel" aria-label="Historical Delhi Map">
          {/* Map Header with Quick Controls */}
          <div className="map-toolbar">
            <div className="map-title-row">
              <span className="map-badge">HISTORICAL FLOOD REPLAY</span>
              <span className="date-indicator">Active Date: <strong>{selectedDate}</strong></span>
              {loading && <span style={{ fontSize: '11px', color: '#38bdf8' }}>(Updating layers...)</span>}
              {error && <span style={{ fontSize: '11px', color: '#f87171' }}>⚠️ {error}</span>}
            </div>
            <div className="map-quick-actions">
              <button
                type="button"
                className="zoom-btn"
                onClick={() => mapInstanceRef.current?.zoomIn()}
                title="Zoom In"
              >
                +
              </button>
              <button
                type="button"
                className="zoom-btn"
                onClick={() => mapInstanceRef.current?.zoomOut()}
                title="Zoom Out"
              >
                −
              </button>
              <button
                type="button"
                className="zoom-btn"
                onClick={() => handleLocationChange('all')}
                title="Reset Center"
              >
                ⟲
              </button>
            </div>
          </div>

          <div className="map-wrapper">
            <div ref={mapContainerRef} className="leaflet-map-canvas" />

            {/* Floating Map Legend */}
            <div className="map-floating-legend">
              <span className="legend-heading">MAP LEGEND</span>
              <div className="legend-row">
                <span className="legend-indicator ind-flood"></span>
                <span>Inundated Flood Extent</span>
              </div>
              <div className="legend-row">
                <span className="legend-indicator ind-road-sub"></span>
                <span>Submerged Road (Closed)</span>
              </div>
              <div className="legend-row">
                <span className="legend-indicator ind-road-ok"></span>
                <span>Passable Corridor</span>
              </div>
              <div className="legend-row">
                <span className="legend-indicator ind-route"></span>
                <span>Safe Detour Corridor</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Panel: Event Information, Key Stats, Emergency Route & Timeline */}
        <aside className="hist-sidebar-right">
          {/* Key Statistics Cards */}
          <div className="hist-stats-grid">
            <div className="hist-stat-box">
              <span className="stat-label">Total Assets</span>
              <strong className="stat-num">{stats.totalNodes}</strong>
              <span className="stat-desc">Facilities & Corridors</span>
            </div>
            <div className="hist-stat-box stat-failed">
              <span className="stat-label">Flooded Assets</span>
              <strong className="stat-num">{stats.floodedNodes}</strong>
              <span className="stat-desc">Inundated facilities</span>
            </div>
            <div className="hist-stat-box stat-threatened">
              <span className="stat-label">Submerged Roads</span>
              <strong className="stat-num">{stats.affectedRoads}</strong>
              <span className="stat-desc">Traffic severed</span>
            </div>
            <div className="hist-stat-box stat-risk">
              <span className="stat-label">Highest Risk</span>
              <strong className="stat-num stat-risk-text" title={stats.highestRisk}>
                {stats.highestRisk}
              </strong>
              <span className="stat-desc">Breach location</span>
            </div>
          </div>

          {/* Reusable Emergency Safe Route Card */}
          <EmergencyRouteCard
            title="Safe Emergency Corridor"
            subtitle={`Bypasses submerged Ring Road & ITO via Ridge (${selectedDate})`}
            origin={{ name: 'Sushruta Trauma Center', id: routeSource }}
            destination={{ name: 'Delhi Fire Service HQ', id: routeTarget }}
            distance={routeData?.distance_km || 6.8}
            estimatedTime="18 mins (Model Detour)"
            status={routeData?.success ? 'Passable' : 'Blocked'}
            routeStatusBadge={routeData?.success ? 'ACTIVE DETOUR' : 'BLOCKED'}
            waypoints={routeData?.segments || ['Ridge Road', 'Rani Jhansi Corridor', 'Connaught Place Outer']}
            avoidedAssets={[
              'Ring Road Kashmere Gate (Submerged)',
              'ITO Intersection & Drain #12 (Breached)',
              'Yamuna Bazar Lowlands (Flooded)',
            ]}
            safetyExplanation={routeData?.narrative || 'Route bypasses submerged lowlands by traversing elevated ridgeline.'}
            isModelGenerated={true}
          />

          {/* Chronological Event Briefing */}
          <div className="hist-panel-card">
            <h3 className="hist-panel-title">Event Information & Chronology</h3>
            <div className="event-metadata-list">
              <div className="event-meta-row">
                <span>Peak Water Elevation:</span>
                <strong>208.66m (3.33m above danger mark)</strong>
              </div>
              <div className="event-meta-row">
                <span>Historic 1978 Record:</span>
                <strong>207.49m (Surpassed on July 12)</strong>
              </div>
              <div className="event-meta-row">
                <span>Data Provenance:</span>
                <strong>Central Water Commission / DDMA Historical Archive</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
