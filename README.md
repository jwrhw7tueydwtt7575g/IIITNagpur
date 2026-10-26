# CityGraph

CityGraph is a smart-city resilience and risk intelligence platform for modeling infrastructure dependencies, cascading failures, flood scenarios, telemetry-driven warning logic, and emergency corridor planning.

The codebase combines:
- a FastAPI backend
- a React + Vite frontend
- a synthetic city-graph simulation engine
- historical Delhi flood replay logic
- Nepal reference scenario analysis
- 72-hour warning and forecasting modules
- water-quality and fire-defense analytics

This is a research and prototype project, not an operational emergency management system.

## Repository structure

- `backend/` — FastAPI app, auth, routers, database, telemetry, and service endpoints
- `frontend/` — React dashboard and map-based UI
- `engine/` — forecasting, dependency discovery, intervention planning, state logic
- `sim/` — simulator and synthetic ground-truth generation
- `configs/` — scenarios and city configuration definitions
- `adapters/` — external-data adapters and offline fixture-backed fallbacks
- `ingest/` — replay and event ingestion logic
- `quality/` — quality, reliability, and credibility checks
- `eval/` — evaluation and reporting tools
- `tests/` — pytest suite covering API, engine, adapters, and simulation behavior
- `data/` — generated observations and sample responses

## Current feature areas

### Urban graph and cascading risk
The core backend creates a synthetic city graph and simulates how failures propagate across dependent infrastructure nodes.

### Historical flood replay
The Delhi historical module loads timeline data and GeoJSON layers for the July 2023 Yamuna flood event and exposes route/inundation context through API endpoints.

### Nepal reference scenario
The Nepal scenario models a flash-flood and mountain-valley evacuation context with illustrative assets and risk states.

### 72-hour warning engine
The warning router integrates simulation, forecasting, particle-filter-style state estimation, dependency discovery, and intervention planning.

### Sensor telemetry
The backend includes a sensor engine that simulates ESP32-style telemetry and uses Prophet-style forecasting for short-term prediction.

### Water quality / JalNetra
The project includes water-quality analysis routes based on spectral indices and alert generation for health and NGO coordination.

### Fire defense
The fire-defense router models fire-prone zones, resource allocation, and evacuation routing for Delhi and Mumbai scenarios.

## Local setup

### Backend

```bash
cd /home/vivek/Desktop/citygraph/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

Backend URL:
- http://127.0.0.1:8000
- docs: http://127.0.0.1:8000/docs

### Frontend

```bash
cd /home/vivek/Desktop/citygraph/frontend
npm install
npm run dev
```

Frontend URL:
- http://localhost:5173

If the frontend must connect to a different backend, set:

```bash
VITE_API_URL=http://127.0.0.1:8000
```

## Configuration notes

Key config locations:
- `.env.example`
- `backend/.env.example`
- `frontend/src/config.js`

Before production deployment, review:
- `SECRET_KEY`
- `CORS_ORIGINS`
- `OPENAI_API_KEY` if AI synthesis is enabled
- any live-feed provider credentials

## Running project checks

From the repo root:

```bash
make sim
make eval
make test
```

Or simply:

```bash
pytest -q
```

## Operational caution

- All city graphs, risk scores, and flood scenarios are synthetic or reconstructed for demonstration.
- Historical and scenario data should not be treated as live operations data.
- Forecast and intervention outputs are research-oriented and need domain validation before real-world emergency use.

## License

This project is distributed under the MIT License. See `LICENSE` for details.
