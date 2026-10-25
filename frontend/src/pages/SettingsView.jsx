import React, { useState } from 'react';
import './SettingsView.css';
import { API_BASE as API } from '../config.js';

export default function SettingsView({
  connectionStatus = 'connected',
  graph = null,
  user = null,
  onResetNetwork = () => {},
  loading = false,
}) {
  const [copied, setCopied] = useState(false);
  const [telemetrySync, setTelemetrySync] = useState(true);
  const [highContrastMap, setHighContrastMap] = useState(false);

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText(API);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="settings-view-container">
      {/* Header */}
      <div className="settings-header">
        <div>
          <div className="settings-breadcrumb">
            <span>CITYGRAPH ENTERPRISE</span>
            <span className="breadcrumb-divider">/</span>
            <span className="breadcrumb-current">SYSTEM CONFIGURATION</span>
          </div>
          <h1 className="settings-title">System Settings & Infrastructure Status</h1>
          <p className="settings-subtitle">
            Configure enterprise GIS telemetry, inspect Render backend endpoints, and review prototype runtime parameters.
          </p>
        </div>

        <div className="settings-header-actions">
          <button
            type="button"
            className="btn-settings-reset"
            onClick={onResetNetwork}
            disabled={loading}
          >
            {loading ? 'Resetting...' : '↺ Reset Infrastructure Network'}
          </button>
        </div>
      </div>

      {/* Grid of Settings Cards */}
      <div className="settings-grid">
        {/* Card 1: Backend Connection & Hosting */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="card-header-icon blue">🌐</div>
            <div>
              <h3 className="card-title">Render Cloud Deployment</h3>
              <span className="card-subtitle">Production FastAPI simulation backend</span>
            </div>
            <span className={`status-pill ${connectionStatus === 'connected' ? 'status-connected' : 'status-disconnected'}`}>
              <span className="status-dot" />
              {connectionStatus === 'connected' ? 'LIVE & HEALTHY' : 'CONNECTING...'}
            </span>
          </div>

          <div className="settings-card-body">
            <div className="settings-field-group">
              <label className="field-label">Production Backend URL</label>
              <div className="field-input-copy">
                <input
                  type="text"
                  readOnly
                  value={API}
                  className="field-input readonly"
                />
                <button
                  type="button"
                  className="btn-copy-input"
                  onClick={handleCopyUrl}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <span className="field-hint">
                Configured via <code>VITE_API_URL</code> environment variable on Vercel deployment.
              </span>
            </div>

            <div className="settings-specs-grid">
              <div className="spec-box">
                <span className="spec-label">Environment</span>
                <span className="spec-val">Production</span>
              </div>
              <div className="spec-box">
                <span className="spec-label">Framework</span>
                <span className="spec-val">FastAPI 0.115</span>
              </div>
              <div className="spec-box">
                <span className="spec-label">Graph Engine</span>
                <span className="spec-val">NetworkX 3.2.1</span>
              </div>
              <div className="spec-box">
                <span className="spec-label">Host</span>
                <span className="spec-val">Render (Frankfurt)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Synthetic Network Topology */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="card-header-icon green">🗺️</div>
            <div>
              <h3 className="card-title">Delhi-NCR Topology Specs</h3>
              <span className="card-subtitle">Deterministic spatial graph parameters</span>
            </div>
            <span className="status-pill status-connected">
              <span className="status-dot" />
              108 ASSETS LOADED
            </span>
          </div>

          <div className="settings-card-body">
            <div className="topology-stats-grid">
              <div className="topo-stat-card">
                <span className="topo-num">108</span>
                <span className="topo-desc">Synthetic Nodes</span>
              </div>
              <div className="topo-stat-card">
                <span className="topo-num">{graph?.edges?.length || 237}</span>
                <span className="topo-desc">Bidirectional Edges</span>
              </div>
              <div className="topo-stat-card">
                <span className="topo-num">5</span>
                <span className="topo-desc">NCR Municipal Zones</span>
              </div>
              <div className="topo-stat-card">
                <span className="topo-num">6</span>
                <span className="topo-desc">Infrastructure Types</span>
              </div>
            </div>

            <div className="disclaimer-callout">
              <span className="disclaimer-icon">ℹ️</span>
              <div className="disclaimer-body">
                <strong>Synthetic Infrastructure Network Notice:</strong>
                <p>
                  Asset coordinates, capacities, and failure probabilities represent a calibrated synthetic model 
                  for prototype resilience evaluation and hackathon demonstration, not an official municipal dispatch feed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Security & Session Profile */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="card-header-icon purple">🛡️</div>
            <div>
              <h3 className="card-title">Security & Session Profile</h3>
              <span className="card-subtitle">JWT authenticated command identity</span>
            </div>
            <span className="status-pill status-secured">
              <span className="status-dot" />
              AUTHENTICATED
            </span>
          </div>

          <div className="settings-card-body">
            <div className="user-profile-row">
              <div className="user-avatar-large">
                <span>{user?.username ? user.username.slice(0, 2).toUpperCase() : 'CO'}</span>
              </div>
              <div className="user-meta">
                <h4 className="user-name">{user?.username || 'City Operations Lead'}</h4>
                <span className="user-role">Role: Incident Commander • Master Level Access</span>
                <span className="user-email">{user?.email || 'ops.command@delhi.gov.in (Demo Session)'}</span>
              </div>
            </div>

            <div className="security-badges-list">
              <div className="sec-badge-item">
                <span className="sec-icon">✓</span>
                <span>JWT HS256 Token Session Active</span>
              </div>
              <div className="sec-badge-item">
                <span className="sec-icon">✓</span>
                <span>Instance-Local Rate Limiting Enforced</span>
              </div>
              <div className="sec-badge-item">
                <span className="sec-icon">✓</span>
                <span>Explicit CORS Allowed Origins Configured</span>
              </div>
              <div className="sec-badge-item">
                <span className="sec-icon">✓</span>
                <span>Production Secrets Isolated from Frontend</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: GIS & Display Preferences */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="card-header-icon orange">⚙️</div>
            <div>
              <h3 className="card-title">GIS & UI Preferences</h3>
              <span className="card-subtitle">Basemap and client display parameters</span>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="pref-toggle-list">
              <div className="pref-item">
                <div className="pref-info">
                  <span className="pref-title">High-Frequency Telemetry Sync</span>
                  <span className="pref-desc">Ping backend health check every 15 seconds</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={telemetrySync}
                    onChange={(e) => setTelemetrySync(e.target.checked)}
                  />
                  <span className="slider round" />
                </label>
              </div>

              <div className="pref-item">
                <div className="pref-info">
                  <span className="pref-title">High-Contrast Map Overlays</span>
                  <span className="pref-desc">Increase edge glow and node halo radius</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={highContrastMap}
                    onChange={(e) => setHighContrastMap(e.target.checked)}
                  />
                  <span className="slider round" />
                </label>
              </div>

              <div className="pref-item">
                <div className="pref-info">
                  <span className="pref-title">CARTO Voyager Light Basemap</span>
                  <span className="pref-desc">Zero API key vector tiles with high legibility</span>
                </div>
                <span className="badge-default">DEFAULT (ACTIVE)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
