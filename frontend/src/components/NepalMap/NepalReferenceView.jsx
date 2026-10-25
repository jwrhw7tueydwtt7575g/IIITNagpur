import { useEffect, useState } from 'react';
import './NepalReferenceView.css';
import { useAuth } from '../../context/useAuth.js';

export default function NepalReferenceView({ apiBaseUrl }) {
  const { fetchWithAuth } = useAuth();

  const [metadata, setMetadata] = useState(null);
  const [topology, setTopology] = useState([]);
  const [evacRoute, setEvacRoute] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [activePhase, setActivePhase] = useState(4); // Default to Phase 4 (Full picture & Evac)
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [metaRes, topoRes, routeRes, timeRes] = await Promise.all([
          fetchWithAuth(`${apiBaseUrl}/api/nepal/metadata`),
          fetchWithAuth(`${apiBaseUrl}/api/nepal/topology`),
          fetchWithAuth(`${apiBaseUrl}/api/nepal/evacuation-route`),
          fetchWithAuth(`${apiBaseUrl}/api/nepal/timeline`),
        ]);

        if (!metaRes.ok || !topoRes.ok || !routeRes.ok || !timeRes.ok) {
          throw new Error('Failed to load Nepal Reference Scenario endpoints.');
        }

        const [metaJson, topoJson, routeJson, timeJson] = await Promise.all([
          metaRes.json(),
          topoRes.json(),
          routeRes.json(),
          timeRes.json(),
        ]);

        setMetadata(metaJson);
        setTopology(topoJson.assets || []);
        setEvacRoute(routeJson);
        setTimeline(timeJson.timeline || []);

        // Default select the highest risk or first asset
        const defaultAsset =
          topoJson.assets?.find((a) => a.id === 'nepal_hydro_ref') ||
          topoJson.assets?.[0] ||
          null;
        setSelectedAsset(defaultAsset);
        setError('');
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [apiBaseUrl, fetchWithAuth]);

  const activeTimelineItem = timeline.find((t) => t.phase === activePhase) || timeline[timeline.length - 1];

  const getAssetStatusInPhase = (asset) => {
    if (!asset) return 'operational';
    if (activePhase === 1) {
      return asset.id === 'nepal_settlement_ref_1' ? 'threatened' : 'operational';
    }
    if (activePhase === 2) {
      if (asset.id === 'nepal_road_ref_1' || asset.id === 'nepal_bridge_ref_1') return 'critical_failure';
      if (asset.id === 'nepal_settlement_ref_1') return 'threatened';
      return 'operational';
    }
    if (activePhase === 3) {
      if (
        asset.id === 'nepal_road_ref_1' ||
        asset.id === 'nepal_bridge_ref_1' ||
        asset.id === 'nepal_hydro_ref'
      )
        return 'critical_failure';
      if (asset.id === 'nepal_settlement_ref_1') return 'inundated';
      if (asset.id === 'nepal_health_ref' || asset.id === 'nepal_road_ref_2') return 'threatened';
      return 'operational';
    }
    // Phase 4: full backend state
    return asset.status;
  };

  const isAssetInEvacRoute = (assetId) => {
    return evacRoute?.waypoints?.includes(assetId);
  };

  return (
    <div className="nepal-container">
      {/* Prominent Mandatory Top Disclaimer Banner */}
      <div className="nepal-disclaimer-banner" role="alert">
        <div className="nepal-disclaimer-content">
          <div className="nepal-disclaimer-badge-row">
            <span className="nepal-pulse-dot" aria-hidden="true"></span>
            <span className="nepal-badge-primary">SIMULATED REFERENCE MODEL</span>
            <span className="nepal-badge-secondary">NOT AN OFFICIAL OR LIVE MONITORING FEED</span>
            <span className="nepal-badge-illustrative">Illustrative impact data • Not live</span>
          </div>
          <p className="nepal-disclaimer-text">
            This scenario demonstrates high-gradient mountain river flash-flooding, valley floor inundation, road blockage, and elevated evacuation routing. It does not represent real-time hydrological measurements, verified structural failure records, or live telemetry.
          </p>
        </div>
      </div>

      {error && (
        <div className="phase-briefing-box" style={{ borderColor: '#ef4444' }}>
          <strong style={{ color: '#f87171' }}>Connection Notice:</strong> {error}
        </div>
      )}

      {loading && (
        <div className="phase-briefing-box">
          <span style={{ color: '#38bdf8' }}>Loading illustrative Nepal reference model...</span>
        </div>
      )}

      {/* Scenario Information Bar */}
      <section className="nepal-info-bar" aria-label="Scenario Information">
        <div className="nepal-info-main">
          <div className="nepal-tags-row">
            <span className="nepal-mode-tag">🏔️ MOUNTAIN VALLEY TOPOGRAPHY</span>
            <span className="nepal-data-tag">Reference Asset • Illustrative Data</span>
          </div>
          <h2>Nepal Flash-Flood Reference Scenario</h2>
          <p className="nepal-description">
            Simulated monsoonal cloudburst and glacial runoff surge across a steep Himalayan river valley. Demonstrates cascading operational impact on run-of-the-river hydropower, suspension crossings, highway chokepoints, and high-ridge extraction routes.
          </p>
        </div>

        <div className="nepal-stats-grid">
          <div className="nepal-stat-card">
            <span className="stat-card-label">Monitored Assets</span>
            <strong className="stat-card-value">{metadata?.summary?.total_reference_assets || 12}</strong>
            <span className="stat-card-sub">Illustrative facilities</span>
          </div>
          <div className="nepal-stat-card nepal-stat-failed">
            <span className="stat-card-label">Critical Failures</span>
            <strong className="stat-card-value">{metadata?.summary?.critical_failures || 3}</strong>
            <span className="stat-card-sub">Hydro & river crossings</span>
          </div>
          <div className="nepal-stat-card nepal-stat-threatened">
            <span className="stat-card-label">Blocked / Threatened</span>
            <strong className="stat-card-value">{metadata?.summary?.secondary_threatened || 3}</strong>
            <span className="stat-card-sub">Debris chokepoints</span>
          </div>
          <div className="nepal-stat-card nepal-stat-safe">
            <span className="stat-card-label">Evacuation Corridor</span>
            <strong className="stat-card-value">High Ridge</strong>
            <span className="stat-card-sub">Elevated safe bypass</span>
          </div>
        </div>
      </section>

      {/* Timeline Controls */}
      <div className="nepal-timeline-bar" aria-label="Simulated Event Progression">
        <div className="timeline-title-cluster">
          <span className="timeline-eyebrow">SIMULATED SURGE PROGRESSION</span>
          <h3>{activeTimelineItem?.phase_label || 'Phase 4: Ridge Evacuation'}</h3>
        </div>

        <div className="phase-buttons" role="tablist">
          {timeline.map((item) => (
            <button
              key={item.phase}
              type="button"
              role="tab"
              aria-selected={activePhase === item.phase}
              className={`phase-btn ${activePhase === item.phase ? 'active' : ''}`}
              onClick={() => setActivePhase(item.phase)}
            >
              <span className="phase-time">{item.relative_time}</span>
              <span className="phase-name">Phase {item.phase}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Phase Briefing Box */}
      <div className="phase-briefing-box">
        <div className="phase-briefing-header">
          <span className={`phase-status-pill status-${activeTimelineItem?.status || 'recovery'}`}>
            {activeTimelineItem?.status?.toUpperCase()}
          </span>
          <strong>{activeTimelineItem?.headline}</strong>
        </div>
        <p>{activeTimelineItem?.summary}</p>
      </div>

      {/* Main Two-Column Interactive Workspace */}
      <div className="nepal-workspace">
        {/* Left Column: Mountain Valley Topological Schematic */}
        <section className="nepal-diagram-card" aria-label="Topographical Valley Schematic">
          <div className="diagram-header">
            <div>
              <h3>Mountain Valley Topological Schematic</h3>
              <p className="diagram-caption">
                Illustrative elevation profile (1,300m – 1,900m) • Click any asset to inspect diagnostics
              </p>
            </div>
            <div className="diagram-badge-disclaimer">
              <span>Schematic Model • Not Live Map</span>
            </div>
          </div>

          <div className="diagram-container">
            <svg
              viewBox="0 0 920 540"
              className="nepal-valley-svg"
              preserveAspectRatio="xMidYMid meet"
              aria-label="Interactive Mountain Valley Schematic Diagram"
            >
              <defs>
                {/* Elevation Band Gradients */}
                <linearGradient id="valleySky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#08101e" />
                  <stop offset="60%" stopColor="#0f1f38" />
                  <stop offset="100%" stopColor="#142645" />
                </linearGradient>

                <linearGradient id="ridgeSlope" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e3a5f" />
                  <stop offset="100%" stopColor="#0b1728" />
                </linearGradient>

                <linearGradient id="riverSurge" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.85" />
                  <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#0369a1" stopOpacity="0.85" />
                </linearGradient>

                <linearGradient id="floodZone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(239, 68, 68, 0.18)" />
                  <stop offset="100%" stopColor="rgba(239, 68, 68, 0.45)" />
                </linearGradient>

                {/* Marker for Evacuation Route Arrows */}
                <marker
                  id="evacArrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#10b981" />
                </marker>
              </defs>

              {/* Sky Background */}
              <rect x="0" y="0" width="920" height="540" fill="url(#valleySky)" />

              {/* Mountain Silhouettes (Upper Ridge Elevation: ~1,850m) */}
              <polygon
                points="0,220 180,80 360,190 520,60 740,160 920,90 920,540 0,540"
                fill="url(#ridgeSlope)"
                opacity="0.85"
              />
              <polygon
                points="0,310 140,240 310,290 510,180 690,260 920,200 920,540 0,540"
                fill="#0f1d33"
                opacity="0.9"
              />

              {/* Elevation Tier Guidelines & Labels */}
              <g className="elevation-lines" stroke="#334155" strokeDasharray="4 6" opacity="0.6">
                <line x1="30" y1="120" x2="890" y2="120" />
                <line x1="30" y1="280" x2="890" y2="280" />
                <line x1="30" y1="440" x2="890" y2="440" />
              </g>
              <g className="elevation-labels" fill="#64748b" fontSize="11" fontWeight="600">
                <text x="36" y="112">HIGH RIDGE TIER (~1,750m – 1,900m) • SAFE EXTRACTION ZONE</text>
                <text x="36" y="272">MID-SLOPE TERRACE (~1,450m – 1,600m) • TRANSIT & SHELTER</text>
                <text x="36" y="432">VALLEY FLOOR GORGE (~1,300m – 1,400m) • FLASH-SURGE INUNDATION HAZARD</text>
              </g>

              {/* Riverbed Gorge (Bottom Inundation Area) */}
              <path
                d="M 0,480 Q 220,440 450,470 T 920,450 L 920,540 L 0,540 Z"
                fill="url(#floodZone)"
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <path
                d="M 0,490 Q 220,455 450,485 T 920,465 L 920,540 L 0,540 Z"
                fill="url(#riverSurge)"
                className="river-flow"
              />
              <text x="440" y="522" fill="#e0f2fe" fontSize="12" fontWeight="700" textAnchor="middle" letterSpacing="2">
                SIMULATED TORRENTIAL GORGE SURGE (PEAK FLOOD)
              </text>

              {/* Mid-Slope Mountain Road Corridor (Lowland Transit) */}
              <path
                d="M 120,470 C 240,430 350,420 410,430 S 540,350 620,330"
                fill="none"
                stroke="#64748b"
                strokeWidth="4"
                strokeDasharray="6 4"
              />
              {/* Blocked Road Debris Impact Indicator */}
              <circle cx="410" cy="430" r="16" fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" strokeWidth="2" />
              <text x="410" y="415" fill="#f87171" fontSize="10" fontWeight="bold" textAnchor="middle">
                LANDSLIDE BLOCKAGE
              </text>

              {/* High-Ridge Safe Evacuation Trail */}
              <path
                d="M 160,470 Q 260,340 390,200 T 520,210 T 660,180 T 800,120"
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeDasharray="6 4"
                className="evac-trail-path"
                markerEnd="url(#evacArrow)"
              />
              <text x="530" y="195" fill="#34d399" fontSize="11" fontWeight="700">
                HIGH-RIDGE SAFE EVACUATION CORRIDOR
              </text>

              {/* Render Interactive Asset Nodes */}
              {topology.map((asset) => {
                const pos = asset.diagram_pos || { x: 400, y: 250 };
                const currentStatus = getAssetStatusInPhase(asset);
                const isSelected = selectedAsset?.id === asset.id;
                const inEvacRoute = isAssetInEvacRoute(asset.id);

                let statusColor = '#38bdf8'; // normal safe
                if (currentStatus === 'critical_failure') statusColor = '#ef4444';
                else if (currentStatus === 'inundated') statusColor = '#dc2626';
                else if (currentStatus === 'threatened') statusColor = '#f59e0b';
                else if (inEvacRoute) statusColor = '#10b981';

                return (
                  <g
                    key={asset.id}
                    className={`svg-asset-node ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedAsset(asset)}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${asset.name}: ${currentStatus}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedAsset(asset);
                    }}
                  >
                    {/* Pulsing Selection Ring */}
                    {isSelected && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="24"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                        className="pulse-selection-ring"
                      />
                    )}

                    {/* Status Outer Ring */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="16"
                      fill="#0f172a"
                      stroke={statusColor}
                      strokeWidth={isSelected ? '3.5' : '2'}
                    />

                    {/* Icon Glyph */}
                    <text
                      x={pos.x}
                      y={pos.y + 4}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="11"
                      fontWeight="bold"
                      pointerEvents="none"
                    >
                      {asset.type === 'hydropower' ? '⚡' :
                       asset.type === 'suspension_bridge' ? '🌉' :
                       asset.type === 'blocked_mountain_road' ? '🚧' :
                       asset.type === 'elevated_rescue_base' ? '🚁' :
                       asset.type === 'health_post' ? '🏥' :
                       asset.type === 'settlement' ? '🏘️' :
                       asset.type === 'shelter' ? '⛺' :
                       asset.type === 'communications' ? '📡' : '📍'}
                    </text>

                    {/* Asset Label Text */}
                    <text
                      x={pos.x}
                      y={pos.y + 28}
                      textAnchor="middle"
                      fill={isSelected ? '#f8fafc' : '#94a3b8'}
                      fontSize="10"
                      fontWeight={isSelected ? '700' : '500'}
                      pointerEvents="none"
                      className="svg-node-label"
                    >
                      {asset.short_name || asset.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Graphical Legend */}
          <div className="nepal-legend-card" aria-label="Schematic Legend">
            <h4 className="legend-title">SCHEMATIC REFERENCE LEGEND</h4>
            <div className="legend-grid">
              <div className="legend-item">
                <span className="legend-marker marker-critical" aria-hidden="true"></span>
                <span>Critical Failure / Inundated (⚡ Hydro, 🌉 Bridge 1, 🚧 Road A)</span>
              </div>
              <div className="legend-item">
                <span className="legend-marker marker-threatened" aria-hidden="true"></span>
                <span>Threatened / Secondary Hazard (🏥 Health Post, 🚧 Road B)</span>
              </div>
              <div className="legend-item">
                <span className="legend-marker marker-safe" aria-hidden="true"></span>
                <span>Operational / High-Ground (⛺ Shelter, 🚁 Helipad, 📡 Comms)</span>
              </div>
              <div className="legend-item">
                <span className="legend-marker marker-evac" aria-hidden="true"></span>
                <span>High-Ridge Evacuation Path (Bypasses Gorge & Landslides)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Asset Selection Inspector & Evacuation Route */}
        <aside className="nepal-sidebar">
          {/* Asset Details Inspector */}
          <div className="nepal-inspector-card" aria-label="Reference Asset Inspector">
            <div className="inspector-header">
              <span className="inspector-eyebrow">ASSET DIAGNOSTIC INSPECTOR</span>
              <span className="inspector-disclaimer-pill">Reference Asset • Illustrative Data</span>
            </div>

            {selectedAsset ? (
              <div className="inspector-body">
                <div className="inspector-title-row">
                  <h3>{selectedAsset.name}</h3>
                  <span className={`status-pill status-${getAssetStatusInPhase(selectedAsset)}`}>
                    {getAssetStatusInPhase(selectedAsset).replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div className="inspector-meta-row">
                  <span className="type-badge">{selectedAsset.type_label}</span>
                  <span className="elevation-badge">🏔️ {selectedAsset.elevation_band}</span>
                </div>

                {/* Mandatory In-Panel Disclaimer */}
                <div className="inspector-mandatory-disclaimer">
                  <span className="disclaimer-icon">⚠️</span>
                  <span>SIMULATED REFERENCE MODEL • NOT AN OFFICIAL OR LIVE MONITORING FEED</span>
                </div>

                {/* Failure / Hazard Rationale */}
                <div className="inspector-section">
                  <span className="section-label">Simulated Hazard Diagnostic:</span>
                  <div className={`diagnostic-box ${selectedAsset.failure_reason ? 'has-failure' : 'safe'}`}>
                    {selectedAsset.failure_reason || 'No simulated structural failures. Asset operating safely above peak surge elevation.'}
                  </div>
                </div>

                {/* Risk Index & Relative Capacity */}
                <div className="inspector-section">
                  <div className="risk-metric-header">
                    <span className="section-label">Simulated Hazard Index:</span>
                    <strong className="risk-metric-number">
                      {Math.round((selectedAsset.risk_score || 0.1) * 100)} / 100
                    </strong>
                  </div>
                  <div className="risk-bar-container">
                    <div
                      className="risk-bar-fill"
                      style={{
                        width: `${Math.round((selectedAsset.risk_score || 0.1) * 100)}%`,
                        backgroundColor:
                          selectedAsset.risk_score > 0.8
                            ? '#ef4444'
                            : selectedAsset.risk_score > 0.5
                            ? '#f59e0b'
                            : '#10b981',
                      }}
                    ></div>
                  </div>
                </div>

                {/* Operational Zone */}
                <div className="inspector-section">
                  <span className="section-label">Valley Sector:</span>
                  <p className="zone-text">{selectedAsset.zone}</p>
                </div>
              </div>
            ) : (
              <div className="inspector-empty">
                Select an asset node in the mountain valley schematic to view details.
              </div>
            )}
          </div>

          {/* Evacuation Route Card */}
          <div className="nepal-route-card" aria-label="Simulated Safe Evacuation Route">
            <div className="route-header">
              <div>
                <h3>Simulated Safe Evacuation Route</h3>
                <p>High-Ridge bypass route navigating away from valley floor hazards</p>
              </div>
              <span className="route-status-pill">CORRIDOR ACTIVE</span>
            </div>

            {evacRoute ? (
              <div className="route-content">
                <div className="route-narrative-box">
                  <p>{evacRoute.safety_narrative}</p>
                </div>

                <div className="route-waypoints-stepper">
                  <span className="stepper-label">Waypoints Sequence:</span>
                  <div className="waypoints-list">
                    {evacRoute.waypoints?.map((wId, idx) => {
                      const assetObj = topology.find((a) => a.id === wId);
                      const isLast = idx === evacRoute.waypoints.length - 1;
                      return (
                        <div key={wId} className="waypoint-step">
                          <div
                            className={`waypoint-pill ${selectedAsset?.id === wId ? 'active' : ''}`}
                            onClick={() => {
                              if (assetObj) setSelectedAsset(assetObj);
                            }}
                            title={`Inspect ${assetObj?.name || wId}`}
                          >
                            <span className="waypoint-index">{idx + 1}</span>
                            <span className="waypoint-name">{assetObj?.short_name || assetObj?.name || wId}</span>
                          </div>
                          {!isLast && <span className="waypoint-arrow">→</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bypassed-hazards-box">
                  <span className="stepper-label">Bypassed Failure Points:</span>
                  <ul>
                    {evacRoute.bypassed_hazards?.map((hazard, hIdx) => (
                      <li key={hIdx}>
                        <span className="hazard-cross">✕</span> {hazard}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="route-empty">Loading evacuation route corridor...</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
