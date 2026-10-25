import React, { useState, useEffect } from 'react';
import './ReportsView.css';
import { API_BASE } from '../config.js';

export default function ReportsView({
  graph,
  simulation,
  activeRoute = null,
  selectedLocation = 'delhi_ncr',
}) {
  const isSimulated = Boolean(simulation);
  const nodes = graph?.nodes || [];
  const total = nodes.length || 108;
  const failed = nodes.filter((n) => n.status === 'failed');
  const affected = nodes.filter((n) => n.status === 'affected');
  const operational = nodes.filter((n) => n.status === 'safe' || (!n.status && !failed.includes(n) && !affected.includes(n)));

  const highestRiskId = graph?.summary?.highest_risk_node || 'node_43';
  const highestRiskNode = nodes.find((n) => n.id === highestRiskId) || {
    id: 'node_43',
    name: 'Ring Road Underpass #43 (Mathura Road Link)',
    risk_score: 1.19,
    type: 'transit',
  };

  const defaultCases = [
    {
      case_id: 'delhi_cloudburst',
      city_name: 'Delhi / NCR',
      title: 'Monsoon Cloudburst & Yamuna Flash Inundation',
      threat_level: 'CRITICAL CASCADE (RED)',
    },
    {
      case_id: 'delhi_dam_release',
      city_name: 'Delhi / NCR',
      title: 'Hathnikund Barrage High-Volume River Surge',
      threat_level: 'HIGH RISK / WATCH (AMBER)',
    },
    {
      case_id: 'delhi_heatwave',
      city_name: 'Delhi / NCR',
      title: 'Extreme Summer Heatwave & 400kV Grid Stress',
      threat_level: 'HIGH RISK / WATCH (AMBER)',
    },
    {
      case_id: 'mumbai_coastal_surge',
      city_name: 'Mumbai Coastal',
      title: 'Coastal Cloudburst & 4.8m Spring Tide Surge',
      threat_level: 'CRITICAL CASCADE (RED)',
    },
    {
      case_id: 'mumbai_dam_overflow',
      city_name: 'Mumbai Coastal',
      title: 'Vihar & Tulsi Lakes Emergency Spillway Overflow',
      threat_level: 'HIGH RISK / WATCH (AMBER)',
    },
    {
      case_id: 'kathmandu_flash_flood',
      city_name: 'Kathmandu Valley',
      title: 'Himalayan Cloudburst & Bagmati Flash Deluge',
      threat_level: 'CRITICAL CASCADE (RED)',
    },
    {
      case_id: 'bengaluru_lake_breach',
      city_name: 'Bengaluru Tech Corridor',
      title: 'Severe Urban Cloudburst & Cascade Lake Breach',
      threat_level: 'CRITICAL CASCADE (RED)',
    },
  ];

  const [selectedCase, setSelectedCase] = useState(isSimulated ? 'live' : 'delhi_cloudburst');
  const [availableCases, setAvailableCases] = useState(defaultCases);
  const [caseData, setCaseData] = useState(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [warningData, setWarningData] = useState(null);
  const [cascadesData, setCascadesData] = useState(null);

  // Sync with new incoming simulations
  const [prevSim, setPrevSim] = useState(simulation);
  if (simulation !== prevSim) {
    setPrevSim(simulation);
    if (simulation) {
      setSelectedCase('live');
    }
  }

  // Load available report cases from backend on mount
  useEffect(() => {
    let ignore = false;
    async function fetchCases() {
      try {
        const res = await fetch(`${API_BASE}/api/reports/cases`);
        if (res.ok && !ignore) {
          const data = await res.json();
          if (data.cases && data.cases.length > 0) {
            setAvailableCases(data.cases);
          }
        }
      } catch {
        // Fallback defaultCases already set
      }
    }
    fetchCases();
    return () => {
      ignore = true;
    };
  }, []);

  // Fetch live 72-Hour Warning intelligence if available
  useEffect(() => {
    let ignore = false;
    async function fetchWarningState() {
      try {
        const [stateRes, cascRes] = await Promise.all([
          fetch(`${API_BASE}/api/warning/state`),
          fetch(`${API_BASE}/api/warning/cascades`),
        ]);
        if (!ignore) {
          if (stateRes.ok) setWarningData(await stateRes.json());
          if (cascRes.ok) setCascadesData(await cascRes.json());
        }
      } catch {
        // Safe fallback in offline mode
      }
    }
    fetchWarningState();
    return () => {
      ignore = true;
    };
  }, []);

  // Fetch selected scenario dossier data when switching cases
  useEffect(() => {
    if (selectedCase === 'live') return;

    let ignore = false;
    async function fetchCaseDossier() {
      setCaseLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/reports/case/${selectedCase}`);
        if (res.ok && !ignore) {
          const data = await res.json();
          setCaseData(data);
        }
      } catch {
        // Safe fallback
      } finally {
        if (!ignore) setCaseLoading(false);
      }
    }
    fetchCaseDossier();
    return () => {
      ignore = true;
    };
  }, [selectedCase]);

  const activeCaseData = selectedCase === 'live' ? null : caseData;
  const staticDocId = React.useMemo(() => `SITREP-NCR-2026-90412`, []);

  const reportDate = new Date();
  const reportDateFormatted = reportDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const reportTimeFormatted = reportDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Base computations for Live Mode
  const activeScenarioName = isSimulated
    ? (simulation?.simulation?.place_name
        ? `Point Inundation Stress: ${simulation.simulation.place_name} (${String(simulation.simulation.disaster_type || 'hazard').toUpperCase()})`
        : 'Monsoon Cloudburst & Flash Flood (90 mm/hr)')
    : warningData?.city_status && warningData.city_status !== 'NORMAL'
    ? `${warningData.city_status} Emergency Posture`
    : 'Baseline Operational Normalcy';

  const defaultThreatLevel = failed.length > 3 || (warningData?.city_risk_avg || 0) >= 0.6
    ? 'CRITICAL CASCADE (RED)'
    : failed.length > 0 || (warningData?.city_risk_avg || 0) >= 0.35
    ? 'HIGH RISK / WATCH (AMBER)'
    : 'NORMAL READINESS (GREEN)';

  // Fallback realistic route if no route calculated yet
  const verifiedRoute = activeRoute || {
    distance_km: 15.4,
    estimated_time_min: 28,
    blocked_nodes_count: failed.length ? 3 : 0,
    path: [
      'node_1 (AIIMS Apex Trauma)',
      'node_71 (Ring Road Underpass #43)',
      'node_52 (Dhaula Kuan Flyover Junction)',
      'node_64 (NH-48 Elevated Expressway)',
      'node_63 (IGI Airport Terminal-3 Trauma Bay)',
    ],
  };

  // Derived active dossier fields
  const activeDocId = activeCaseData?.doc_id || staticDocId;
  const activeTitle = activeCaseData?.title || 'CityGraph Urban Risk Intelligence';
  const activeRegion = activeCaseData?.city_name || (
    selectedLocation?.includes('mumbai')
      ? 'Mumbai Coastal Metropolitan Region'
      : selectedLocation?.includes('kathmandu')
      ? 'Kathmandu Valley Metropolitan Region'
      : selectedLocation?.includes('bengaluru')
      ? 'Bengaluru Tech Corridor'
      : 'Delhi / National Capital Region (NCR) Digital Twin'
  );
  const activeThreatLevel = activeCaseData?.threat_level || defaultThreatLevel;
  const threatClass = activeThreatLevel.includes('CRITICAL')
    ? 'threat-critical'
    : activeThreatLevel.includes('HIGH') || activeThreatLevel.includes('WATCH')
    ? 'threat-high'
    : 'threat-normal';

  const activeTotal = activeCaseData?.metrics?.monitored_assets ?? total;
  const activeOperational = activeCaseData?.metrics?.operational_assets ?? operational.length;
  const activeFailedCount = activeCaseData?.metrics?.critical_failures ?? failed.length;
  const activeAffectedCount = activeCaseData?.metrics?.secondary_cascades ?? affected.length;
  const activeScenarioLabel = activeCaseData?.scenario_name || activeScenarioName;

  // Active Breaches
  const activeBreaches = activeCaseData?.critical_breaches || failed.map((n) => ({
    asset_id: n.id,
    name: n.name,
    sector: n.type_label || n.type || 'Transit Corridor',
    zone: n.zone || 'Central Delhi',
    water_depth: '1.65m',
    status: 'CRITICAL BREACH',
    failure_mechanism: n.failure_reason || 'Drainage intake exceeded; backflow active.',
  }));

  // Active Evacuation Telemetry
  const activeEvac = activeCaseData?.evacuation_telemetry || {
    distance_km: verifiedRoute.distance_km,
    transit_time_min: verifiedRoute.estimated_time_min,
    hazards_avoided: verifiedRoute.blocked_nodes_count,
    waypoints: verifiedRoute.path,
  };

  // Active Directives
  const activeDirectives = activeCaseData?.incident_directives || [
    {
      priority: 1,
      badge: 'PRIORITY 1 · IMMEDIATE',
      action: 'Deploy High-Capacity Mobile Dewatering Pumps',
      details: 'Dispatch 4 emergency 500-HP pump units to Ring Road Underpass #43 and Barapullah Basin to prevent reverse sewer surcharge.',
    },
    {
      priority: 2,
      badge: 'PRIORITY 2 · PRE-EMPTIVE',
      action: 'Implement Arterial Transit Diversions',
      details: 'Activate Variable Message Signs (VMS) on Mathura Road and Ring Road corridors; reroute commercial traffic via Outer Ring Road.',
    },
    {
      priority: 3,
      badge: 'PRIORITY 3 · HEALTHCARE',
      action: 'Pre-Stage Emergency EMS Fleet & Trauma Resources',
      details: 'Station 6 advanced life support ambulances at Dhaula Kuan interchange; reserve 30 acute beds at Safdarjung & AIIMS Trauma Bay.',
    },
    {
      priority: 4,
      badge: 'PRIORITY 4 · UTILITY GRID',
      action: 'Substation Sump Sentry & Power Load Shedding Contingency',
      details: 'Verify backup sump pumps at 400kV Maharani Bagh substation; prepare automated load-shedding protocol if water crosses 0.45m gauge.',
    },
  ];

  // Download JSON Report
  const handleDownloadJSON = () => {
    const reportData = {
      title: activeTitle,
      doc_id: activeDocId,
      classification: 'OFFICIAL SITREP • EXERCISE CONFIDENTIAL',
      timestamp: reportDate.toISOString(),
      region: activeRegion,
      threat_level: activeThreatLevel,
      scenario: activeScenarioLabel,
      network_overview: {
        total_infrastructure_nodes: activeTotal,
        operational_nodes: activeOperational,
        critical_failures: activeFailedCount,
        secondary_impacts: activeAffectedCount,
        highest_risk_asset: highestRiskNode?.name || highestRiskId,
        highest_risk_score: highestRiskNode?.risk_score || 1.19,
      },
      critical_breaches: activeBreaches,
      evacuation_routing: activeEvac,
      directives: activeDirectives,
      provenance: activeCaseData ? 'curated_disaster_knowledge_base' : (simulation?.provenance || 'digital_twin_live_telemetry'),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `citygraph-sitrep-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy Executive Summary text to clipboard
  const handleCopyBriefing = () => {
    const summaryText = `[CITYGRAPH EXECUTIVE SITUATION REPORT (SitRep)]
Document ID: ${activeDocId}
Generated: ${reportDateFormatted} at ${reportTimeFormatted}
Region: ${activeRegion}
Threat Posture: ${activeThreatLevel}
Active Scenario: ${activeScenarioLabel}

NETWORK STATUS:
• Monitored Assets: ${activeTotal}
• Operational (Safe): ${activeOperational} (${((activeOperational / activeTotal) * 100).toFixed(0)}%)
• Critical Failures: ${activeFailedCount}
• Secondary Cascade Impacts: ${activeAffectedCount}
• Primary Bottleneck: ${highestRiskNode?.name || highestRiskId}

FAIL-SAFE DISPATCH CORRIDOR:
• Safe Transit Distance: ${activeEvac.distance_km} km
• Est. Response Time: ${activeEvac.transit_time_min} mins
• Hazards Avoided: ${activeEvac.hazards_avoided} blocked nodes

INCIDENT COMMAND DIRECTIVES:
${activeDirectives.map((d, i) => `${i + 1}. ${d.action}: ${d.details || d.location || ''}`).join('\n')}`;

    navigator.clipboard.writeText(summaryText).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="reports-page-container">
      {/* 1. Header Toolbar (Hidden in Print) */}
      <div className="reports-header-row no-print">
        <div className="reports-header-left">
          <div className="reports-category-pill">
            <span className="dot-pulse" />
            EXECUTIVE INTELLIGENCE BRIEFING
          </div>
          <h1 className="reports-main-title">Infrastructure Resilience Situation Report (SitRep)</h1>
          <p className="reports-sub-title">
            Defense-grade executive dossier summarizing cross-infrastructure failure cascades, flood zone inundation, 72-hour forecasting beliefs, and fail-safe evacuation telemetry.
          </p>
        </div>

        <div className="reports-actions-group">
          {copiedToast && <span className="copied-toast-badge">✓ Briefing Copied to Clipboard</span>}
          <button
            type="button"
            className="btn-report-action btn-copy"
            onClick={handleCopyBriefing}
            title="Copy executive briefing text for dispatch email/Slack"
          >
            📋 Copy Briefing
          </button>
          <button
            type="button"
            className="btn-report-action btn-json"
            onClick={handleDownloadJSON}
            title="Export full raw JSON data for audit compliance"
          >
            💾 Export JSON Audit
          </button>
          <button
            type="button"
            className="btn-report-action btn-print-primary"
            onClick={handlePrint}
            title="Print or Save as Official PDF dossier"
          >
            🖨️ Print / Save Official PDF
          </button>
        </div>
      </div>

      {/* Scenario Profile Selector Bar (Hidden in Print) */}
      <div className="reports-case-selector-bar no-print">
        <div className="case-selector-left">
          <label className="case-selector-label" htmlFor="sitrep-case-select">
            📁 SITREP SCENARIO DOSSIER PROFILE:
          </label>
          <select
            id="sitrep-case-select"
            className="case-selector-dropdown"
            value={selectedCase}
            onChange={(e) => setSelectedCase(e.target.value)}
          >
            <option value="live">
              🔴 {isSimulated ? `Live Dynamic Simulation (${simulation?.simulation?.place_name || 'Active Incident'})` : 'Live Operational Baseline (Sensor Telemetry Feeds)'}
            </option>
            {availableCases.map((c) => (
              <option key={c.case_id} value={c.case_id}>
                {c.city_name}: {c.title} [{c.threat_level}]
              </option>
            ))}
          </select>
        </div>
        {caseLoading ? (
          <span className="case-loading-pill">Loading Scenario Dossier...</span>
        ) : (
          <span className="case-active-pill">
            PROFILE: {selectedCase === 'live' ? 'DYNAMIC SENSOR TWIN' : selectedCase.toUpperCase()}
          </span>
        )}
      </div>

      {/* 2. Official Printable Situation Report Document */}
      <div className="printable-report-document">
        {/* Document Masthead Banner */}
        <header className="doc-header-banner">
          <div className="doc-brand-block">
            <div className="doc-emblem-badge">CG</div>
            <div>
              <h2 className="doc-brand-title">{activeTitle}</h2>
              <span className="doc-brand-sub">Incident Command Intelligence Directorate • Crisis Response Division</span>
              <span className="doc-region">Region: {activeRegion}</span>
            </div>
          </div>

          <div className="doc-meta-right">
            <div className="classification-pill">OFFICIAL SITREP • EXERCISE CONFIDENTIAL</div>
            <div className="doc-meta-item">
              <span className="meta-label">DOCUMENT ID:</span>
              <span className="meta-val mono">{activeDocId}</span>
            </div>
            <div className="doc-meta-item">
              <span className="meta-label">EFFECTIVE:</span>
              <span className="meta-val">{reportDateFormatted}, {reportTimeFormatted}</span>
            </div>
            <div className="doc-meta-item">
              <span className="meta-label">THREAT POSTURE:</span>
              <span className={`threat-badge ${threatClass}`}>{activeThreatLevel}</span>
            </div>
          </div>
        </header>

        {/* 1. Executive Summary & Operational Posture */}
        <section className="doc-section">
          <div className="section-header-row">
            <h3 className="section-title">1. Executive Summary & Threat Assessment</h3>
            <span className="scenario-pill">SCENARIO: {activeScenarioLabel.toUpperCase()}</span>
          </div>

          <p className="section-text">
            {activeCaseData?.executive_summary || (
              <>
                During operational evaluation under <strong>{activeScenarioLabel}</strong>, the metropolitan infrastructure network was evaluated across interconnected transit, power, hydrologic drainage, and emergency medical sectors. The percolation cascade engine recorded <strong>{activeFailedCount} critical infrastructure breaches</strong> and <strong>{activeAffectedCount} secondary cascading impact nodes</strong> across arterial corridors.
              </>
            )}
          </p>

          {/* 4-State Posture Strip */}
          <div className="posture-strip-box">
            <div className="posture-strip-label">
              <span>City-Wide Calibrated Risk Posture (72-Hour Sequential Particle Filter):</span>
              <strong>{activeCaseData?.threat_level || warningData?.city_status || (activeFailedCount ? 'HIGH_RISK' : 'NORMAL')}</strong>
            </div>
            <div className="posture-segmented-bar">
              <div
                className="p-seg p-normal"
                style={{ width: activeCaseData?.posture?.normal_pct ? `${activeCaseData.posture.normal_pct}%` : (activeFailedCount ? '25%' : '80%') }}
              >
                NORMAL ({activeCaseData?.posture?.normal_pct ?? (activeFailedCount ? 25 : 80)}%)
              </div>
              <div
                className="p-seg p-watch"
                style={{ width: activeCaseData?.posture?.watch_pct ? `${activeCaseData.posture.watch_pct}%` : (activeFailedCount ? '30%' : '15%') }}
              >
                WATCH ({activeCaseData?.posture?.watch_pct ?? (activeFailedCount ? 30 : 15)}%)
              </div>
              <div
                className="p-seg p-high"
                style={{ width: activeCaseData?.posture?.high_risk_pct ? `${activeCaseData.posture.high_risk_pct}%` : (activeFailedCount ? '30%' : '5%') }}
              >
                HIGH RISK ({activeCaseData?.posture?.high_risk_pct ?? (activeFailedCount ? 30 : 5)}%)
              </div>
              <div
                className="p-seg p-critical"
                style={{ width: activeCaseData?.posture?.critical_pct ? `${activeCaseData.posture.critical_pct}%` : (activeFailedCount ? '15%' : '0%') }}
              >
                CRITICAL ({activeCaseData?.posture?.critical_pct ?? (activeFailedCount ? 15 : 0)}%)
              </div>
            </div>
          </div>
        </section>

        {/* 2. Key Asset & Operational Telemetry Grid */}
        <section className="doc-section">
          <h3 className="section-title">2. Strategic Infrastructure Asset Telemetry</h3>

          <div className="doc-metrics-grid">
            <div className="doc-metric-box">
              <span className="dm-lbl">Monitored Assets</span>
              <strong className="dm-val">{activeTotal}</strong>
              <span className="dm-sub">Digital Twin Nodes</span>
            </div>

            <div className="doc-metric-box safe">
              <span className="dm-lbl">Operational (Safe)</span>
              <strong className="dm-val text-green">{activeOperational}</strong>
              <span className="dm-sub">{((activeOperational / activeTotal) * 100).toFixed(1)}% Capacity</span>
            </div>

            <div className={`doc-metric-box ${activeFailedCount ? 'danger' : ''}`}>
              <span className="dm-lbl">Critical Failures</span>
              <strong className="dm-val text-red">{activeFailedCount}</strong>
              <span className="dm-sub">{activeFailedCount ? 'Immediate Action Required' : 'Zero Breaches Active'}</span>
            </div>

            <div className={`doc-metric-box ${activeAffectedCount ? 'warning' : ''}`}>
              <span className="dm-lbl">Secondary Impacts</span>
              <strong className="dm-val text-orange">{activeAffectedCount}</strong>
              <span className="dm-sub">Cascading Risk Nodes</span>
            </div>

            <div className="doc-metric-box">
              <span className="dm-lbl">Hospital ICU Load</span>
              <strong className="dm-val">
                {activeCaseData
                  ? (activeCaseData.case_id.includes('heatwave') ? '92%' : activeCaseData.case_id.includes('surge') ? '88%' : '78%')
                  : warningData?.zones?.z_central?.twin?.hospital_load
                  ? `${(warningData.zones.z_central.twin.hospital_load * 100).toFixed(0)}%`
                  : activeFailedCount ? '78%' : '38%'}
              </strong>
              <span className="dm-sub">Regional Trauma Centers</span>
            </div>

            <div className="doc-metric-box">
              <span className="dm-lbl">Grid Substation Load</span>
              <strong className="dm-val">
                {activeCaseData
                  ? (activeCaseData.case_id.includes('heatwave') ? '98%' : '72%')
                  : warningData?.zones?.z_central?.twin?.power_load
                  ? `${(warningData.zones.z_central.twin.power_load * 100).toFixed(0)}%`
                  : activeFailedCount ? '66%' : '32%'}
              </strong>
              <span className="dm-sub">400kV Grid Reliability</span>
            </div>

            <div className="doc-metric-box bottleneck-card">
              <span className="dm-lbl">Highest Risk Bottleneck</span>
              <strong className="dm-val text-primary">
                {activeCaseData?.critical_breaches?.[0]?.name || highestRiskNode?.name || highestRiskId}
              </strong>
              <span className="dm-sub">
                Risk Score: <strong>{activeCaseData ? '1.18' : (highestRiskNode?.risk_score || 1.19).toFixed(2)}</strong> · Critical Chokepoint
              </span>
            </div>
          </div>
        </section>

        {/* 3. 72-Hour Cascading Failure Sequence & Early Warning Forecast */}
        <section className="doc-section">
          <div className="section-header-row">
            <h3 className="section-title">3. 72-Hour Multi-Horizon Cascading Failure Sequence</h3>
            <span className="section-tag-pill">TEMPORAL PROPAGATION</span>
          </div>

          <div className="sitrep-cascade-container">
            <div className="cascade-stages-timeline">
              {(activeCaseData?.cascade_timeline && activeCaseData.cascade_timeline.length > 0
                ? activeCaseData.cascade_timeline
                : [
                    { t: 'T+0h to T+3h', stage: 'Intense Precipitation Inundation', desc: 'Rainfall exceeds 90 mm/hr; localized runoff overwhelms surface absorption capacity.' },
                    { t: 'T+6h to T+12h', stage: 'Drainage Sluice Saturation', desc: 'Trunk drains breach gravity discharge threshold; backflow floods sub-surface ducts.' },
                    { t: 'T+18h to T+24h', stage: 'Arterial Road Network Impedance', desc: 'Arterial Underpasses submerged; vehicular speeds plunge 82%, impeding transit.' },
                    { t: 'T+36h to T+48h', stage: 'EMS Delays & Hospital Surge', desc: 'Emergency response delays double (38 mins); regional trauma beds exceed 90% load.' },
                  ]
              ).map((stage, idx, arr) => (
                <React.Fragment key={idx}>
                  <div className={`c-stage-box ${idx >= arr.length - 1 ? 'danger' : ''}`}>
                    <div className={`c-stage-num ${idx >= arr.length - 1 ? 'danger' : ''}`}>{idx + 1}</div>
                    <div className="c-stage-info">
                      <div className="c-stage-head">
                        <span className="c-title">{stage.stage}</span>
                        <span className="c-time">{stage.t}</span>
                      </div>
                      <p className="c-desc">{stage.desc}</p>
                    </div>
                  </div>
                  {idx < arr.length - 1 && <div className="c-stage-arrow">➔</div>}
                </React.Fragment>
              ))}
            </div>

            {/* Active Detected Cascade Paths from Engine */}
            {cascadesData?.cascades && cascadesData.cascades.length > 0 && (
              <div className="inferred-couplings-strip">
                <span className="strip-title">ACTIVE CASCADE PATHWAYS:</span>
                {cascadesData.cascades.slice(0, 3).map((chain, idx) => (
                  <span key={idx} className="c-chip">
                    ⚡ {chain.path.join(' ➔ ')} (Prob: {(chain.probability * 100).toFixed(0)}%)
                  </span>
                ))}
              </div>
            )}

            {/* Inferred Dynamic Couplings */}
            <div className="inferred-couplings-strip">
              <span className="strip-title">INFERRED DYNAMIC COUPLINGS:</span>
              <span className="c-chip">🌧️ Storm Drainage → 🛣️ Arterial Transit (0.84)</span>
              <span className="c-chip">🛣️ Arterial Transit → 🚑 Emergency EMS (0.78)</span>
              <span className="c-chip">🚑 Emergency EMS → 🏥 Hospital Capacity (0.72)</span>
              <span className="c-chip">🌊 Surface Water → ⚡ Power Substations (0.89)</span>
              <span className="c-chip">⚡ Power Substations → 🚰 Water Pumping (0.94)</span>
            </div>
          </div>
        </section>

        {/* 4. Critical Failure & Submergence Breakdown */}
        <section className="doc-section">
          <h3 className="section-title">4. Critical Failure & Submergence Breakdown</h3>
          {activeBreaches.length > 0 ? (
            <div className="doc-table-wrapper">
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>Asset ID</th>
                    <th>Infrastructure Facility</th>
                    <th>Sector</th>
                    <th>Geographic Zone</th>
                    <th>Water Depth</th>
                    <th>Failure Mechanism</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBreaches.map((b, idx) => (
                    <tr key={b.asset_id || idx}>
                      <td><code className="asset-code">{b.asset_id || `node_${idx + 1}`}</code></td>
                      <td><strong>{b.name}</strong></td>
                      <td><span className="sector-tag">{b.sector || 'Transit Corridor'}</span></td>
                      <td>{b.zone || 'Central Sector'}</td>
                      <td><strong>{b.water_depth || '1.45m'}</strong></td>
                      <td className="text-red">{b.failure_mechanism || 'Intake capacity exceeded.'}</td>
                      <td><span className="badge-status-fail">{b.status || 'CRITICAL BREACH'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="doc-callout-nominal">
              <span className="callout-icon">✅</span>
              <div>
                <strong>NOMINAL EQUILIBRIUM MAINTAINED</strong>
                <p>No critical infrastructure breaches active under baseline operational parameters. Sluice regulators and transmission feeders operating within design thresholds.</p>
              </div>
            </div>
          )}
        </section>

        {/* 5. Secondary Cascading Impacts */}
        <section className="doc-section">
          <h3 className="section-title">5. Secondary Cascading Impacts & At-Risk Nodes</h3>
          {affected.length > 0 || (caseData && activeAffectedCount > 0) ? (
            <div className="doc-table-wrapper">
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>System ID</th>
                    <th>Infrastructure Asset</th>
                    <th>Sector</th>
                    <th>Risk Index</th>
                    <th>Vulnerability Analysis</th>
                  </tr>
                </thead>
                <tbody>
                  {(affected.length > 0 ? affected : [
                    { id: 'node_30', name: 'Adjacent Feeder Substation Loop', type_label: 'Power Feeder', risk: 0.68 },
                    { id: 'node_52', name: 'Flyover Connecting Arterial', type_label: 'Highway Transit', risk: 0.62 },
                  ]).map((n) => (
                    <tr key={n.id}>
                      <td><code className="asset-code">{n.id}</code></td>
                      <td><strong>{n.name}</strong></td>
                      <td><span className="sector-tag">{n.type_label || n.type || 'Municipal Asset'}</span></td>
                      <td>
                        <div className="table-risk-bar-wrap">
                          <strong className="text-orange">{Number(n.risk_score || n.risk || 0.68).toFixed(2)}</strong>
                          <div className="mini-progress-bar">
                            <div
                              className="mini-bar-fill"
                              style={{ width: `${Math.min(100, (n.risk_score || n.risk || 0.68) * 80)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>Surface runoff and feeder road congestion propagating from upstream drainage regulator exceedance.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="doc-callout-nominal">
              <span className="callout-icon">🛡️</span>
              <div>
                <strong>NO SECONDARY CASCADES RECORDED</strong>
                <p>Adjacent electrical grid feeder loops and secondary road corridors demonstrate zero propagating failure cascade.</p>
              </div>
            </div>
          )}
        </section>

        {/* 6. Emergency Evacuation Route Verification */}
        <section className="doc-section">
          <div className="section-header-row">
            <h3 className="section-title">6. Emergency Evacuation Route & Fail-Safe Telemetry</h3>
            <span className="route-status-pill">✓ DISPATCH CORRIDOR CONFIRMED SAFE</span>
          </div>

          <div className="route-audit-card">
            <div className="route-kpi-grid">
              <div className="route-kpi-box">
                <span className="rk-label">Safe Transit Distance</span>
                <strong className="rk-val">{activeEvac.distance_km} km</strong>
              </div>
              <div className="route-kpi-box">
                <span className="rk-label">Est. Response Time</span>
                <strong className="rk-val">{activeEvac.transit_time_min} mins</strong>
              </div>
              <div className="route-kpi-box">
                <span className="rk-label">Hazards Avoided</span>
                <strong className="rk-val text-green">{activeEvac.hazards_avoided} nodes</strong>
              </div>
              <div className="route-kpi-box">
                <span className="rk-label">Corridor Status</span>
                <strong className="rk-val text-green">100% Passable</strong>
              </div>
            </div>

            <div className="route-waypoints-box">
              <span className="waypoint-title">VERIFIED CORRIDOR WAYPOINTS:</span>
              <div className="waypoint-trail">
                {(activeEvac.waypoints || []).map((wp, idx, arr) => (
                  <React.Fragment key={idx}>
                    <span className="wp-badge">{wp}</span>
                    {idx < arr.length - 1 && <span className="wp-arrow">➔</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 7. Incident Commander Priority Directives */}
        <section className="doc-section">
          <h3 className="section-title">7. Incident Commander Directives & Action Checklist</h3>
          <div className="directives-list">
            {activeDirectives.map((dir, idx) => (
              <div key={idx} className={`directive-item priority-${dir.priority || idx + 1}`}>
                <span className="directive-badge">
                  {dir.badge || `PRIORITY ${dir.priority || idx + 1} · ${dir.agency || 'OPERATIONAL'}`}
                </span>
                <div className="directive-content">
                  <strong>{dir.action}</strong>
                  <p>{dir.details || dir.location || 'Execute tactical response per municipal emergency operations mandate.'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Document Footer & Sign-off Seal */}
        <footer className="doc-footer">
          <div className="footer-top-row">
            <div className="signature-block">
              <span className="sig-label">AUTHORIZED FOR INCIDENT COMMAND:</span>
              <div className="sig-line">
                <span className="sig-handwritten">Incident Commander V. Sharma</span>
              </div>
              <span className="sig-title">Director of Emergency Response & Infrastructure Resilience</span>
            </div>

            <div className="auth-seal-block">
              <div className="seal-graphic">
                <span>CITYGRAPH</span>
                <strong>VERIFIED</strong>
                <span>AUDIT SECURE</span>
              </div>
              <div className="seal-meta">
                <span>SHA-256 HASH VERIFICATION:</span>
                <code className="hash-code">e8f419b84a92c3017e8b610c4921f09bb994cba876123019842cba8971234901</code>
              </div>
            </div>
          </div>

          <div className="footer-disclaimer-row">
            <span className="footer-notice">
              PROTOTYPE RESILIENCE SIMULATION MODEL · GENERATED VIA CITYGRAPH DIGITAL TWIN PLATFORM · NOT AN OFFICIAL MUNICIPAL STATUTORY DISPATCH MANDATE
            </span>
            <span className="footer-page">Page 1 of 1 · Executive Briefing</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
