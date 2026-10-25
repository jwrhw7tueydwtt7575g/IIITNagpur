import React, { useState, useMemo } from 'react';
import './SimulationView.css';

export default function SimulationView({
  graph,
  simulation,
  onRunSimulation,
  onResetNetwork,
  loading,
  selectedScenario,
  setSelectedScenario,
  selectedLocation = 'delhi_ncr',
  onSelectNode,
}) {
  const isSimulated = Boolean(simulation);
  const totalNodes = graph?.summary?.total_nodes ?? (graph?.nodes?.length || 108);
  const failedNodes = simulation?.failed_nodes || graph?.failed_nodes || [];
  const affectedNodes = simulation?.affected_nodes || graph?.affected_nodes || [];
  const highestRiskNodeId = graph?.summary?.highest_risk_node || 'node_43';
  const highestRiskNode = (graph?.nodes || []).find((n) => n.id === highestRiskNodeId);

  const landmarkPresets = useMemo(() => {
    if (selectedLocation?.includes('mumbai')) {
      return [
        { name: 'Kurla Mithi River Basin', type: 'flood', defaultSeverity: 85 },
        { name: 'Dadar Western Railway Culvert', type: 'flood', defaultSeverity: 80 },
        { name: 'Bandra-Kurla Complex (BKC)', type: 'cloudburst', defaultSeverity: 75 },
        { name: 'Love Grove Pumping Sluice', type: 'flood', defaultSeverity: 90 },
        { name: 'Hindmata Flyover Basin', type: 'flood', defaultSeverity: 75 },
        { name: 'Andheri Subway', type: 'cloudburst', defaultSeverity: 85 },
      ];
    }
    if (selectedLocation?.includes('kathmandu')) {
      return [
        { name: 'Bagmati River Balkhu Corridor', type: 'flood', defaultSeverity: 85 },
        { name: 'Bishnumati Teku Confluence', type: 'flood', defaultSeverity: 80 },
        { name: 'Tribhuvan Airport Airlift Staging', type: 'cloudburst', defaultSeverity: 70 },
        { name: 'Koteshwor Highway Intersection', type: 'flood', defaultSeverity: 75 },
      ];
    }
    return [
      { name: 'Ring Road Underpass #43', type: 'flood', defaultSeverity: 85 },
      { name: 'ITO Yamuna Floodplain', type: 'flood', defaultSeverity: 90 },
      { name: 'Minto Bridge Subway', type: 'cloudburst', defaultSeverity: 85 },
      { name: 'Maharani Bagh 400kV Substation', type: 'heatwave', defaultSeverity: 80 },
      { name: 'AIIMS Emergency Trauma Corridor', type: 'compound', defaultSeverity: 75 },
      { name: 'Kashmere Gate ISBT', type: 'dam_release', defaultSeverity: 85 },
    ];
  }, [selectedLocation]);

  const [targetPlace, setTargetPlace] = useState(landmarkPresets[0]?.name || 'Ring Road Underpass #43');
  const [disasterType, setDisasterType] = useState('flood');
  const [severity, setSeverity] = useState(80);
  const [prevLocation, setPrevLocation] = useState(selectedLocation);

  if (selectedLocation !== prevLocation) {
    setPrevLocation(selectedLocation);
    if (landmarkPresets.length > 0) {
      setTargetPlace(landmarkPresets[0].name);
      setDisasterType(landmarkPresets[0].type);
      setSeverity(landmarkPresets[0].defaultSeverity);
    }
  }

  const handleSimulatePlace = () => {
    if (!targetPlace.trim()) return;
    onRunSimulation({
      place_name: targetPlace.trim(),
      disaster_type: disasterType,
      severity: Number(severity),
      city: selectedLocation,
    });
  };

  const placeSim = simulation?.simulation?.place_name
    ? simulation.simulation
    : (graph?.simulation?.place_name ? graph.simulation : null);

  const scenarios = [
    {
      id: 'heavy_rain',
      title: 'Monsoon Cloudburst',
      intensity: '90 mm/hr Precipitation',
      status: 'Active',
      description: 'Simulates intense localized cloudburst over Yamuna floodplain. Floods stormwater sluices and triggers cascading road and power degradation.',
      badge: 'STRESS TEST READY',
      isPlanned: false,
    },
    {
      id: 'extreme_rain',
      title: 'Catastrophic Deluge',
      intensity: '150 mm/hr Precipitation',
      status: 'Planned',
      description: 'Extreme 1-in-100 year storm event exceeding all drainage pumping capacity across Delhi and NCR peripheral canals.',
      badge: 'PLANNED',
      isPlanned: true,
    },
    {
      id: 'flood_surge',
      title: 'Yamuna Riverbank Breach',
      intensity: 'Peak 209.5m Water Level',
      status: 'Planned',
      description: 'Upstream barrage discharge resulting in embankment breaches at Monastery Market and Ring Road lowlands.',
      badge: 'PLANNED',
      isPlanned: true,
    },
    {
      id: 'power_blackout',
      title: 'Substation Cascade Blackout',
      intensity: '400kV Grid Surcharge',
      status: 'Planned',
      description: 'Flooding of transmission transformers causing cascading tripping of metro lines and water pumping operations.',
      badge: 'PLANNED',
      isPlanned: true,
    },
  ];

  const pipelineStages = [
    {
      step: '01',
      title: 'Baseline Normalcy',
      desc: 'All 108 assets operating within nominal design capacity.',
      status: 'Ready',
      icon: '🏛️',
    },
    {
      step: '02',
      title: 'Hazard Injection',
      desc: '90 mm/hr cloudburst volume applied across stormwater drainage basins.',
      status: isSimulated ? 'Injected' : 'Pending',
      icon: '🌧️',
    },
    {
      step: '03',
      title: 'Initial Failures',
      desc: `${isSimulated ? failedNodes.length : 8} drainage regulators exceed intake capacity and enter backflow state.`,
      status: isSimulated ? 'Triggered' : 'Pending',
      icon: '⚠️',
    },
    {
      step: '04',
      title: 'Cascade Propagation',
      desc: `${isSimulated ? affectedNodes.length : 23} interconnected roads, power feeds, and metro corridors degraded.`,
      status: isSimulated ? 'Propagated' : 'Pending',
      icon: '⚡',
    },
    {
      step: '05',
      title: 'Risk Scoring & Centrality',
      desc: 'Dynamic percolation calculations identify critical failure bottlenecks.',
      status: isSimulated ? 'Computed' : 'Pending',
      icon: '📊',
    },
    {
      step: '06',
      title: 'Fail-Safe Rerouting',
      desc: 'Dijkstra route engine bypasses flooded lowlands via elevated corridors.',
      status: isSimulated ? 'Active' : 'Pending',
      icon: '🚑',
    },
  ];

  return (
    <div className="simulation-page-container">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <span className="page-category-tag">SCENARIO INTELLIGENCE</span>
          <h1 className="page-main-title">Multi-Sector Cascade Simulation</h1>
          <p className="page-sub-title">
            Stress-test urban infrastructure against extreme climate hazard scenarios and observe topological failure propagation.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="sim-btn-primary"
            onClick={onRunSimulation}
            disabled={loading}
          >
            {loading ? 'Simulating Cascade...' : '▶ Run Monsoon Simulation'}
          </button>
          <button
            type="button"
            className="sim-btn-secondary"
            onClick={onResetNetwork}
            disabled={loading}
          >
            ↺ Reset Network
          </button>
        </div>
      </div>

      {/* Scenario Selector Cards */}
      <div className="scenarios-grid">
        {scenarios.map((sc) => (
          <div
            key={sc.id}
            className={`scenario-card ${selectedScenario === sc.id ? 'is-selected' : ''} ${sc.isPlanned ? 'is-planned' : ''}`}
            onClick={() => { if (!sc.isPlanned) setSelectedScenario(sc.id); }}
          >
            <div className="scenario-card-header">
              <span className="sc-intensity">{sc.intensity}</span>
              <span className={`sc-badge ${sc.isPlanned ? 'badge-planned' : 'badge-active'}`}>
                {sc.badge}
              </span>
            </div>
            <h3 className="sc-title">{sc.title}</h3>
            <p className="sc-desc">{sc.description}</p>
          </div>
        ))}
      </div>

      {/* Targeted Landmark Hazard Simulation Control Panel */}
      <div className="sim-panel-card place-sim-card">
        <div className="card-header-clean">
          <div>
            <h3 className="card-heading">📍 Targeted Landmark & Sector Hazard Simulation</h3>
            <p className="place-sim-subtitle">
              Execute precise physical hazard injections at specific urban landmarks, substations, transit hubs, or riverfront basins.
            </p>
          </div>
          <span className="card-badge badge-landmark">POINT HAZARD INJECTOR</span>
        </div>

        <div className="place-sim-controls-grid">
          {/* Target Place Input & Presets */}
          <div className="place-input-group">
            <label className="place-input-label" htmlFor="landmark-input">
              Target Landmark / Infrastructure Sector:
            </label>
            <div className="place-input-wrapper">
              <input
                id="landmark-input"
                type="text"
                className="place-text-input"
                value={targetPlace}
                onChange={(e) => setTargetPlace(e.target.value)}
                placeholder="e.g. Ring Road Underpass #43, Dadar Western Sluice, ITO Floodplain..."
              />
            </div>
            <div className="place-presets-row">
              <span className="presets-label">Quick Presets:</span>
              <div className="preset-chips">
                {landmarkPresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={`preset-chip ${targetPlace === preset.name ? 'is-active' : ''}`}
                    onClick={() => {
                      setTargetPlace(preset.name);
                      setDisasterType(preset.type);
                      setSeverity(preset.defaultSeverity);
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Disaster Type & Severity Slider */}
          <div className="place-params-group">
            <div className="param-item">
              <label className="place-input-label" htmlFor="disaster-select">
                Disaster Event Type:
              </label>
              <select
                id="disaster-select"
                className="place-select-input"
                value={disasterType}
                onChange={(e) => setDisasterType(e.target.value)}
              >
                <option value="flood">🌊 River Surge / Inundation Flood</option>
                <option value="cloudburst">🌧️ Cloudburst Torrential Deluge</option>
                <option value="dam_release">🚪 Upstream Barrage / Sluice Discharge</option>
                <option value="heatwave">🔥 Extreme Heatwave Grid Surcharge</option>
                <option value="compound">⚠️ Compound Hydrological Failure</option>
              </select>
            </div>

            <div className="param-item">
              <div className="severity-label-row">
                <label className="place-input-label" htmlFor="severity-range">
                  Hazard Severity Index:
                </label>
                <span className="severity-val-pill">{severity}%</span>
              </div>
              <input
                id="severity-range"
                type="range"
                min="15"
                max="100"
                step="5"
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className="severity-slider"
              />
              <div className="severity-slider-ticks">
                <span>Moderate (30%)</span>
                <span>Critical (75%)</span>
                <span>Max Catastrophic (100%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button Row */}
        <div className="place-sim-actions-row">
          <div className="place-sim-hint">
            Simulation will cascade topological failures across dependent roads, water treatment sumps, and substations.
          </div>
          <button
            type="button"
            className="sim-btn-primary place-execute-btn"
            onClick={handleSimulatePlace}
            disabled={loading || !targetPlace.trim()}
          >
            {loading ? 'Executing Hazard Inflow...' : `⚡ Inject Hazard at "${targetPlace || 'Target'}"`}
          </button>
        </div>
      </div>

      {/* Active Landmark Incident Telemetry & Directive Dossier (if targeted sim active) */}
      {placeSim && (
        <div className="sim-panel-card active-dossier-card">
          <div className="card-header-clean">
            <div>
              <span className="dossier-top-tag">LOCALIZED HAZARD PROFILE</span>
              <h3 className="card-heading">
                Active Stress Incident: {placeSim.place_name || targetPlace}
              </h3>
            </div>
            <span className="card-badge badge-alert">
              {String(placeSim.disaster_type || disasterType).toUpperCase()} • SEVERITY {placeSim.severity || severity}%
            </span>
          </div>

          {placeSim.narrative && (
            <p className="dossier-narrative">{placeSim.narrative}</p>
          )}

          <div className="dossier-grid">
            {/* Breached Chokepoints */}
            <div className="dossier-col">
              <h4 className="dossier-col-title">🚫 Breached Chokepoints & Infrastructure</h4>
              <ul className="dossier-list">
                {(placeSim.chokepoints_breached || ['Primary stormwater drainage sluices', 'Underpass arterial roadway', 'Auxiliary distribution transformers']).map((chk, i) => (
                  <li key={i} className="dossier-list-item breached">
                    <span className="item-icon">✕</span>
                    <span>{chk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Field Directives */}
            <div className="dossier-col">
              <h4 className="dossier-col-title">🛡️ Field Operational Directives</h4>
              <ul className="dossier-list">
                {(placeSim.actionable_directives || ['Deploy mobile dewatering pump trucks', 'Activate traffic diversions to elevated ring road', 'Isolate flood-prone 11kV feeder lines']).map((dir, i) => (
                  <li key={i} className="dossier-list-item directive">
                    <span className="item-icon">✓</span>
                    <span>{dir}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Cascading Pipeline Flowchart */}
      <div className="sim-panel-card">
        <div className="card-header-clean">
          <h3 className="card-heading">Topological Cascade Propagation Stages</h3>
          <span className="card-badge">6-Stage Percolation Engine</span>
        </div>

        <div className="pipeline-stages-grid">
          {pipelineStages.map((stage, idx) => (
            <div key={stage.step} className="pipeline-stage-item">
              <div className="stage-top">
                <span className="stage-num">{stage.step}</span>
                <span className="stage-icon">{stage.icon}</span>
                <span className={`stage-status-pill ${stage.status === 'Triggered' || stage.status === 'Propagated' || stage.status === 'Active' ? 'status-live' : ''}`}>
                  {stage.status}
                </span>
              </div>
              <h4 className="stage-title">{stage.title}</h4>
              <p className="stage-desc">{stage.desc}</p>
              {idx < pipelineStages.length - 1 && <span className="stage-connector">➔</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Impact Matrix & Results */}
      <div className="sim-results-grid">
        {/* Left: Impact Metrics */}
        <div className="sim-panel-card">
          <div className="card-header-clean">
            <h3 className="card-heading">Simulation Impact Assessment</h3>
            <span className={`card-badge ${isSimulated ? 'badge-alert' : 'badge-normal'}`}>
              {isSimulated ? 'HAZARD ACTIVE' : 'BASELINE STABLE'}
            </span>
          </div>

          <div className="impact-metrics-row">
            <div className="impact-stat-box">
              <span className="impact-num text-red">{isSimulated ? failedNodes.length : 0}</span>
              <span className="impact-lbl">Critical Failures</span>
              <span className="impact-sub">Submerged intake sluices</span>
            </div>
            <div className="impact-stat-box">
              <span className="impact-num text-orange">{isSimulated ? affectedNodes.length : 0}</span>
              <span className="impact-lbl">Secondary Impacts</span>
              <span className="impact-sub">Degraded transit links</span>
            </div>
            <div className="impact-stat-box">
              <span className="impact-num text-blue">{isSimulated ? 4 : 1}</span>
              <span className="impact-lbl">Inundated Zones</span>
              <span className="impact-sub">Yamuna floodplain sectors</span>
            </div>
            <div className="impact-stat-box">
              <span className="impact-num text-green">{totalNodes - (isSimulated ? failedNodes.length + affectedNodes.length : 0)}</span>
              <span className="impact-lbl">Operational Assets</span>
              <span className="impact-sub">Online & functioning</span>
            </div>
          </div>

          {/* Highest Risk Highlight */}
          {highestRiskNode && (
            <div
              className="highest-risk-callout"
              onClick={() => onSelectNode(highestRiskNode)}
              role="button"
              tabIndex={0}
            >
              <span className="callout-icon">🚨</span>
              <div className="callout-text">
                <span className="callout-label">HIGHEST CALCULATED RISK BOTTLENECK:</span>
                <strong className="callout-name">{highestRiskNode.name || highestRiskNode.id}</strong>
                <span className="callout-meta">
                  Zone: {highestRiskNode.zone} • Risk Score: {(Number(highestRiskNode.risk_score || highestRiskNode.risk) || 1.19).toFixed(2)}
                </span>
              </div>
              <button type="button" className="callout-inspect-btn">
                Inspect Asset ➔
              </button>
            </div>
          )}
        </div>

        {/* Right: Before vs After Comparison */}
        <div className="sim-panel-card">
          <div className="card-header-clean">
            <h3 className="card-heading">Before vs. After Telemetry</h3>
            <span className="card-badge">Comparative Audit</span>
          </div>

          <table className="sim-comparison-table">
            <thead>
              <tr>
                <th>Telemetry Metric</th>
                <th>Baseline</th>
                <th>Under Cloudburst</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Operational Infrastructure</td>
                <td>108 (100%)</td>
                <td>{isSimulated ? totalNodes - failedNodes.length - affectedNodes.length : 77} (71%)</td>
                <td className="delta-neg">-29%</td>
              </tr>
              <tr>
                <td>Critical Failures</td>
                <td>0</td>
                <td>{isSimulated ? failedNodes.length : 8}</td>
                <td className="delta-neg">+{isSimulated ? failedNodes.length : 8}</td>
              </tr>
              <tr>
                <td>Average Network Risk</td>
                <td>0.34</td>
                <td>{isSimulated ? '0.78' : '0.34'}</td>
                <td className="delta-neg">+{isSimulated ? '0.44' : '0.00'}</td>
              </tr>
              <tr>
                <td>Submerged Roadways</td>
                <td>0 km</td>
                <td>14.6 km</td>
                <td className="delta-neg">+14.6 km</td>
              </tr>
              <tr>
                <td>Safe Evacuation Corridors</td>
                <td>100%</td>
                <td>94.2%</td>
                <td className="delta-warn">Rerouted</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
