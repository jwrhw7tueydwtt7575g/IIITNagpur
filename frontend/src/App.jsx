import { useEffect, useState, useCallback, useRef } from 'react';
import './App.css';

import { useAuth } from './context/AuthContext.jsx';

import DashboardHeader from './components/Dashboard/DashboardHeader.jsx';
import Sidebar from './components/Dashboard/Sidebar.jsx';
import KpiCards from './components/Dashboard/KpiCards.jsx';
import DelhiMap from './components/Dashboard/DelhiMap.jsx';
import GraphView from './components/Dashboard/GraphView.jsx';
import AssetInspector from './components/Dashboard/AssetInspector.jsx';
import RoutePlanner from './components/Dashboard/RoutePlanner.jsx';
import MapLegend from './components/Dashboard/MapLegend.jsx';
import LiveTrafficAlerts from './components/Dashboard/LiveTrafficAlerts.jsx';
import RiskOverviewChart from './components/Dashboard/RiskOverviewChart.jsx';
import RiskLeaderboard from './components/Dashboard/RiskLeaderboard.jsx';
import SimulationSummaryCard from './components/Dashboard/SimulationSummaryCard.jsx';
import MethodologyModal from './components/Dashboard/MethodologyModal.jsx';
import HowItWorks from './components/Dashboard/HowItWorks.jsx';
import QuickActionsBar from './components/Dashboard/QuickActionsBar.jsx';

// Dedicated Enterprise View Pages
import SimulationView from './pages/SimulationView.jsx';
import InfrastructureView from './pages/InfrastructureView.jsx';
import RiskAnalysisView from './pages/RiskAnalysisView.jsx';
import EmergencyRoutingView from './pages/EmergencyRoutingView.jsx';
import ReportsView from './pages/ReportsView.jsx';
import SettingsView from './pages/SettingsView.jsx';

import MapView from './components/HistoricalMap/MapView.jsx';
import NepalReferenceView from './components/NepalMap/NepalReferenceView.jsx';
import { API_BASE as API } from './config.js';

