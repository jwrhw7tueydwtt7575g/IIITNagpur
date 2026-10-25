import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './DelhiMap.css';
import RoutePlanner from './RoutePlanner.jsx';

// Fix default Leaflet icon issues in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Tile Layer Configurations (CARTO Voyager for clean, Google Maps-style geography)
const TILE_LAYERS = {
  streets: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
  },
  positron: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
  },
  satellite: {
    url: import.meta.env.VITE_MAPBOX_TOKEN
      ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: import.meta.env.VITE_MAPBOX_TOKEN ? '&copy; Mapbox &copy; Maxar' : '&copy; Esri, Maxar',
    maxZoom: 19,
    tileSize: import.meta.env.VITE_MAPBOX_TOKEN ? 512 : 256,
    zoomOffset: import.meta.env.VITE_MAPBOX_TOKEN ? -1 : 0,
  },
  mapbox: {
    url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${import.meta.env.VITE_MAPBOX_TOKEN || ''}`,
    attribution: '&copy; Mapbox &copy; OpenStreetMap',
    maxZoom: 19,
    tileSize: 512,
    zoomOffset: -1,
  },
};

// Delhi Geographic Default Center (Balanced view across Delhi & NCR)
const DELHI_CENTER = [28.6180, 77.2000];
const DEFAULT_ZOOM = 12;

// In-memory cache for fetched OSRM real road geometries
const osrmGeometryCache = new Map();

// Helper to fetch realistic road-following geometry from OSRM
async function fetchOsrmRoadGeometry(coordinates) {
  if (!coordinates || coordinates.length < 2) return null;
  const cacheKey = coordinates.map((c) => `${c[0].toFixed(4)},${c[1].toFixed(4)}`).join(';');
  if (osrmGeometryCache.has(cacheKey)) {
    return osrmGeometryCache.get(cacheKey);
  }

  try {
    let waypoints = coordinates;
    if (coordinates.length > 8) {
      waypoints = [
        coordinates[0],
        ...coordinates.slice(1, -1).filter((_, idx) => idx % Math.ceil(coordinates.length / 5) === 0),
        coordinates[coordinates.length - 1],
      ];
    }

    const coordStr = waypoints.map((c) => `${c[1]},${c[0]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&alternatives=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2800);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const data = await response.json();
    if (!data.routes || !data.routes.length) return null;

    const primaryCoords = data.routes[0].geometry.coordinates.map((pt) => [pt[1], pt[0]]);
    const altCoords = data.routes.slice(1).map((r) => r.geometry.coordinates.map((pt) => [pt[1], pt[0]]));

    const result = { primary: primaryCoords, alternatives: altCoords };
    osrmGeometryCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// Yamuna River Geographic Spine Coordinates
const YAMUNA_RIVER_LINE = [
  [28.745, 77.220],
  [28.720, 77.232],
  [28.700, 77.234],
  [28.675, 77.236],
  [28.660, 77.244],
  [28.640, 77.249],
  [28.625, 77.250],
  [28.605, 77.256],
  [28.575, 77.265],
  [28.550, 77.278],
  [28.530, 77.295],
  [28.510, 77.315],
];

// Primary Yamuna River Floodplain Polygon
const YAMUNA_PRIMARY_FLOOD_POLYGON = [
  [28.725, 77.228],
  [28.712, 77.238],
  [28.698, 77.235],
  [28.682, 77.234],
  [28.668, 77.238],
  [28.656, 77.246],
  [28.641, 77.248],
  [28.628, 77.252],
  [28.615, 77.253],
  [28.585, 77.262],
  [28.555, 77.275],
  [28.535, 77.288],
  [28.530, 77.305],
  [28.560, 77.295],
  [28.590, 77.280],
  [28.618, 77.275],
  [28.635, 77.268],
  [28.665, 77.258],
  [28.695, 77.252],
  [28.720, 77.245],
];

// Secondary Inundation Catchment #1: Kashmere Gate & Monastery Market
const KASHMERE_GATE_FLOOD_POLYGON = [
  [28.678, 77.222],
  [28.679, 77.242],
  [28.658, 77.246],
  [28.650, 77.238],
  [28.654, 77.224],
];

// Secondary Inundation Catchment #2: Ring Road Underpass #43 & Barapullah Basin
const RING_ROAD_UNDERPASS_FLOOD_POLYGON = [
  [28.590, 77.238],
  [28.586, 77.260],
  [28.562, 77.264],
  [28.558, 77.242],
  [28.572, 77.236],
];

// Secondary Inundation Catchment #3: Mayur Vihar Trans-Yamuna Retention Basin
const MAYUR_VIHAR_FLOOD_POLYGON = [
  [28.615, 77.282],
  [28.620, 77.310],
  [28.592, 77.312],
  [28.590, 77.285],
];

// Flood hazard warning triangle locations (matching reference screenshot)
const FLOOD_HAZARD_LOCATIONS = [
  { name: 'Kashmere Gate Bottleneck', coords: [28.672, 77.236] },
  { name: 'Yamuna Riverbed Surcharge', coords: [28.648, 77.252] },
  { name: 'ITO Lowlands', coords: [28.622, 77.258] },
  { name: 'Ring Road Underpass #43', coords: [28.574, 77.248] },
];

// Depth badges directly rendered on flood polygons
const FLOOD_DEPTH_MARKERS = [
  { name: 'Yamuna Riverbed Floodplain', depth: '1.4 m', coords: [28.648, 77.258] },
  { name: 'Kashmere Gate Lowland Catchment', depth: '1.2 m', coords: [28.665, 77.234] },
  { name: 'Ring Road Underpass #43', depth: '0.8 m', coords: [28.575, 77.248] },
  { name: 'Mayur Vihar Spillway Catchment', depth: '0.6 m', coords: [28.605, 77.295] },
];

// Major Delhi Geographic Hub Labels
const DELHI_GEO_LABELS = [
  { name: 'NEW DELHI', coords: [28.6139, 77.2090] },
  { name: 'OLD DELHI', coords: [28.6562, 77.2320] },
  { name: 'CONNAUGHT PLACE', coords: [28.6328, 77.2197] },
  { name: 'YAMUNA RIVER BASIN', coords: [28.6600, 77.2450] },
  { name: 'NOIDA CORRIDOR', coords: [28.5700, 77.3200] },
  { name: 'GURUGRAM CORRIDOR', coords: [28.4900, 77.0800] },
];

// Real-Time Traffic Corridors (rendered when Live Traffic switch is active)
const DELHI_TRAFFIC_CORRIDORS = [
  {
    name: 'Barapullah & Ring Road Underpass #43',
    coords: [
      [28.590, 77.240],
      [28.580, 77.250],
      [28.570, 77.255],
    ],
    status: 'heavy',
    color: '#ef4444',
  },
  {
    name: 'Kashmere Gate ISBT Ring Road',
    coords: [
      [28.675, 77.228],
      [28.665, 77.235],
      [28.655, 77.240],
    ],
    status: 'slow',
    color: '#f97316',
  },
  {
    name: 'Central Diplomatic Arterial',
    coords: [
      [28.605, 77.195],
      [28.595, 77.190],
      [28.585, 77.185],
    ],
    status: 'fast',
    color: '#22c55e',
  },
  {
    name: 'Airport Express Priority Link',
    coords: [
      [28.585, 77.160],
      [28.565, 77.120],
      [28.555, 77.085],
    ],
    status: 'fast',
    color: '#22c55e',
  },
  {
    name: 'Connaught Place Ring',
    coords: [
      [28.632, 77.215],
      [28.635, 77.222],
      [28.630, 77.225],
    ],
    status: 'moderate',
    color: '#eab308',
  },
];

export default function DelhiMap({
  nodes = [],
  selectedNode = null,
  onSelectNode = () => {},
  mapStyle = 'streets',
  onSetMapStyle = () => {},
  layerFilters = {
    road: true,
    hospital: true,
    fire_station: true,
    drainage: true,
    transformer: true,
    metro: true,
    flood_zones: true,
  },
  setLayerFilters = () => {},
  activeRoute = null,
  centerViewType = 'map',
  onToggleView = () => {},
  // Routing interaction props
  routingMode = false,
  routingStep = 'idle',
  routeOrigin = null,
  routeDestination = null,
  onSetOrigin = () => {},
  onSetDestination = () => {},
  onCalculateRoute = () => {},
  onClearRoute = () => {},
  onToggleRoutingMode = () => {},
  onViewRouteOnMap = () => {},
  routingLoading = false,
  simulation = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const riverLayerRef = useRef(null);
  const floodZonesLayerRef = useRef(null);
  const trafficLayerRef = useRef(null);
  const routeAltLayerRef = useRef(null);
  const routeGlowLayerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const routeMarkersRef = useRef(null);
  const markersLayerRef = useRef(null);
  const geoLabelsLayerRef = useRef(null);
  const mapStyleRef = useRef(mapStyle);
  useEffect(() => {
    mapStyleRef.current = mapStyle;
  }, [mapStyle]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);

  // Top Popovers & Controls
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showLayersDropdown, setShowLayersDropdown] = useState(false);
  const [liveTrafficEnabled, setLiveTrafficEnabled] = useState(false);
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [selectedRouteOption, setSelectedRouteOption] = useState(1);

  // Filter States
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const [routingAlert, setRoutingAlert] = useState(null);

  const isSimulated = Boolean(simulation);

  // Expose global handlers for Leaflet popups
  useEffect(() => {
    window.citygraph_inspect = (nodeId) => {
      const n = nodes.find((item) => item.id === nodeId);
      if (n) onSelectNode(n);
    };

    window.citygraph_routeFrom = (nodeId) => {
      const n = nodes.find((item) => item.id === nodeId);
      if (!n) return;
      if (n.status === 'failed') {
        setRoutingAlert(`⚠️ Cannot stage dispatch at flooded asset: ${n.name || n.id}. Select an operational asset.`);
        setTimeout(() => setRoutingAlert(null), 5000);
        return;
      }
      onSetOrigin(n);
      if (routeDestination && routeDestination.id !== n.id) {
        onCalculateRoute(n.id, routeDestination.id);
      }
    };

    window.citygraph_routeTo = (nodeId) => {
      const n = nodes.find((item) => item.id === nodeId);
      if (!n) return;
      if (n.status === 'failed') {
        setRoutingAlert(`⚠️ Destination is submerged/flooded: ${n.name || n.id}. Select an accessible staging point.`);
        setTimeout(() => setRoutingAlert(null), 5000);
        return;
      }
      onSetDestination(n);
      if (routeOrigin && routeOrigin.id !== n.id) {
        onCalculateRoute(routeOrigin.id, n.id);
      }
    };

    return () => {
      delete window.citygraph_inspect;
      delete window.citygraph_routeFrom;
      delete window.citygraph_routeTo;
    };
  }, [nodes, routeOrigin, routeDestination, onSelectNode, onSetOrigin, onSetDestination, onCalculateRoute]);

  // Filter nodes by Layer checkboxes AND top Filter dropdowns with Zoom-aware decluttering
  const visibleNodes = useMemo(() => {
    return nodes.filter((node) => {
      const type = node.type || 'road';
      const name = (node.name || '').toLowerCase();
      const isMetro = type === 'metro' || name.includes('metro') || name.includes('interchange');

      // 1. Layer toggles
      if (isMetro && !layerFilters.metro) return false;
      if (!isMetro && type === 'hospital' && !layerFilters.hospital) return false;
      if (!isMetro && type === 'fire_station' && !layerFilters.fire_station) return false;
      if (!isMetro && (type === 'drainage' || name.includes('pump') || name.includes('drain') || name.includes('sluice')) && !layerFilters.drainage) return false;
      if (!isMetro && (type === 'transformer' || name.includes('power') || name.includes('substation')) && !layerFilters.transformer) return false;
      if (!isMetro && type === 'road' && !layerFilters.road) return false;

      // 2. Type Filter dropdown
      if (typeFilter !== 'all') {
        if (typeFilter === 'metro' && !isMetro) return false;
        if (typeFilter !== 'metro' && (isMetro || node.type !== typeFilter)) return false;
      }

      // 3. Status Filter dropdown
      if (statusFilter !== 'all') {
        const s = node.status || 'safe';
        if (statusFilter === 'operational' && s !== 'safe') return false;
        if (statusFilter === 'at_risk' && (s !== 'safe' || (Number(node.risk) || 0) < 0.7)) return false;
        if (statusFilter === 'affected' && s !== 'affected') return false;
        if (statusFilter === 'failed' && s !== 'failed') return false;
      }

      // 4. Risk Filter dropdown
      if (riskFilter !== 'all') {
        const r = Number(node.risk) || 0;
        if (riskFilter === 'high' && r <= 0.8) return false;
        if (riskFilter === 'medium' && (r < 0.5 || r > 0.8)) return false;
        if (riskFilter === 'low' && r >= 0.5) return false;
      }

      // 5. Intelligent decluttering at normal zoom (<= 12):
      // Keep all critical facilities (Hospitals, Fire, Metro, Drainage, Power, Failed/Affected, Selected/Origin/Dest).
      // Filter ordinary road junctions to avoid cluttering the basemap.
      if (currentZoom <= 12 && !isMetro && type === 'road') {
        const isFocus = node.id === selectedNode?.id || node.id === routeOrigin?.id || node.id === routeDestination?.id;
        const isHazard = node.status === 'failed' || node.status === 'affected';
        if (!isFocus && !isHazard && (node.criticality || 0) < 8) {
          return false;
        }
      }

      return true;
    });
  }, [nodes, layerFilters, typeFilter, statusFilter, riskFilter, currentZoom, selectedNode, routeOrigin, routeDestination]);

  // Initialize Leaflet Map with STRICT Leaflet Panes for Layer Order:
  // 1. basemap (tilePane, z=200)
  // 2. water/flood polygons (floodPane, z=350)
  // 3. traffic (trafficPane, z=380)
  // 4. route alternatives (routeAltPane, z=400)
  // 5. route primary (routePrimaryPane, z=420)
  // 6. infrastructure markers (infraMarkerPane, z=500)
  // 7. A/B pins & name labels (navPinPane, z=600)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DELHI_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
    });

    // Track map zoom for responsive marker decluttering
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    // Create custom panes for strict layer hierarchy
    const floodPane = map.createPane('floodPane');
    floodPane.style.zIndex = '350';

    const trafficPane = map.createPane('trafficPane');
    trafficPane.style.zIndex = '380';

    const routeAltPane = map.createPane('routeAltPane');
    routeAltPane.style.zIndex = '400';

    const routePrimaryPane = map.createPane('routePrimaryPane');
    routePrimaryPane.style.zIndex = '420';

    const infraMarkerPane = map.createPane('infraMarkerPane');
    infraMarkerPane.style.zIndex = '500';

    const navPinPane = map.createPane('navPinPane');
    navPinPane.style.zIndex = '600';

    const initialTileConf = TILE_LAYERS[mapStyleRef.current] || TILE_LAYERS.streets;
    const tileLayer = L.tileLayer(initialTileConf.url, {
      subdomains: initialTileConf.subdomains || 'abc',
      attribution: initialTileConf.attribution,
      maxZoom: initialTileConf.maxZoom,
    }).addTo(map);
    tileLayerRef.current = tileLayer;
    L.control.scale({position:'bottomright',metric:true,imperial:false}).addTo(map);

    // Layer groups added to map
    riverLayerRef.current = L.layerGroup().addTo(map);
    floodZonesLayerRef.current = L.layerGroup().addTo(map);
    trafficLayerRef.current = L.layerGroup().addTo(map);
    geoLabelsLayerRef.current = L.layerGroup().addTo(map);
    routeAltLayerRef.current = L.layerGroup().addTo(map);
    routeGlowLayerRef.current = L.layerGroup().addTo(map);
    routeMarkersRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // Run once
  useEffect(() => {const el=mapContainerRef.current?.parentElement;if(!el || typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(()=>mapInstanceRef.current?.invalidateSize({pan:false}));observer.observe(el);return()=>observer.disconnect();},[]);

  // Update Tile Layer when mapStyle changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const tileConf = TILE_LAYERS[mapStyle] || TILE_LAYERS.streets;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const newTileLayer = L.tileLayer(tileConf.url, {
      subdomains: tileConf.subdomains || 'abc',
      attribution: tileConf.attribution,
      maxZoom: tileConf.maxZoom,
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
    newTileLayer.bringToBack();
  }, [mapStyle]);

  // Render Yamuna River Line & Delhi NCR Landmark Badges
  useEffect(() => {
    if (!mapInstanceRef.current || !riverLayerRef.current || !geoLabelsLayerRef.current) return;

    riverLayerRef.current.clearLayers();
    geoLabelsLayerRef.current.clearLayers();

    // Yamuna River Water Ribbon
    const riverCasing = L.polyline(YAMUNA_RIVER_LINE, {
      color: '#0284c7',
      weight: 8,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round',
      pane: 'floodPane',
    });
    riverLayerRef.current.addLayer(riverCasing);

    const riverCore = L.polyline(YAMUNA_RIVER_LINE, {
      color: '#38bdf8',
      weight: 3.5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
      pane: 'floodPane',
    });
    riverLayerRef.current.addLayer(riverCore);

    // Delhi NCR Hub Labels
    DELHI_GEO_LABELS.forEach((hub) => {
      const labelIcon = L.divIcon({
        className: 'delhi-geo-hub-label',
        html: `<span>${hub.name}</span>`,
        iconSize: [120, 20],
        iconAnchor: [60, 10],
      });
      const marker = L.marker(hub.coords, { icon: labelIcon, interactive: false, pane: 'infraMarkerPane' });
      geoLabelsLayerRef.current.addLayer(marker);
    });
  }, []);

  // Render Dedicated Flood Risk Zones, Hazard Triangles & Depth Badges (in floodPane)
  useEffect(() => {
    if (!mapInstanceRef.current || !floodZonesLayerRef.current) return;

    floodZonesLayerRef.current.clearLayers();

    if (layerFilters.flood_zones === false) return;

    const primaryFillOpacity = isSimulated ? 0.38 : 0.16;
    const secondaryFillOpacity = isSimulated ? 0.30 : 0.12;
    const primaryColor = isSimulated ? '#0284c7' : '#0369a1';
    const secondaryColor = isSimulated ? '#00f0ff' : '#0284c7';

    // 1. Primary Yamuna Floodplain Polygon
    const primaryPolygon = L.polygon(YAMUNA_PRIMARY_FLOOD_POLYGON, {
      color: primaryColor,
      weight: 1.8,
      fillColor: '#0284c7',
      fillOpacity: primaryFillOpacity,
      className: isSimulated ? 'leaflet-flood-polygon flood-active' : 'leaflet-flood-polygon',
      pane: 'floodPane',
    });
    primaryPolygon.bindTooltip(
      isSimulated
        ? '⚠️ PRIMARY YAMUNA FLOOD ZONE • 1.4m SURCHARGE'
        : 'Yamuna River 100-Year Floodplain',
      { sticky: true, className: 'flood-tooltip' }
    );
    floodZonesLayerRef.current.addLayer(primaryPolygon);

    // 2. Kashmere Gate Lowland Depression
    const kashmereGatePolygon = L.polygon(KASHMERE_GATE_FLOOD_POLYGON, {
      color: secondaryColor,
      weight: 1.6,
      fillColor: '#0369a1',
      fillOpacity: secondaryFillOpacity,
      className: isSimulated ? 'leaflet-flood-polygon flood-active' : 'leaflet-flood-polygon',
      pane: 'floodPane',
    });
    kashmereGatePolygon.bindTooltip(
      isSimulated
        ? '⚠️ KASHMERE GATE INUNDATION BASIN • SUBMERGED'
        : 'Kashmere Gate Lowland Catchment',
      { sticky: true, className: 'flood-tooltip' }
    );
    floodZonesLayerRef.current.addLayer(kashmereGatePolygon);

    // 3. Ring Road Underpass #43 Depression
    const underpassPolygon = L.polygon(RING_ROAD_UNDERPASS_FLOOD_POLYGON, {
      color: secondaryColor,
      weight: 1.6,
      fillColor: '#0369a1',
      fillOpacity: secondaryFillOpacity,
      className: isSimulated ? 'leaflet-flood-polygon flood-active' : 'leaflet-flood-polygon',
      pane: 'floodPane',
    });
    underpassPolygon.bindTooltip(
      isSimulated
        ? '⚠️ RING ROAD UNDERPASS #43 • INUNDATED'
        : 'Barapullah Sluice Inundation Catchment',
      { sticky: true, className: 'flood-tooltip' }
    );
    floodZonesLayerRef.current.addLayer(underpassPolygon);

    // 4. Mayur Vihar Trans-Yamuna Retention Catchment
    const mayurViharPolygon = L.polygon(MAYUR_VIHAR_FLOOD_POLYGON, {
      color: secondaryColor,
      weight: 1.6,
      fillColor: '#0284c7',
      fillOpacity: secondaryFillOpacity,
      className: isSimulated ? 'leaflet-flood-polygon flood-active' : 'leaflet-flood-polygon',
      pane: 'floodPane',
    });
    floodZonesLayerRef.current.addLayer(mayurViharPolygon);

    // 5. Hazard Warning Triangles inside flooded zones (matching reference screenshot)
    FLOOD_HAZARD_LOCATIONS.forEach((h) => {
      const hazardIcon = L.divIcon({
        className: 'custom-hazard-marker-container',
        html: `
          <div class="flood-hazard-pin" title="${h.name}">
            <span>⚠️</span>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const marker = L.marker(h.coords, { icon: hazardIcon, interactive: false, pane: 'floodPane' });
      floodZonesLayerRef.current.addLayer(marker);
    });

    // 6. Water Depth Badges
    FLOOD_DEPTH_MARKERS.forEach((zone) => {
      const depthIcon = L.divIcon({
        className: 'custom-flood-depth-container',
        html: `
          <div class="map-flood-depth-badge ${isSimulated ? 'depth-severe' : 'depth-baseline'}">
            <span class="depth-wave-icon">🌊</span>
            <span class="depth-text">${zone.depth}</span>
          </div>
        `,
        iconSize: [64, 22],
        iconAnchor: [32, 11],
      });
      const marker = L.marker(zone.coords, { icon: depthIcon, interactive: false, pane: 'floodPane' });
      floodZonesLayerRef.current.addLayer(marker);
    });
  }, [layerFilters.flood_zones, isSimulated]);

  // Render Real-Time Traffic Corridors (in trafficPane, z=380)
  useEffect(() => {
    if (!mapInstanceRef.current || !trafficLayerRef.current) return;
    trafficLayerRef.current.clearLayers();

    if (!liveTrafficEnabled) return;

    DELHI_TRAFFIC_CORRIDORS.forEach((corridor) => {
      const line = L.polyline(corridor.coords, {
        color: corridor.color,
        weight: 3.5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        pane: 'trafficPane',
      });
      line.bindTooltip(`Illustrative traffic: ${corridor.name} (${corridor.status.toUpperCase()})`, {
        sticky: true,
        className: 'flood-tooltip',
      });
      trafficLayerRef.current.addLayer(line);
    });
  }, [liveTrafficEnabled]);

  // Clean, crisp circular HTML markers (in infraMarkerPane, z=500)
  const createNodeIcon = useCallback(
    (node, isSelected, isOrigin, isDest) => {
      const status = node.status || 'safe';
      const type = node.type || 'road';
      const name = (node.name || '').toLowerCase();
      const isMetro = type === 'metro' || name.includes('metro') || name.includes('interchange');

      let glyph = '●';
      let typeClass = 'type-road';

      if (type === 'hospital') {
        glyph = '✚';
        typeClass = 'type-hospital';
      } else if (type === 'fire_station') {
        glyph = '🔥';
        typeClass = 'type-fire';
      } else if (isMetro) {
        glyph = 'Ⓜ';
        typeClass = 'type-metro';
      } else if (type === 'drainage') {
        glyph = '💧';
        typeClass = 'type-drainage';
      } else if (type === 'transformer') {
        glyph = '⚡';
        typeClass = 'type-transformer';
      }

      const classes = [
        'delhi-clean-marker',
        typeClass,
        `status-${status}`,
        isSelected ? 'marker-selected' : '',
        isOrigin ? 'is-origin' : '',
        isDest ? 'is-dest' : '',
      ].filter(Boolean).join(' ');

      const html = `
        <div class="${classes}">
          ${status === 'failed' ? '<div class="marker-pulse-ring"></div>' : ''}
          <div class="marker-circle">
            <span class="marker-glyph">${glyph}</span>
          </div>
        </div>
      `;

      return L.divIcon({
        className: 'custom-delhi-node-marker',
        html,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14],
      });
    },
    []
  );

  // Render Infrastructure Nodes on Map (in infraMarkerPane)
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    visibleNodes.forEach((node) => {
      if (!node.lat || !node.lng) return;

      const isSelected = selectedNode && selectedNode.id === node.id;
      const isOrigin = routeOrigin && routeOrigin.id === node.id;
      const isDest = routeDestination && routeDestination.id === node.id;

      const icon = createNodeIcon(node, isSelected, isOrigin, isDest);
      const marker = L.marker([node.lat, node.lng], { icon, pane: 'infraMarkerPane' });

      const statusLabel = (node.status || 'SAFE').toUpperCase();
      const isFailed = node.status === 'failed';

      const popupHtml = `
        <div class="delhi-popup-card">
          <div class="delhi-popup-header">
            <span class="delhi-popup-badge status-${node.status || 'safe'}">
              ${statusLabel}
            </span>
            <span class="delhi-popup-risk">RISK ${(Number(node.risk) || 0).toFixed(2)}</span>
          </div>

          <h4 class="delhi-popup-title">${node.name || node.id}</h4>
          <div class="delhi-popup-sub">
            <span>${node.type_label || node.type || 'Infrastructure'}</span> • <span>${node.zone || 'Central Delhi'}</span>
          </div>

          <div class="delhi-popup-metrics">
            <div class="delhi-popup-metric">
              <span class="m-lbl">Load / Capacity:</span>
              <span class="m-val">${node.current_load ?? 50} / ${node.capacity ?? 100}</span>
            </div>
            <div class="delhi-popup-metric">
              <span class="m-lbl">Criticality:</span>
              <span class="m-val">${node.criticality ?? 5}/10</span>
            </div>
          </div>

          ${isFailed ? `
            <div class="popup-fail-warning">
              <span>⚠️ SUBMERGED / OFFLINE: Emergency staging prohibited.</span>
            </div>
          ` : ''}

          <div class="delhi-popup-actions">
            <button
              type="button"
              class="btn-popup-action btn-popup-inspect"
              onclick="window.citygraph_inspect('${node.id}')"
            >
              🔍 Inspect Asset
            </button>
            <button
              type="button"
              class="btn-popup-action btn-popup-from ${isFailed ? 'btn-disabled' : ''}"
              onclick="window.citygraph_routeFrom('${node.id}')"
              ${isFailed ? 'title="Cannot stage dispatch from flooded asset"' : ''}
            >
              📍 Route From Here
            </button>
            <button
              type="button"
              class="btn-popup-action btn-popup-to ${isFailed ? 'btn-disabled' : ''}"
              onclick="window.citygraph_routeTo('${node.id}')"
              ${isFailed ? 'title="Cannot route to flooded destination"' : ''}
            >
              🏁 Route To Here
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'delhi-dark-popup',
        closeButton: true,
        autoPan: true,
      });

      marker.on('click', () => {
        onSelectNode(node);

        if (routingMode) {
          if (routingStep === 'select_origin' || !routeOrigin) {
            if (node.status === 'failed') {
              setRoutingAlert(`⚠️ Cannot start from flooded asset: ${node.name}. Please select an operational asset.`);
              setTimeout(() => setRoutingAlert(null), 5000);
              return;
            }
            onSetOrigin(node);
            setRoutingAlert(`✓ Origin set to ${node.short_name || node.name}. Now click DESTINATION on map.`);
            setTimeout(() => setRoutingAlert(null), 4000);
          } else if (routingStep === 'select_destination' || (routeOrigin && !routeDestination)) {
            if (node.id === routeOrigin.id) {
              setRoutingAlert('⚠️ Destination cannot be the same as Origin.');
              setTimeout(() => setRoutingAlert(null), 4000);
              return;
            }
            if (node.status === 'failed') {
              setRoutingAlert(`⚠️ Destination is submerged/flooded: ${node.name}. Please select an accessible point.`);
              setTimeout(() => setRoutingAlert(null), 5000);
              return;
            }
            onSetDestination(node);
            setRoutingAlert(`✓ Routing: ${routeOrigin.short_name || routeOrigin.name} → ${node.short_name || node.name}`);
            onCalculateRoute(routeOrigin.id, node.id);
            setTimeout(() => setRoutingAlert(null), 4000);
          }
        }
      });

      markersLayerRef.current.addLayer(marker);
    });
  }, [
    visibleNodes,
    selectedNode,
    routeOrigin,
    routeDestination,
    routingMode,
    routingStep,
    createNodeIcon,
    onSelectNode,
    onSetOrigin,
    onSetDestination,
    onCalculateRoute,
  ]);

  // Center on Selected Node when updated
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedNode) return;
    if (selectedNode.lat && selectedNode.lng) {
      mapInstanceRef.current.panTo([selectedNode.lat, selectedNode.lng], {
        animate: true,
        duration: 0.5,
      });
    }
  }, [selectedNode]);

  // Render Real Road-Following Route Line & Navigation Pins with Name Badges
  useEffect(() => {
    if (!mapInstanceRef.current || !routeGlowLayerRef.current || !routeMarkersRef.current || !routeAltLayerRef.current) return;

    routeGlowLayerRef.current.clearLayers();
    routeAltLayerRef.current.clearLayers();
    routeMarkersRef.current.clearLayers();

    if (routePolylineRef.current) {
      mapInstanceRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    if (!activeRoute || !activeRoute.coordinates || activeRoute.coordinates.length < 2) {
      return;
    }

    const rawCoords = activeRoute.coordinates;
    const originName = activeRoute.source?.short_name || activeRoute.source?.name || routeOrigin?.short_name || routeOrigin?.name || 'Origin';
    const destName = activeRoute.target?.short_name || activeRoute.target?.name || routeDestination?.short_name || routeDestination?.name || 'Destination';

    let isSubscribed = true;

    // Fetch high-resolution road geometry via OSRM, falling back to safe Dijkstra points
    fetchOsrmRoadGeometry(rawCoords).then((roadGeom) => {
      if (!isSubscribed || !mapInstanceRef.current) return;

      const allRoutes = [
        roadGeom?.primary || rawCoords,
        ...(roadGeom?.alternatives || []),
      ];

      // Determine active primary vs subtle alternatives based on selectedRouteOption (1, 2, 3)
      const primaryIdx = Math.min(selectedRouteOption - 1, allRoutes.length - 1);
      const activePath = allRoutes[primaryIdx] || allRoutes[0];

      // 1. Draw subtle alternative routes in routeAltPane (z-index 400)
      allRoutes.forEach((routeCoords, idx) => {
        if (idx === primaryIdx) return;
        const altLine = L.polyline(routeCoords, {
          color: '#94a3b8',
          weight: 3.5,
          opacity: 0.55,
          lineCap: 'round',
          lineJoin: 'round',
          pane: 'routeAltPane',
        });
        altLine.on('click', () => {
          setSelectedRouteOption(idx + 1);
        });
        routeAltLayerRef.current.addLayer(altLine);
      });

      // 2. White casing underneath primary route in routePrimaryPane (z-index 420)
      const casingLine = L.polyline(activePath, {
        color: '#ffffff',
        weight: 9,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        pane: 'routePrimaryPane',
      });
      routeGlowLayerRef.current.addLayer(casingLine);

      // 3. Solid Google Maps Royal Blue primary route line in routePrimaryPane (z-index 420)
      const pathLine = L.polyline(activePath, {
        color: '#2563eb',
        weight: 5.5,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round',
        pane: 'routePrimaryPane',
      });
      routeGlowLayerRef.current.addLayer(pathLine);
      routePolylineRef.current = pathLine;

      // 4. Origin Navigation Pin 'A' with White Name Label Pill in navPinPane (z-index 600)
      const startPoint = activePath[0];
      const originPinIcon = L.divIcon({
        className: 'custom-google-nav-pin',
        html: `
          <div class="google-nav-pin pin-origin">
            <div class="pin-circle pin-circle-a"><span>A</span></div>
            <div class="pin-name-badge">${originName}</div>
          </div>
        `,
        iconSize: [140, 30],
        iconAnchor: [12, 15],
      });
      const originMarker = L.marker(startPoint, { icon: originPinIcon, zIndexOffset: 1200, pane: 'navPinPane' });
      routeMarkersRef.current.addLayer(originMarker);

      // 5. Destination Navigation Pin 'B' with White Name Label Pill in navPinPane (z-index 600)
      const endPoint = activePath[activePath.length - 1];
      const destPinIcon = L.divIcon({
        className: 'custom-google-nav-pin',
        html: `
          <div class="google-nav-pin pin-dest">
            <div class="pin-circle pin-circle-b"><span>B</span></div>
            <div class="pin-name-badge">${destName}</div>
          </div>
        `,
        iconSize: [140, 30],
        iconAnchor: [12, 15],
      });
      const destMarker = L.marker(endPoint, { icon: destPinIcon, zIndexOffset: 1200, pane: 'navPinPane' });
      routeMarkersRef.current.addLayer(destMarker);

      // Fit map bounds to show complete safe corridor
      const bounds = L.latLngBounds(activePath);
      mapInstanceRef.current.fitBounds(bounds, { padding: [55, 55], maxZoom: 14 });
    });

    return () => {
      isSubscribed = false;
    };
  }, [activeRoute, routeOrigin, routeDestination, selectedRouteOption]);

  // Floating Right Controls: Zoom in, Zoom out, Locate/Fit Route
  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleLocateRoute = () => {
    if (!mapInstanceRef.current) return;
    if (activeRoute?.coordinates && activeRoute.coordinates.length >= 2) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(activeRoute.coordinates), { padding: [55, 55], maxZoom: 14 });
    } else {
      mapInstanceRef.current.setView(DELHI_CENTER, DEFAULT_ZOOM, { animate: true });
    }
  };

  const fitAllAssets = () => { const points = nodes.filter(n => Number.isFinite(Number(n.lat)) && Number.isFinite(Number(n.lng))).map(n => [Number(n.lat),Number(n.lng)]);if(mapInstanceRef.current && points.length>1)mapInstanceRef.current.fitBounds(L.latLngBounds(points),{padding:[40,40],maxZoom:13});};

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!mapContainerRef.current) return;
    if (!document.fullscreenElement) {
      mapContainerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false));
    }
  };

  const activeFiltersCount = [
    statusFilter !== 'all',
    riskFilter !== 'all',
    typeFilter !== 'all',
  ].filter(Boolean).length;

  return (
    <div className={`delhi-map-container ${isFullscreen ? 'is-fullscreen' : ''}`}>
      {/* Floating Top Controls Bar Matching Master Reference (media_1789912155576.jpg) */}
      <div className="map-top-bar">
        {/* Basemap Style Toggle: [ Map ] | [ Satellite ] | [ Terrain ] */}
        <div className="basemap-toggle-pills" role="radiogroup" aria-label="Basemap Style">
          <button
            type="button"
            className={`basemap-pill-btn ${mapStyle === 'streets' ? 'active' : ''}`}
            onClick={() => onSetMapStyle('streets')}
          >
            <span>Map</span>
          </button>
          <button
            type="button"
            className={`basemap-pill-btn ${mapStyle === 'satellite' ? 'active' : ''}`}
            onClick={() => onSetMapStyle('satellite')}
          >
            <span>Satellite</span>
          </button>
          <button
            type="button"
            className={`basemap-pill-btn ${mapStyle === 'positron' ? 'active' : ''}`}
            onClick={() => onSetMapStyle('positron')}
          >
            <span>Minimal</span>
          </button>
          <div className="pill-divider" />
          <button
            type="button"
            className={`basemap-pill-btn btn-graph-pill ${centerViewType === 'graph' ? 'active' : ''}`}
            onClick={() => onToggleView(centerViewType === 'map' ? 'graph' : 'map')}
            title="Switch to Topology Graph View"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>Graph</span>
          </button>
        </div>

        {/* Center / Right Controls: Filters, Layers, Live Traffic, Fullscreen */}
        <div className="map-actions-group">
          {/* Quick Filter Menu Dropdown */}
          <div className="map-filter-wrapper">
            <button
              type="button"
              className={`map-tool-btn filter-btn ${activeFiltersCount > 0 ? 'filter-active' : ''}`}
              onClick={() => {
                setShowFilterDropdown(!showFilterDropdown);
                setShowLayersDropdown(false);
              }}
              title="Filter displayed infrastructure"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}</span>
            </button>

            {showFilterDropdown && (
              <div className="map-filter-popover">
                <div className="filter-popover-header">
                  <span className="popover-title">FILTER INFRASTRUCTURE</span>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      className="btn-reset-filters"
                      onClick={() => {
                        setStatusFilter('all');
                        setRiskFilter('all');
                        setTypeFilter('all');
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="filter-row">
                  <label className="filter-lbl">Status:</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="filter-sel"
                  >
                    <option value="all">All Statuses</option>
                    <option value="operational">Operational (Safe)</option>
                    <option value="at_risk">At Risk (Risk &ge; 0.7)</option>
                    <option value="affected">Affected / Overloaded</option>
                    <option value="failed">Failed / Flooded</option>
                  </select>
                </div>

                <div className="filter-row">
                  <label className="filter-lbl">Risk Index:</label>
                  <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                    className="filter-sel"
                  >
                    <option value="all">All Risk Levels</option>
                    <option value="high">High Risk (&gt; 0.8)</option>
                    <option value="medium">Medium Risk (0.5 - 0.8)</option>
                    <option value="low">Low Risk (&lt; 0.5)</option>
                  </select>
                </div>

                <div className="filter-row">
                  <label className="filter-lbl">Sector:</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="filter-sel"
                  >
                    <option value="all">All Sectors</option>
                    <option value="hospital">Hospitals</option>
                    <option value="fire_station">Fire Stations</option>
                    <option value="drainage">Drainage & Pumps</option>
                    <option value="transformer">Power Grid</option>
                    <option value="road">Road Junctions</option>
                    <option value="metro">Metro Stations</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Layers Popover Menu */}
          <div className="map-layers-wrapper">
            <button
              type="button"
              className={`map-tool-btn ${showLayersDropdown ? 'btn-active' : ''}`}
              onClick={() => {
                setShowLayersDropdown(!showLayersDropdown);
                setShowFilterDropdown(false);
              }}
              title="Toggle map layers"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span>Layers ▾</span>
            </button>

            {showLayersDropdown && (
              <div className="map-layers-popover">
                <div className="layers-popover-header">
                  <span>MAP LAYERS</span>
                  <button
                    type="button"
                    className="btn-close-popover"
                    onClick={() => setShowLayersDropdown(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="layers-popover-list">
                  <label className="layers-popover-item">
                    <input
                      type="checkbox"
                      checked={Boolean(layerFilters.flood_zones)}
                      onChange={() => setLayerFilters((p) => ({ ...p, flood_zones: !p.flood_zones }))}
                    />
                    <span className="layer-dot dot-cyan" />
                    <span>Flood Risk Zones</span>
                  </label>
                  <label className="layers-popover-item">
                    <input
                      type="checkbox"
                      checked={Boolean(layerFilters.hospital)}
                      onChange={() => setLayerFilters((p) => ({ ...p, hospital: !p.hospital }))}
                    />
                    <span className="layer-dot dot-red" />
                    <span>Hospitals</span>
                  </label>
                  <label className="layers-popover-item">
                    <input
                      type="checkbox"
                      checked={Boolean(layerFilters.fire_station)}
                      onChange={() => setLayerFilters((p) => ({ ...p, fire_station: !p.fire_station }))}
                    />
                    <span className="layer-dot dot-orange" />
                    <span>Fire Stations</span>
                  </label>
                  <label className="layers-popover-item">
                    <input
                      type="checkbox"
                      checked={Boolean(layerFilters.drainage)}
                      onChange={() => setLayerFilters((p) => ({ ...p, drainage: !p.drainage }))}
                    />
                    <span className="layer-dot dot-teal" />
                    <span>Drainage & Sluice</span>
                  </label>
                  <label className="layers-popover-item">
                    <input
                      type="checkbox"
                      checked={Boolean(layerFilters.transformer)}
                      onChange={() => setLayerFilters((p) => ({ ...p, transformer: !p.transformer }))}
                    />
                    <span className="layer-dot dot-amber" />
                    <span>Transformers / Grid</span>
                  </label>
                  <label className="layers-popover-item">
                    <input
                      type="checkbox"
                      checked={Boolean(layerFilters.metro)}
                      onChange={() => setLayerFilters((p) => ({ ...p, metro: !p.metro }))}
                    />
                    <span className="layer-dot dot-indigo" />
                    <span>Metro Stations</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Live Traffic Toggle Switch (matching reference screenshot) */}
          <div
            className={`live-traffic-switch-pill ${liveTrafficEnabled ? 'is-active' : ''}`}
            onClick={() => setLiveTrafficEnabled(!liveTrafficEnabled)}
            role="switch"
            aria-checked={liveTrafficEnabled}
            title="Toggle illustrative traffic overlay, not live traffic"
          >
            <span className="traffic-label">Sample Traffic</span>
            <div className="switch-track">
              <div className="switch-thumb" />
            </div>
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            className="map-tool-btn icon-only"
            onClick={handleToggleFullscreen}
            title="Toggle Fullscreen"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Floating Route Planner Over Left of Map (matching reference screenshot) */}
      {showRoutePlanner ? (
        <RoutePlanner
          nodes={nodes}
          activeRoute={activeRoute}
          routeOrigin={routeOrigin}
          routeDestination={routeDestination}
          routingMode={routingMode}
          onToggleRoutingMode={onToggleRoutingMode}
          onSelectOrigin={onSetOrigin}
          onSelectDestination={onSetDestination}
          onCalculateRoute={onCalculateRoute}
          onClearRoute={onClearRoute}
          onViewRouteOnMap={onViewRouteOnMap}
          loading={routingLoading}
          isOpen={showRoutePlanner}
          onClose={() => setShowRoutePlanner(false)}
          selectedRouteOption={selectedRouteOption}
          onSelectRouteOption={setSelectedRouteOption}
        />
      ) : (
        <button
          type="button"
          className="btn-reopen-route-planner"
          onClick={() => setShowRoutePlanner(true)}
          title="Open Emergency Route Planning"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
          <span>Find Route</span>
        </button>
      )}

      {/* Floating Right Google Maps Controls: Zoom In, Zoom Out, Locate Route, Scale Badge */}
      <div className="map-floating-right-controls" aria-label="Map View Controls">
        <div className="zoom-pill-group">
          <button
            type="button"
            className="btn-map-control"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom In"
          >
            +
          </button>
          <div className="control-divider" />
          <button
            type="button"
            className="btn-map-control"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            −
          </button>
        </div>

        <button
          type="button"
          className="btn-map-control btn-locate"
          onClick={handleLocateRoute}
          title="Center on Emergency Safe Corridor"
          aria-label="Locate Corridor"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="7" />
            <line x1="12" y1="1" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="1" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="23" y2="12" />
          </svg>
        </button>


      </div>

      <button type="button" className="map-fit-all-assets" onClick={fitAllAssets}>⌖ Fit all assets</button>
      <div className="map-demo-disclaimer">SIMULATED HAZARDS · Approximate locations · Not real-time emergency guidance</div>
      {/* North Compass Rose */}
      <div className="map-compass-badge" title="True North Orientation">
        <span className="compass-arrow">▲</span>
        <span className="compass-letter">N</span>
      </div>

      {/* Routing Mode Active Floating Guidance Banner */}
      {routingMode && (
        <div className="map-routing-guidance-banner">
          <div className="guidance-content">
            <span className="guidance-icon">📍</span>
            <span className="guidance-text">
              {!routeOrigin
                ? 'STEP 1: Click any operational infrastructure marker on the map to set ROUTE ORIGIN'
                : !routeDestination
                ? `STEP 2: Origin set (${routeOrigin.short_name || routeOrigin.name}). Click next marker for DESTINATION`
                : `SAFE CORRIDOR ACTIVE: ${routeOrigin.short_name || routeOrigin.name} → ${routeDestination.short_name || routeDestination.name}`}
            </span>
          </div>
          <button
            type="button"
            className="btn-exit-routing"
            onClick={onClearRoute}
            title="Clear and exit routing mode"
          >
            ✕ Exit
          </button>
        </div>
      )}

      {/* Routing Alert Toast */}
      {routingAlert && (
        <div className="map-routing-alert-toast" role="alert">
          <span>{routingAlert}</span>
        </div>
      )}

      {/* Actual Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="leaflet-map-canvas" />
    </div>
  );
}
