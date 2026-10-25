import React, { useMemo } from 'react';
import './RiskAnalysisView.css';

export default function RiskAnalysisView({
  graph,
  simulation,
  onSelectNode = () => {},
  onNavigateToMap = () => {},
}) {
  const nodes = useMemo(() => graph?.nodes || [], [graph?.nodes]);
  const total = nodes.length || 108;

  // Derive risk statistics from backend state
  const riskStats = useMemo(() => {
    let severe = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let sumRisk = 0;

    nodes.forEach((n) => {
      const r = Number(n.risk_score || n.risk || 0);
      sumRisk += r;
      if (r >= 1.0) severe++;
      else if (r >= 0.7) high++;
      else if (r >= 0.4) medium++;
      else low++;
    });

    const avgRisk = total > 0 ? (sumRisk / total).toFixed(2) : '0.45';

    return { severe, high, medium, low, avgRisk };
  }, [nodes, total]);

  // Risk by Infrastructure Type
  const riskByType = useMemo(() => {
    const map = {};
    nodes.forEach((n) => {
      const t = n.type_label || n.type || 'road';
      if (!map[t]) map[t] = { count: 0, sumRisk: 0, failedCount: 0 };
      map[t].count++;
      map[t].sumRisk += Number(n.risk_score || n.risk || 0);
      if (n.status === 'failed') map[t].failedCount++;
    });

    return Object.keys(map).map((k) => ({
      type: k,
      count: map[k].count,
      avgRisk: (map[k].sumRisk / map[k].count).toFixed(2),
      failedCount: map[k].failedCount,
    })).sort((a, b) => b.avgRisk - a.avgRisk);
  }, [nodes]);

  // Risk by Zone
  const riskByZone = useMemo(() => {
    const map = {};
    nodes.forEach((n) => {
      const z = n.zone || 'Central Delhi';
      if (!map[z]) map[z] = { count: 0, sumRisk: 0, failedCount: 0 };
      map[z].count++;
      map[z].sumRisk += Number(n.risk_score || n.risk || 0);
      if (n.status === 'failed') map[z].failedCount++;
    });

    return Object.keys(map).map((k) => ({
      zone: k,
      count: map[k].count,
      avgRisk: (map[k].sumRisk / map[k].count).toFixed(2),
      failedCount: map[k].failedCount,
    })).sort((a, b) => b.avgRisk - a.avgRisk);
  }, [nodes]);

  // Top 10 High-Risk Assets Leaderboard
  const topRiskAssets = useMemo(() => {
    return [...nodes]
      .sort((a, b) => Number(b.risk_score || b.risk || 0) - Number(a.risk_score || a.risk || 0))
      .slice(0, 10);
  }, [nodes]);

  const handleAssetClick = (asset) => {
    onSelectNode(asset);
    onNavigateToMap();
  };

  return (
    <div className="risk-page-container">
      {/* Page Header */}
      <div className="risk-header-row">
        <div>
          <span className="risk-category-tag">VULNERABILITY INTELLIGENCE</span>
          <h1 className="risk-main-title">Urban Risk & Criticality Analysis</h1>
          <p className="risk-sub-title">
            Quantitative percolation modeling, topological bottlenecks, and cascading vulnerability indices across the metropolitan grid.
          </p>
        </div>
        <div className="risk-header-badge">
          <span className={`risk-scenario-pill ${simulation ? 'simulated' : 'baseline'}`}>
            {simulation ? '🌧️ Monsoon Cloudburst Active' : '🏛️ Baseline Operations (Nominal)'}
          </span>
        </div>
      </div>

      {/* Top 4 Metric KPI Cards */}
      <div className="risk-kpi-grid">
        <div className="risk-metric-card">
          <div className="rm-header">
            <span className="rm-lbl">Average Network Risk</span>
            <span className="rm-badge">Grid Wide</span>
          </div>
          <span className="rm-number text-blue">{riskStats.avgRisk} / 1.00</span>
          <span className="rm-sub">Calculated via percolation load</span>
        </div>

        <div className="risk-metric-card">
          <div className="rm-header">
            <span className="rm-lbl">Severe Risk Nodes</span>
            <span className="rm-badge badge-red">&ge; 1.00 Index</span>
          </div>
          <span className="rm-number text-red">{riskStats.severe}</span>
          <span className="rm-sub">Imminent or active failure state</span>
        </div>

        <div className="risk-metric-card">
          <div className="rm-header">
            <span className="rm-lbl">Elevated / High Risk</span>
            <span className="rm-badge badge-orange">0.70 - 0.99</span>
          </div>
          <span className="rm-number text-orange">{riskStats.high}</span>
          <span className="rm-sub">At-risk adjacent corridors</span>
        </div>

        <div className="risk-metric-card">
          <div className="rm-header">
            <span className="rm-lbl">Nominal Baseline Nodes</span>
            <span className="rm-badge badge-green">&lt; 0.40</span>
          </div>
          <span className="rm-number text-green">{riskStats.low}</span>
          <span className="rm-sub">Optimal operational resilience</span>
        </div>
      </div>

      {/* Middle Grid: Risk by Sector & Risk by Zone */}
      <div className="risk-charts-grid">
        {/* Risk by Sector */}
        <div className="risk-chart-panel">
          <div className="panel-title-row">
            <h3 className="panel-heading">Vulnerability by Infrastructure Sector</h3>
            <span className="panel-tag">Backend Aggregated</span>
          </div>
          <div className="sector-bars-list">
            {riskByType.map((item) => (
              <div key={item.type} className="sector-bar-row">
                <div className="s-info">
                  <span className="s-name">{item.type}</span>
                  <span className="s-score">Risk {item.avgRisk} ({item.count} assets)</span>
                </div>
                <div className="s-track">
                  <div
                    className={`s-fill ${Number(item.avgRisk) >= 0.8 ? 'fill-red' : Number(item.avgRisk) >= 0.5 ? 'fill-orange' : 'fill-green'}`}
                    style={{ width: `${Math.min(Number(item.avgRisk) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk by Zone */}
        <div className="risk-chart-panel">
          <div className="panel-title-row">
            <h3 className="panel-heading">Vulnerability by Geographic Zone</h3>
            <span className="panel-tag">Regional Distribution</span>
          </div>
          <div className="sector-bars-list">
            {riskByZone.slice(0, 7).map((item) => (
              <div key={item.zone} className="sector-bar-row">
                <div className="s-info">
                  <span className="s-name">{item.zone}</span>
                  <span className="s-score">Avg Risk {item.avgRisk}</span>
                </div>
                <div className="s-track">
                  <div
                    className={`s-fill ${Number(item.avgRisk) >= 0.8 ? 'fill-red' : Number(item.avgRisk) >= 0.5 ? 'fill-orange' : 'fill-blue'}`}
                    style={{ width: `${Math.min(Number(item.avgRisk) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Risk Assets Leaderboard Table */}
      <div className="risk-leaderboard-panel">
        <div className="panel-title-row">
          <div>
            <h3 className="panel-heading">Critical Risk Assets Leaderboard</h3>
            <span className="panel-sub">Top 10 highest vulnerability bottlenecks ranked by percolation load & failure probability</span>
          </div>
          <span className="panel-tag tag-live">Dynamic Scoring</span>
        </div>

        <div className="table-wrapper">
          <table className="risk-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Asset Name & System ID</th>
                <th>Sector</th>
                <th>Geographic Zone</th>
                <th>Risk Score</th>
                <th>Status</th>
                <th>Failure Mechanism / Assessment</th>
                <th>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {topRiskAssets.map((n, idx) => {
                const status = n.status || 'safe';
                const riskVal = Number(n.risk_score || n.risk || 0);

                return (
                  <tr
                    key={n.id}
                    className="risk-row"
                    onClick={() => handleAssetClick(n)}
                  >
                    <td>
                      <span className={`rank-badge ${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : ''}`}>
                        #{idx + 1}
                      </span>
                    </td>
                    <td>
                      <div className="asset-cell">
                        <strong className="asset-name">{n.name || n.id}</strong>
                        <span className="asset-id">{n.id}</span>
                      </div>
                    </td>
                    <td>
                      <span className="sector-chip">{n.type_label || n.type}</span>
                    </td>
                    <td>
                      <span className="zone-name">{n.zone}</span>
                    </td>
                    <td>
                      <span className={`risk-pill ${riskVal >= 1.0 ? 'pill-crit' : riskVal >= 0.7 ? 'pill-high' : 'pill-med'}`}>
                        {riskVal.toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-tag status-${status}`}>
                        {status === 'failed' ? 'OFFLINE' : status === 'affected' ? 'AFFECTED' : 'SAFE'}
                      </span>
                    </td>
                    <td>
                      <span className="reason-text">
                        {n.failure_reason || 'Nominal operational state within standard design threshold.'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-inspect-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssetClick(n);
                        }}
                      >
                        Map ➔
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