function Dashboard() {
  const { fetchWithAuth } = useAuth();

  // Active navigation tabs: 'dashboard' | 'simulation' | 'infrastructure' | 'risk_analysis' | 'emergency_routing' | 'historical_replay' | 'reports' | 'settings'
  const [activeNav, setActiveNav] = useState('dashboard');

  // Sub-modes for historical replay view
  const [historicalSubMode, setHistoricalSubMode] = useState('delhi_historical'); // 'delhi_historical' | 'nepal_reference'

  // Visual layout toggle on dashboard: 'map' | 'graph'
  const [centerViewType, setCenterViewType] = useState('map');

  // Simulation & Network state
  const [graph, setGraph] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState('heavy_rain');

  // Emergency Routing state (two-way synchronized between map and route panel)
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [routeDestination, setRouteDestination] = useState(null);
  const [routingMode, setRoutingMode] = useState(false);
  const [routingStep, setRoutingStep] = useState('idle');
  const [activeRoute, setActiveRoute] = useState(null);
  const [routingLoading, setRoutingLoading] = useState(false);

  // Layers & Map Styling
  const [layerFilters, setLayerFilters] = useState({
    flood_zones: true,
    road: true,
    hospital: true,
    fire_station: true,
    drainage: true,
    transformer: true,
    metro: true,
  });
  const [mapStyle, setMapStyle] = useState('streets'); // CARTO Voyager light basemap by default

  // Network & UI states
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('delhi_ncr');
  const [methodologyModalOpen, setMethodologyModalOpen] = useState(false);

  const initialRouteComputedRef = useRef(false);

  // System Health & Connection Check
  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/health`);
      if (res.ok) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch {
      setConnectionStatus('disconnected');
    }
  }, []);

  // Emergency Route Calculation
  const handleCalculateRoute = useCallback(
    async (originId, destId) => {
      try {
        setRoutingLoading(true);
        const response = await fetchWithAuth(`${API}/api/route`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            origin_id: originId,
            destination_id: destId,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || `Routing failed with status ${response.status}`);
        }

        const routeData = await response.json();
        setActiveRoute(routeData);
        return routeData;
      } catch (err) {
        console.error('Route calculation error:', err);
        throw err;
      } finally {
        setRoutingLoading(false);
      }
    },
    [fetchWithAuth]
  );

  // Initial Graph Fetch
  const loadGraph = useCallback(async () => {
    try {
      setInitialLoading(true);
      setError('');
      setConnectionStatus('connecting');

      const response = await fetchWithAuth(`${API}/graph`);
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: Failed to load infrastructure network.`);
      }

      const data = await response.json();
      setGraph(data);
      setConnectionStatus('connected');

      // Auto-select initial high-priority node dynamically
      if (data.nodes && data.nodes.length > 0) {
        const highestRiskId = data.summary?.highest_risk_node;
        const initial = data.nodes.find((n) => n.id === highestRiskId) || data.nodes[0];
        setSelectedNode(initial);

        // Default Origin: AIIMS Trauma (node_1)
        const defOrigin = data.nodes.find((n) => n.id === 'node_1') || data.nodes[0];
        // Default Dest: IGI Airport T3 (node_70)
        const defDest = data.nodes.find((n) => n.id === 'node_70') || data.nodes[data.nodes.length - 1];

        setRouteOrigin(defOrigin);
        setRouteDestination(defDest);

        // Auto-calculate baseline corridor if not yet computed
        if (!initialRouteComputedRef.current && defOrigin && defDest) {
          initialRouteComputedRef.current = true;
          handleCalculateRoute(defOrigin.id, defDest.id).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Error loading graph:', err);
      setError(err.message || 'Unable to connect to the simulation backend.');
      setConnectionStatus('disconnected');
    } finally {
      setInitialLoading(false);
    }
  }, [fetchWithAuth, handleCalculateRoute]);

  useEffect(() => {
    loadGraph();
    const interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, [loadGraph, checkConnection]);

  // Run Cascading Failure Simulation (Heavy Rain 90mm/h)
  const runSimulation = async () => {
    if (loading) return;
    try {
      setLoading(true);
      setError('');

      const response = await fetchWithAuth(`${API}/simulate/heavy-rain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rainfall_level: 90 }),
      });

      if (!response.ok) {
        throw new Error(`Simulation failed with status ${response.status}`);
      }

      const data = await response.json();
      setSimulation(data);
      setGraph(data);

      // Re-calculate route dynamically around the failed drainage nodes
      if (routeOrigin && routeDestination) {
        handleCalculateRoute(routeOrigin.id, routeDestination.id).catch(() => {});
      }

      // Update selected node with newly calculated state
      if (selectedNode) {
        const updated = data.nodes?.find((n) => n.id === selectedNode.id);
        if (updated) setSelectedNode(updated);
      }
    } catch (err) {
      console.error('Simulation error:', err);
      setError(err.message || 'Simulation execution failed.');
    } finally {
      setLoading(false);
    }
  };

  // Reset Network to Normal Baseline
  const resetNetwork = async () => {
    if (loading) return;
    try {
      setLoading(true);
      setError('');

      const response = await fetchWithAuth(`${API}/reset`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Reset failed with status ${response.status}`);
      }

      const data = await response.json();
      setSimulation(null);
      setGraph(data);

      // Restore baseline route
      if (routeOrigin && routeDestination) {
        handleCalculateRoute(routeOrigin.id, routeDestination.id).catch(() => {});
      }

      // Update selected node with baseline state
      if (selectedNode) {
        const updated = data.nodes?.find((n) => n.id === selectedNode.id);
        if (updated) setSelectedNode(updated);
      }
    } catch (err) {
      console.error('Reset error:', err);
      setError(err.message || 'Network reset failed.');
    } finally {
      setLoading(false);
    }
  };

  // Direct map routing actions
  const handleToggleRoutingMode = () => {
    const next = !routingMode;
    setRoutingMode(next);
    if (next) {
      setRoutingStep(!routeOrigin ? 'select_origin' : 'select_destination');
      setCenterViewType('map');
    } else {
      setRoutingStep('idle');
    }
  };

  const handleSetOrigin = (node) => {
    setRouteOrigin(node);
    if (!routeDestination) {
      setRoutingMode(true);
      setRoutingStep('select_destination');
    }
  };

  const handleSetDestination = (node) => {
    setRouteDestination(node);
    if (!routeOrigin) {
      setRoutingMode(true);
      setRoutingStep('select_origin');
    }
  };

  const handleClearRoute = () => {
    setActiveRoute(null);
    setRoutingMode(false);
    setRoutingStep('idle');
  };

  const handleViewRouteOnMap = () => {
    setActiveNav('dashboard');
    setCenterViewType('map');
  };

  const handleNavigateToMapWithNode = (node) => {
    if (node) setSelectedNode(node);
    setActiveNav('dashboard');
    setCenterViewType('map');
  };

  return (
    <div className="app-master-layout">
      {/* Left 8-Item Navigation Sidebar */}
      <Sidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        connectionStatus={connectionStatus}
        scenarioName={simulation ? 'Monsoon Cloudburst (Active)' : 'Baseline Operational'}
        totalAssets={graph?.nodes?.length || 108}
      />

      {/* Main Workspace Area */}
      <main className="app-main-workspace" role="main">
        {/* Smart-City Intelligence Header */}
        <DashboardHeader
          connectionStatus={connectionStatus}
          onRetryConnection={checkConnection}
          onSearchSelect={(node) => {
            setSelectedNode(node);
            if (activeNav !== 'dashboard') setActiveNav('dashboard');
          }}
          nodes={graph?.nodes || []}
          user={null}
          onLogout={undefined}
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
        />

        <div className="workspace-body">
          {error && (
            <div className="app-error-banner" role="alert">
              <span className="error-icon">⚠️</span>
              <span className="error-msg">{error}</span>
              <button type="button" className="btn-dismiss-err" onClick={() => setError('')}>✕</button>
            </div>
          )}

          {initialLoading ? (
            <div className="initial-loading-state">
              <div className="loading-spinner-core" />
              <h3>Initializing CityGraph Infrastructure Intelligence...</h3>
              <p>Connecting to simulation backend at {API}</p>
            </div>
          ) : (
            <>
              {/* 1. Dashboard View (Master Command Center) */}
              {activeNav === 'dashboard' && (
                <div className="dashboard-content-area">
                  <div className="map-focus-intro"><div><span>SIMULATED GEOSPATIAL COMMAND CENTER</span><h2>Delhi Disaster Cascade Map</h2><p>Explore infrastructure failures, risk propagation and safer emergency corridors on the interactive map.</p></div><strong>{graph?.nodes?.length ?? 0} assets · {simulation?.failed_nodes?.length ?? 0} failures</strong></div>

                  {/* Center Visual & Right Inspector Split */}
                  <div className="center-workspace-grid">
                    <div className="center-main-visual">
                      {centerViewType === 'map' ? (
                        <DelhiMap
                          nodes={graph?.nodes || []}
                          edges={graph?.edges || []}
                          selectedNode={selectedNode}
                          onSelectNode={setSelectedNode}
                          mapStyle={mapStyle}
                          onSetMapStyle={setMapStyle}
                          layerFilters={layerFilters}
                          setLayerFilters={setLayerFilters}
                          activeRoute={activeRoute}
                          centerViewType={centerViewType}
                          onToggleView={setCenterViewType}
                          routingMode={routingMode}
                          routingStep={routingStep}
                          routeOrigin={routeOrigin}
                          routeDestination={routeDestination}
                          onSetOrigin={handleSetOrigin}
                          onSetDestination={handleSetDestination}
                          onCalculateRoute={handleCalculateRoute}
                          onClearRoute={handleClearRoute}
                          onToggleRoutingMode={handleToggleRoutingMode}
                          onViewRouteOnMap={handleViewRouteOnMap}
                          routingLoading={routingLoading}
                          simulation={simulation}
                          onRunSimulation={runSimulation}
                          onResetNetwork={resetNetwork}
                          loadingSimulation={loading}
                          selectedScenario={selectedScenario}
                          setSelectedScenario={setSelectedScenario}
                        />
                      ) : (
                        <GraphView
                          graph={graph}
                          selectedNode={selectedNode}
                          onSelectNode={setSelectedNode}
                          centerViewType={centerViewType}
                          onToggleView={setCenterViewType}
                        />
                      )}
                    </div>

                    <div className="center-side-panels">
                      <AssetInspector
                        selectedNode={selectedNode}
                        routeOrigin={routeOrigin}
                        routeDestination={routeDestination}
                        onSetOrigin={handleSetOrigin}
                        onSetDestination={handleSetDestination}
                        onCalculateRoute={handleCalculateRoute}
                      />
                    </div>
                  </div>

                  <KpiCards graph={graph} _simulation={simulation} onSelectNode={setSelectedNode} />
                  {/* Master Map Legend & Live Traffic Alerts (Matching Reference Screenshot) */}
                  <div className="dashboard-map-bottom-grid">
                    <div className="map-bottom-legend-col">
                      <MapLegend />
                    </div>
                    <div className="map-bottom-alerts-col">
                      <LiveTrafficAlerts
                        simulation={simulation}
                        graph={graph}
                        onFocusNode={(node) => {
                          setSelectedNode(node);
                        }}
                      />
                    </div>
                  </div>

                  {/* Command Center Quick Actions Bar */}
                  <QuickActionsBar
                    onRunEvacuation={() => {
                      setActiveNav('emergency_routing');
                    }}
                    onFindEmergencyRoute={() => {
                      setActiveNav('emergency_routing');
                    }}
                    onGenerateReport={() => {
                      setActiveNav('reports');
                    }}
                    onViewRiskHeatmap={() => {
                      setActiveNav('risk_analysis');
                    }}
                  />

                  {/* Bottom Analytics Grid (Clean 3-Column Aligned Layout) */}
                  <div className="bottom-analytics-grid">
                    <RiskOverviewChart
                      graph={graph}
                      simulation={simulation}
                    />

                    <RiskLeaderboard
                      nodes={graph?.nodes || []}
                      selectedNode={selectedNode}
                      onSelectNode={setSelectedNode}
                    />

                    <SimulationSummaryCard
                      graph={graph}
                      simulation={simulation}
                      onReset={resetNetwork}
                      loading={loading}
                    />
                  </div>

                  {/* Architecture & Engine Explanation Guide */}
                  <HowItWorks />

                  {/* Footer Ribbon with Educational White Paper Links */}
                  <footer className="dashboard-footer-ribbon">
                    <div className="footer-left-info">
                      <span className="disclaimer-badge">SIMULATED REFERENCE MODEL</span>
                      <span className="disclaimer-text">
                        Delhi / NCR Synthetic Infrastructure Network • Prototype Simulation. Not an official live dispatch feed.
                      </span>
                    </div>

                    <div className="footer-links">
                      <button
                        type="button"
                        className="footer-link-btn"
                        onClick={() => setMethodologyModalOpen(true)}
                      >
                        How CityGraph Works
                      </button>
                      <span className="link-divider">•</span>
                      <button
                        type="button"
                        className="footer-link-btn"
                        onClick={() => setMethodologyModalOpen(true)}
                      >
                        Simulation Methodology
                      </button>
                      <span className="link-divider">•</span>
                      <button
                        type="button"
                        className="footer-link-btn"
                        onClick={() => setMethodologyModalOpen(true)}
                      >
                        White Paper & Roadmap
                      </button>
                    </div>
                  </footer>
                </div>
              )}

              {/* 2. Simulation View */}
              {activeNav === 'simulation' && (
                <SimulationView
                  graph={graph}
                  simulation={simulation}
                  onRunSimulation={runSimulation}
                  onResetNetwork={resetNetwork}
                  loading={loading}
                  selectedScenario={selectedScenario}
                  setSelectedScenario={setSelectedScenario}
                  onSelectNode={handleNavigateToMapWithNode}
                />
              )}

              {/* 3. Infrastructure View */}
              {activeNav === 'infrastructure' && (
                <InfrastructureView
                  nodes={graph?.nodes || []}
                  selectedNode={selectedNode}
                  onSelectNode={setSelectedNode}
                  onNavigateToMap={handleNavigateToMapWithNode}
                />
              )}

              {/* 4. Risk Analysis View */}
              {activeNav === 'risk_analysis' && (
                <RiskAnalysisView
                  graph={graph}
                  simulation={simulation}
                  onSelectNode={handleNavigateToMapWithNode}
                  onNavigateToMap={handleNavigateToMapWithNode}
                />
              )}

              {/* 5. Emergency Routing View */}
              {activeNav === 'emergency_routing' && (
                <EmergencyRoutingView
                  nodes={graph?.nodes || []}
                  activeRoute={activeRoute}
                  routeOrigin={routeOrigin}
                  routeDestination={routeDestination}
                  onSelectOrigin={handleSetOrigin}
                  onSelectDestination={handleSetDestination}
                  onCalculateRoute={handleCalculateRoute}
                  onClearRoute={handleClearRoute}
                  onNavigateToMap={() => {
                    setActiveNav('dashboard');
                    setCenterViewType('map');
                  }}
                  loading={routingLoading}
                />
              )}

              {/* 6. Historical Replay View */}
              {activeNav === 'historical_replay' && (
                <div className="historical-page-container">
                  <div className="historical-page-subnav">
                    <button
                      type="button"
                      className={`subnav-pill ${historicalSubMode === 'delhi_historical' ? 'is-active' : ''}`}
                      onClick={() => setHistoricalSubMode('delhi_historical')}
                    >
                      🌊 July 2023 Yamuna River Inundation (Delhi)
                    </button>
                    <button
                      type="button"
                      className={`subnav-pill ${historicalSubMode === 'nepal_reference' ? 'is-active' : ''}`}
                      onClick={() => setHistoricalSubMode('nepal_reference')}
                    >
                      🏔️ Bagmati Flash Flood (Nepal Reference)
                    </button>
                  </div>

                  {historicalSubMode === 'delhi_historical' ? (
                    <div className="historical-mode-wrapper">
                      <MapView apiBaseUrl={API} />
                    </div>
                  ) : (
                    <div className="nepal-mode-wrapper">
                      <NepalReferenceView apiBaseUrl={API} />
                    </div>
                  )}
                </div>
              )}

              {/* 7. Reports View */}
              {activeNav === 'reports' && (
                <ReportsView
                  graph={graph}
                  simulation={simulation}
                  activeRoute={activeRoute}
                />
              )}

              {/* 8. Settings View */}
              {activeNav === 'settings' && (
                <SettingsView
                  connectionStatus={connectionStatus}
                  graph={graph}
                  user={user}
                  onResetNetwork={resetNetwork}
                  loading={loading}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Educational & Methodology Modal */}
      <MethodologyModal
        isOpen={methodologyModalOpen}
        onClose={() => setMethodologyModalOpen(false)}
      />
    </div>
  );
}

export default function App() { return <Dashboard />; }
