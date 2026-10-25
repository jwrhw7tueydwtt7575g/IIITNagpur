# 🖥️ CityGraph Frontend: Civic Command Center & Risk GIS

[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Cytoscape.js](https://img.shields.io/badge/Cytoscape.js-3.30-ea580c?style=for-the-badge)](https://js.cytoscape.org/)
[![Oxlint](https://img.shields.io/badge/Oxlint-0%20Errors-0284c7?style=for-the-badge)](https://oxc.rs/)
[![OpenStreetMap](https://img.shields.io/badge/OpenStreetMap-Free_Tiles-7EBC6F?style=for-the-badge&logo=openstreetmap&logoColor=white)](https://www.openstreetmap.org/)

The frontend for **CityGraph** is a high-performance, human-centered **Civic Operations Command Center** designed for municipal authorities, disaster managers, and infrastructure operators. Built on **React 19** and **Vite**, it delivers zero-latency interactive GIS mapping, network topology exploration, multispectral satellite analytics, and AI-assisted emergency dispatching.

---

## 🎨 Design Philosophy & Human-Centered Civic Theme

In accordance with municipal operation requirements:
- **Clean Light Civic Aesthetics**: Based on soothing neutral command center tones (`--bg-base: #f5f6f8`, `--bg-card: #ffffff`, `--border-subtle: #e2e8f0`, `--color-primary: #2563eb`).
- **No AI Badges or Robot Icons**: Eliminates robotic branding, glowing sci-fi badges, and gimmicks in favor of defense/governmental-grade incident dossiers and operational dashboards.
- **Strict Cartographic Attribution**: Zero "API KEY REQUIRED" watermarks — natively powered by standard **OpenStreetMap** tile layers and high-resolution Esri aerial imagery.

---

## 🧭 Complete Application Page Catalog

| Navigation Tab | View Component | Core Operational Purpose |
|:---|:---|:---|
| **Dashboard** | `DelhiMap.jsx` / `GraphView.jsx` | Master GIS command center with dual Map & Cytoscape topological graph toggle |
| **72h Warning** | `CrisisForecasterView.jsx` | 72-Hour predictive cascade intelligence, 10-second live pulse, and counterfactual interventions |
| **Edge Sensors** | `SensorTelemetryView.jsx` | Real-time physical ESP32 telemetry (MQ-135 Gas, DHT22, IR Water) & Prophet forecasts |
| **Water Quality** | `WaterQualityView.jsx` | JalNetra Sentinel-2 L2A optical water contamination indicators & OpenAI emergency dispatch |
| **Simulation** | `SimulationView.jsx` | Scenario configuration & physics-constrained cascading failure simulator |
| **Infrastructure** | `InfrastructureView.jsx` | Monitored asset inventory (capacities, loads, criticality, corridor connectivity) |
| **Risk Analysis** | `RiskAnalysisView.jsx` | Sector-wide vulnerability distribution & cascade propagation leaderboard |
| **Emergency Routing** | `EmergencyRoutingView.jsx` | Dijkstra safe-corridor calculation with dynamic flooded node avoidance |
| **Historical Replay** | `MapView.jsx` / `NepalReferenceView.jsx` | Replay of the July 2023 Yamuna Deluge and Nepal Bagmati flash flood |
| **Reports** | `ReportsView.jsx` | Executive Situation Reports (SitRep) and formal incident dossiers |
| **Settings** | `SettingsView.jsx` | Operational network reset, user profile, and system connection telemetry |

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment (Optional)
By default, the frontend connects to `http://127.0.0.1:8000`. You can override this by creating a `.env` file in `frontend/`:
```env
VITE_API_URL=http://localhost:8000
```

### 3. Run Development Server
```bash
npm run dev
```
The application will launch with hot-module replacement (HMR) at **`http://localhost:5173`**.

---

## 🛠️ Available Scripts

| Command | Action |
|:---|:---|
| `npm run dev` | Starts local Vite development server with HMR |
| `npm run build` | Compiles production assets into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Runs ultra-fast code quality checks using `oxlint` |

---

## 📁 Source Code Structure

```text
frontend/src/
├── App.jsx                     # Top-level routing and master state manager
├── App.css                     # Global design tokens and layout styling
├── config.js                   # API endpoint resolver
├── context/
│   └── useAuth.js              # Authentication and session context provider
├── pages/
│   ├── WaterQualityView.jsx    # JalNetra Sentinel-2 L2A optical water monitoring
│   ├── WaterQualityView.css    # Optical water quality styling
│   ├── SensorTelemetryView.jsx # Physical ESP32 sensor telemetry & Prophet forecast
│   ├── SensorTelemetryView.css # Sensor telemetry styling
│   ├── SimulationView.jsx      # Cascade simulation controller
│   ├── InfrastructureView.jsx  # Asset catalog and inventory
│   ├── RiskAnalysisView.jsx    # Sector vulnerability charts
│   ├── EmergencyRoutingView.jsx# Evacuation dispatch planner
│   ├── ReportsView.jsx         # Executive SitRep documentation
│   ├── SettingsView.jsx        # System telemetry and network controls
│   ├── Login.jsx               # Operator login
│   └── Register.jsx            # Operator registration
└── components/
    ├── Dashboard/
    │   ├── DelhiMap.jsx        # Centerpiece Leaflet GIS map
    │   ├── DelhiMap.css        # Map container and floating controls styling
    │   ├── GraphView.jsx       # Cytoscape topological network view
    │   ├── GraphView.css       # Cytoscape canvas and action controls
    │   ├── Sidebar.jsx         # Primary collapsible navigation bar
    │   ├── RoutePlanner.jsx    # Turn-by-turn emergency routing drawer
    │   └── KpiCards.jsx        # High-level operational summary cards
    ├── Warning/
    │   ├── CrisisForecasterView.jsx  # 72-Hour predictive cascade forecaster
    │   └── CrisisForecasterView.css  # Forecaster and live pulse styling
    └── HistoricalMap/
        ├── MapView.jsx         # July 2023 Yamuna inundation replay
        └── MapView.css         # Historical timeline styling
```

---

## 🔒 Code Quality & Standards

- **Oxlint**: `0 errors, 0 warnings` across all React components.
- **Responsive Layout**: Adapts gracefully from 4K command room monitors down to tablets.
- **Cartographic Standards**: WGS84 coordinates, strict Leaflet pane layer management ($z$-index hierarchy), and automated viewport fitting.
