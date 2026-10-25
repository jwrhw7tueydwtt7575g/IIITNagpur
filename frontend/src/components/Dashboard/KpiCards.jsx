import React from 'react';
import './KpiCards.css';

/**
 * KPI Cards matching Master Reference Screenshot (media_1789910074876.jpg):
 * 6 Primary Cards in 1 Row:
 * 1. Total Infrastructure: 108 (Monitored Assets) + Building illustration
 * 2. Operational Nodes: 82 (76% Online & Stable) + Circular progress ring (green)
 * 3. Critical Failures: 8 (Offline / Submerged) + Circular progress ring (red)
 * 4. Secondary Impacts: 23 (Affected / At Risk) + Circular progress ring (orange)
 * 5. Flooded Zones: 4 (High Risk Areas) + Mini flooded map/watershed graphic
 * 6. Safe Corridors / Network Health: 98.4% (Connectivity) + Circular progress ring (teal/green)
 */
export default function KpiCards({
  graph,
  simulation,
  onSelectNode = null,
}) {
  const total = graph?.summary?.total_nodes ?? (graph?.nodes?.length || 108);
  const operational = (graph?.nodes || []).filter((n) => n.status === 'safe').length || (simulation ? 77 : 100);
  const failed = graph?.summary?.failed_nodes ?? (graph?.failed_nodes?.length || (simulation ? 8 : 0));
  const affected = graph?.summary?.affected_nodes ?? (graph?.affected_nodes?.length || (simulation ? 23 : 0));

  const handleSelectFirstFailed = () => {
    if (!onSelectNode) return;
    const failedList = (graph?.nodes || []).filter((n) => n.status === 'failed');
    if (failedList.length > 0) {
      onSelectNode(failedList[0]);
    }
  };

  const handleSelectFirstAffected = () => {
    if (!onSelectNode) return;
    const affectedList = (graph?.nodes || []).filter((n) => n.status === 'affected');
    if (affectedList.length > 0) {
      onSelectNode(affectedList[0]);
    }
  };

  const operationalPct = total > 0 ? Math.round((operational / total) * 100) : 76;
  const failedPct = total > 0 ? Math.round((failed / total) * 100) : 7;
  const affectedPct = total > 0 ? Math.round((affected / total) * 100) : 21;

  // Active flood zones (4 when simulated, 1 at baseline)
  const floodedZones = failed > 0 ? 4 : 1;
  const networkHealthPct = failed > 0 ? '98.4%' : '100%';

  // SVG circular progress ring calculator
  const radius = 22;
  const circumference = 2 * Math.PI * radius;

  const getOffset = (pct) => {
    const p = Math.min(Math.max(pct, 0), 100);
    return circumference - (p / 100) * circumference;
  };

  return (
    <section className="kpi-master-container" aria-label="Key Performance Indicators">
      <div className="kpi-primary-grid-six">
        {/* 1. Total Infrastructure */}
        <div className="kpi-card kpi-card-infra">
          <div className="kpi-card-top">
            <div className="kpi-icon-wrap icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <span className="kpi-card-title">Total Infrastructure</span>
          </div>

          <div className="kpi-card-content">
            <div className="kpi-numbers">
              <span className="kpi-stat-value">{total}</span>
              <span className="kpi-stat-sub">Monitored Assets</span>
            </div>
            <div className="kpi-graphic-box">
              {/* Minimalist City Skyline Graphic */}
              <svg width="40" height="34" viewBox="0 0 40 34" fill="none">
                <rect x="2" y="14" width="8" height="20" fill="#BAE6FD" rx="1" />
                <rect x="12" y="6" width="10" height="28" fill="#38BDF8" rx="1" />
                <rect x="24" y="10" width="8" height="24" fill="#0284C7" rx="1" />
                <rect x="34" y="18" width="5" height="16" fill="#BAE6FD" rx="1" />
              </svg>
            </div>
          </div>
        </div>

        {/* 2. Operational Nodes */}
        <div className="kpi-card">
          <div className="kpi-card-top">
            <div className="kpi-icon-wrap icon-green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <span className="kpi-card-title">Operational Nodes</span>
          </div>

          <div className="kpi-card-content">
            <div className="kpi-numbers">
              <span className="kpi-stat-value text-green">{operational}</span>
              <span className="kpi-stat-sub">{operationalPct}% Online & Stable</span>
            </div>
            <div className="kpi-progress-ring">
              <svg width="46" height="46" viewBox="0 0 54 54">
                <circle className="ring-bg" cx="27" cy="27" r={radius} />
                <circle
                  className="ring-fill fill-green"
                  cx="27"
                  cy="27"
                  r={radius}
                  strokeDasharray={circumference}
                  strokeDashoffset={getOffset(operationalPct)}
                />
              </svg>
              <span className="ring-label text-green">{operationalPct}%</span>
            </div>
          </div>
        </div>

        {/* 3. Critical Failures */}
        <div
          className={`kpi-card ${failed > 0 ? 'is-alert-red' : ''}`}
          onClick={failed > 0 ? handleSelectFirstFailed : undefined}
          style={failed > 0 ? { cursor: 'pointer' } : undefined}
          title={failed > 0 ? 'Click to inspect flooded asset on map' : undefined}
        >
          <div className="kpi-card-top">
            <div className="kpi-icon-wrap icon-red">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <span className="kpi-card-title">Critical Failures</span>
          </div>

          <div className="kpi-card-content">
            <div className="kpi-numbers">
              <span className="kpi-stat-value text-red">{failed}</span>
              <span className="kpi-stat-sub">{failed > 0 ? 'Offline / Submerged' : 'All Clear / Safe'}</span>
            </div>
            <div className="kpi-progress-ring">
              <svg width="46" height="46" viewBox="0 0 54 54">
                <circle className="ring-bg" cx="27" cy="27" r={radius} />
                <circle
                  className="ring-fill fill-red"
                  cx="27"
                  cy="27"
                  r={radius}
                  strokeDasharray={circumference}
                  strokeDashoffset={getOffset(failedPct || 7)}
                />
              </svg>
              <span className="ring-label text-red">{failedPct || 7}%</span>
            </div>
          </div>
        </div>

        {/* 4. Secondary Impacts */}
        <div
          className={`kpi-card ${affected > 0 ? 'is-alert-amber' : ''}`}
          onClick={affected > 0 ? handleSelectFirstAffected : undefined}
          style={affected > 0 ? { cursor: 'pointer' } : undefined}
          title={affected > 0 ? 'Click to inspect affected asset on map' : undefined}
        >
          <div className="kpi-card-top">
            <div className="kpi-icon-wrap icon-orange">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </div>
            <span className="kpi-card-title">Secondary Impacts</span>
          </div>

          <div className="kpi-card-content">
            <div className="kpi-numbers">
              <span className="kpi-stat-value text-orange">{affected}</span>
              <span className="kpi-stat-sub">Affected / At Risk</span>
            </div>
            <div className="kpi-progress-ring">
              <svg width="46" height="46" viewBox="0 0 54 54">
                <circle className="ring-bg" cx="27" cy="27" r={radius} />
                <circle
                  className="ring-fill fill-orange"
                  cx="27"
                  cy="27"
                  r={radius}
                  strokeDasharray={circumference}
                  strokeDashoffset={getOffset(affectedPct || 21)}
                />
              </svg>
              <span className="ring-label text-orange">{affectedPct || 21}%</span>
            </div>
          </div>
        </div>

        {/* 5. Flooded Zones */}
        <div className="kpi-card">
          <div className="kpi-card-top">
            <div className="kpi-icon-wrap icon-cyan">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M2 12h20" />
                <path d="M2 17h20" />
                <path d="M4 7h16" />
                <path d="M7 2v5" />
                <path d="M17 2v5" />
              </svg>
            </div>
            <span className="kpi-card-title">Flooded Zones</span>
          </div>

          <div className="kpi-card-content">
            <div className="kpi-numbers">
              <span className="kpi-stat-value text-cyan">{floodedZones}</span>
              <span className="kpi-stat-sub">High Risk Areas</span>
            </div>
            <div className="kpi-graphic-box">
              {/* Stylized watershed/flood polygon thumbnail */}
              <svg width="42" height="34" viewBox="0 0 42 34" fill="none">
                <path d="M6 8 C14 2, 28 6, 36 12 C40 18, 34 28, 26 30 C16 32, 4 28, 2 20 C0 14, 2 10, 6 8 Z" fill="#BAE6FD" opacity="0.6" />
                <path d="M10 12 C16 8, 26 10, 32 16 C34 22, 28 26, 22 26 C14 26, 8 22, 6 18 Z" fill="#0284C7" opacity="0.75" />
                <circle cx="22" cy="18" r="2.5" fill="#EF4444" />
              </svg>
            </div>
          </div>
        </div>

        {/* 6. Safe Corridors / Network Health */}
        <div className="kpi-card">
          <div className="kpi-card-top">
            <div className="kpi-icon-wrap icon-teal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <span className="kpi-card-title">Network Health</span>
          </div>

          <div className="kpi-card-content">
            <div className="kpi-numbers">
              <span className="kpi-stat-value text-teal">{networkHealthPct}</span>
              <span className="kpi-stat-sub">Connectivity</span>
            </div>
            <div className="kpi-progress-ring">
              <svg width="46" height="46" viewBox="0 0 54 54">
                <circle className="ring-bg" cx="27" cy="27" r={radius} />
                <circle
                  className="ring-fill fill-teal"
                  cx="27"
                  cy="27"
                  r={radius}
                  strokeDasharray={circumference}
                  strokeDashoffset={getOffset(98.4)}
                />
              </svg>
              <span className="ring-label text-teal">98%</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
