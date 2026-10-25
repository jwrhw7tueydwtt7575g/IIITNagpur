import React from 'react';
import './Sidebar.css';

export default function Sidebar({
  activeNav = 'dashboard',
  setActiveNav = () => {},
  connectionStatus = 'connected',
  scenarioName = 'Monsoon Cloudburst',
  totalAssets = 108,
}) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      tooltip: 'Master GIS command center & real-time monitoring',
    },
    {
      id: 'warning_72h',
      label: '72h Warning',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 14 14" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
        </svg>
      ),
      tooltip: '72-Hour predictive cascade intelligence, 4-state risk & counterfactual interventions',
    },
    {
      id: 'sensor_telemetry',
      label: 'Edge Sensors',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
      ),
      tooltip: 'Real-time ESP32 edge telemetry (MQ-135 Gas, DHT Temp/Humidity, IR Water) & Prophet forecast',
    },
    {
      id: 'simulation',

      label: 'Simulation',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      tooltip: 'Scenario modeling & cascading failure propagation',
    },
    {
      id: 'infrastructure',
      label: 'Infrastructure',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      tooltip: 'Asset inventory, capacities, and corridor links',
    },
    {
      id: 'risk_analysis',
      label: 'Risk Analysis',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      tooltip: 'Vulnerability analytics & risk distribution metrics',
    },
    {
      id: 'emergency_routing',
      label: 'Emergency Routing',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      ),
      tooltip: 'Multi-corridor Dijkstra evacuation & emergency transit',
    },
    {
      id: 'historical_replay',
      label: 'Historical Replay',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      tooltip: 'July 2023 Yamuna monsoon flood calibrated timeline',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      tooltip: 'Incident SitReps & printable infrastructure audits',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      tooltip: 'System telemetry & API configuration',
    },
  ];

  return (
    <aside className="sidebar-container" aria-label="Main Navigation Sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-logo" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M3 21h18M5 21V7l8-4v18M13 10l6-3v14" />
            <circle cx="9" cy="9" r="1" fill="currentColor" />
            <circle cx="9" cy="13" r="1" fill="currentColor" />
            <circle cx="9" cy="17" r="1" fill="currentColor" />
            <circle cx="16" cy="13" r="1" fill="currentColor" />
            <circle cx="16" cy="17" r="1" fill="currentColor" />
          </svg>
        </div>
        <div className="sidebar-brand-text">
          <div className="brand-name">CityGraph</div>
          <div className="brand-tagline">Urban Risk Intelligence</div>
          <div className="brand-motto">Resilient Cities. Safer Lives.</div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="sidebar-nav-list" role="navigation">
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-item ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveNav(item.id)}
              title={item.tooltip}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span className="nav-item-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="sidebar-flex-spacer" />

      {/* Bottom Illustration Card */}
      <div className="sidebar-promo-card">
        <div className="promo-card-graphic">
          <svg viewBox="0 0 200 100" fill="none" className="promo-svg-art">
            <path d="M10 90 L40 30 L60 50 L90 20 L120 60 L150 35 L190 90 Z" fill="#E0F2FE" />
            <path d="M30 90 L50 45 L70 65 L100 35 L130 75 L160 50 L185 90 Z" fill="#BAE6FD" />
            <rect x="75" y="40" width="22" height="50" fill="#0284C7" rx="2" />
            <rect x="105" y="25" width="26" height="65" fill="#0369A1" rx="2" />
            <rect x="45" y="55" width="20" height="35" fill="#38BDF8" rx="2" />
            <path d="M0 85 Q100 65 200 85" stroke="#1677FF" strokeWidth="4" strokeLinecap="round" />
            <path d="M0 92 Q100 72 200 92" stroke="#06B6D4" strokeWidth="2" strokeDasharray="4 4" />
          </svg>
        </div>
        <div className="promo-card-body">
          <h4 className="promo-title">Smarter Cities Stronger Tomorrows</h4>
          <p className="promo-desc">Data-driven decisions for resilient urban futures.</p>
          <span className="promo-quote">"A safer city is a stronger tomorrow."</span>
        </div>
      </div>

      {/* Compact System Status Section */}
      <div className="sidebar-system-status">
        <div className="status-row">
          <span className="status-label">Backend:</span>
          <span className={`status-val-pill ${connectionStatus === 'connected' ? 'connected' : 'disconnected'}`}>
            {connectionStatus === 'connected' ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
        <div className="status-row">
          <span className="status-label">Network:</span>
          <span className="status-val">{totalAssets}+ assets</span>
        </div>
        <div className="status-row">
          <span className="status-label">Scenario:</span>
          <span className="status-val-accent">{scenarioName}</span>
        </div>
        <div className="status-row">
          <span className="status-label">Last Updated:</span>
          <span className="status-val">Live Sync</span>
        </div>
      </div>
    </aside>
  );
}
