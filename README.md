# CityGraph — Urban Infrastructure Risk Intelligence

> A smart-city decision-support platform for cascading-failure simulation, historical flood replay, GIS visualization, and resilient emergency routing.

**[Live interface](https://citygraph-intelligence.vercel.app/) · [Source code](https://github.com/rajsalonia/citygraph) · [Architecture](#️-system-architecture) · [Run locally](#-run-locally)**

> **Prototype scope:** Synthetic infrastructure scenarios and reconstructed historical references. Not intended for live emergency operations or evacuation decisions.

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB.svg?style=flat&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Bundler-Vite%208-646CFF.svg?style=flat&logo=vite)](https://vitejs.dev/)
[![NetworkX](https://img.shields.io/badge/Graph%20Engine-NetworkX-orange.svg?style=flat)](https://networkx.org/)
[![Leaflet](https://img.shields.io/badge/GIS-Leaflet-199900.svg?style=flat&logo=leaflet)](https://leafletjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📌 Overview

Modern cities are interconnected systems. A failure in one infrastructure sector can affect other sectors through shared dependencies.

For example:

- Drainage pump stations may become overloaded during heavy rainfall.
- Floodwater may affect roads and underpasses.
- Damaged roads may reduce access to hospitals and emergency services.
- Power failures may increase the risk of secondary infrastructure failures.

**CityGraph** models these dependencies as a graph and provides an interactive environment for exploring infrastructure risks, flood scenarios, and emergency routes.

The platform combines:

- Graph theory
- Cascading-failure simulation
- GIS-based visualization
- Historical event replay
- Risk-weighted route planning
- Interactive infrastructure inspection

> **Important:** CityGraph is an educational and research-oriented prototype. It is not a live emergency-management system.

---

## 🎯 Problem Statement

Traditional emergency dashboards often display maps, charts, or isolated sensor information. They may not clearly show how a failure in one infrastructure sector can affect another connected sector.

CityGraph addresses this problem by combining graph-based infrastructure modeling, spatial visualization, and simulated failure propagation in one interactive platform.

The project focuses on helping users explore:

- Infrastructure dependencies
- Potential cascading failures
- Flood-affected corridors
- Asset-level risk
- Emergency route alternatives
- Historical flood scenarios

---

## 🚀 Key Features

### 1. Synthetic Delhi Infrastructure Network

The project includes a synthetic urban infrastructure graph containing:

- Hospitals and trauma-care facilities
- Fire dispatch headquarters
- Stormwater pumping stations
- Power substations
- Arterial road corridors
- Interconnected infrastructure dependencies

The simulation demonstrates how stress in one infrastructure sector can propagate through connected assets.

#### Main capabilities

- Graph-based infrastructure representation
- Heavy-rainfall stress simulation
- Cascading-failure propagation
- Asset-level diagnostics
- Failure-reason display
- Capacity and risk inspection
- Connected-road analysis
- Risk-weighted emergency routing

The route solver uses graph-based shortest-path calculations to identify corridors that avoid simulated failures.

---

### 2. Delhi Historical Flood Replay

This module provides a historical reference replay based on the July 2023 Yamuna flood event in Delhi.

Features include:

- Chronological flood-event timeline
- Historical water-level visualization
- Flood-affected area overlays
- Road-status visualization
- GeoJSON-based flood layers
- Historical route analysis
- Interactive GIS map

The module demonstrates how historical flood information can be explored through a visual and interactive interface.

> **HISTORICAL REFERENCE DATA — NOT FOR LIVE EMERGENCY USE**

The flood layers and road classifications are reconstructed for demonstration and should not be treated as real-time operational data.

---

### 3. Nepal Flash-Flood Reference Scenario

CityGraph also includes a simulated mountain-valley scenario representing flash-flood conditions in steep terrain.

The scenario includes:

- Valley-floor infrastructure
- Mid-slope infrastructure
- High-ridge evacuation points
- Flooded river corridors
- Debris-flow road blockages
- Hydropower-related infrastructure
- Evacuation route visualization

The evacuation route demonstrates movement from lower-elevation areas toward safer elevated locations.

> **SIMULATED REFERENCE MODEL — NOT AN OFFICIAL OR LIVE MONITORING FEED**

This scenario is illustrative and does not represent live conditions or precise survey data for a specific Himalayan location.

---

### 4. Interactive Visualizations

The frontend provides multiple visualization modes:

- Cytoscape.js network graph
- Leaflet GIS map
- Historical flood timeline
- Custom SVG mountain-valley visualization
- Asset diagnostic panels
- Risk and failure indicators
- Route overlays

These visualizations help users understand infrastructure dependencies and simulated emergency conditions.

---

### 5. Authentication and Session Management

The application includes a local authentication flow using:

- JWT bearer tokens
- Password hashing
- SQLite database
- Protected API routes
- User registration and login
- Current-user profile endpoint

The authentication system is intended for local development and demonstration.

> **Security note:** Configure strong secrets and production-grade authentication before deploying the application publicly.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend — React + Vite"]
        UI["CityGraph Dashboard"]
        Router["React Router"]
        Auth["Authentication Context"]
        Cytoscape["Cytoscape.js Graph"]
        Leaflet["Leaflet GIS Map"]
        SVG["Mountain Valley SVG"]
    end

    subgraph Server["Backend — FastAPI"]
        API["FastAPI Gateway"]
        AuthAPI["Authentication API"]
        GraphAPI["Graph and Simulation API"]
        HistoricalAPI["Historical Flood API"]
        NepalAPI["Nepal Scenario API"]
        NetworkX["NetworkX Graph Engine"]
        Shapely["Shapely Spatial Engine"]
        Database[("SQLite Database")]
    end

    UI --> Router
    Router --> Auth
    Auth --> API

    API --> AuthAPI
    API --> GraphAPI
    API --> HistoricalAPI
    API --> NepalAPI

    AuthAPI --> Database
    GraphAPI --> NetworkX
    HistoricalAPI --> Shapely

    GraphAPI --> Cytoscape
    HistoricalAPI --> Leaflet
    NepalAPI --> SVG
```

---

## 🧑‍💻 Run Locally

**Requirements:** Python 3.11+, Node.js 20+, and npm. The Python API and Vite frontend run as separate local processes.

**Backend** (terminal 1):

```bash
cd backend
python -m venv .venv
# Activate .venv (Windows: .venv\\Scripts\\activate; macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** (terminal 2, from the repository root):

```bash
cd frontend
npm install
npm run dev
```

Set the documented environment values from [`.env.example`](.env.example), especially a strong backend secret, when using authentication. See [`render.yaml`](render.yaml) for the example backend hosting configuration.

## 🧩 Engineering Highlights

- **Graph modeling:** NetworkX infrastructure dependencies, cascading failures, and failure-aware shortest paths.
- **Geospatial interaction:** Leaflet and spatial overlays for historical and illustrative flood scenarios.
- **API architecture:** FastAPI endpoints connect graph simulation, historical data, and visualization modules.
- **Authentication demo:** JWT-based API access with SQLite-backed user records; harden before public production use.

## ⚠️ Data & Deployment Notes

- Infrastructure networks, Nepal valley conditions, and failure outcomes are simulations or reconstructed educational references, **not live operational feeds**.
- The frontend demo URL is provided for portfolio access; availability depends on the external host and the configured backend.
- Do not use generated routes or risk values to direct actual emergency response.

## 🔗 Project Links

- **Frontend demo:** https://citygraph-intelligence.vercel.app/
- **Code:** https://github.com/rajsalonia/citygraph
- **License:** [MIT](LICENSE)
