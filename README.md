# CityGraph

A smart-city risk intelligence platform for modeling cascading infrastructure failures, flood replay, historical scenario analysis, and warning-oriented forecasting. The repository combines a FastAPI backend, a React + Vite frontend, and a research-oriented simulation/forecasting engine for multi-hazard urban resilience analysis.

This codebase is best understood as a prototype and research dashboard rather than a live operational emergency system.

## What this repository contains

- `backend/`: FastAPI application, auth, route logic, and historical/nepal/warning endpoints
- `frontend/`: React application for dashboard, maps, infrastructure views, and scenario visualization
- `sim/`: synthetic city simulator and ground-truth generation
- `engine/`: forecasting, state estimation, dependency discovery, intervention planning, and explainability
- `adapters/`: data ingestion adapters and offline fixture-backed fallbacks
- `ingest/`: event ingestion and replay clock utilities
- `quality/`: data quality, credibility, and fault detection logic
- `configs/`: scenario, city, and system configuration files
- `eval/`: metrics and reporting for baseline runs
- `tests/`: automated checks for adapters, backend API, engine behavior, and simulator logic

## High-level capabilities

- Cascading failure simulation for synthetic urban infrastructure networks
- Historical Delhi flood replay based on the July 2023 Yamuna flood period
- Nepal flash-flood reference scenario for illustrative evacuation analysis
- Route and resilience planning against simulated infrastructure degradation
- Warning-system API with multi-hour forecasting and risk-state evaluation
- Interactive frontend dashboard with map and network views

## Architecture at a glance

- Frontend: React + Vite + Leaflet + Cytoscape-style visualization pipeline
- Backend: FastAPI + SQLAlchemy + JWT-based auth layer
- Simulation engine: synthetic event generation, dependency graphs, forecasting, and intervention planning
- Data sources: built-in fixtures, JSON/GeoJSON scenarios, and adapter-based live-data stubs

## Quick start

### 1) Backend setup

From the repo root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Copy the example environment file if needed:

```bash
cp .env.example .env
```

Then start the API:

```bash
uvicorn main:app --reload --port 8000
```

The backend is configured to run locally at:

- http://127.0.0.1:8000
- API docs: http://127.0.0.1:8000/docs

### 2) Frontend setup

From the repo root:

```bash
cd frontend
npm install
npm run dev
```

The frontend development server typically runs at:

- http://localhost:5173

If the frontend needs to call a different backend URL, set:

```bash
VITE_API_URL=http://127.0.0.1:8000
```

## Environment and configuration

Key project settings are defined in:

- `.env.example`
- `backend/.env.example`
- `frontend/src/config.js`

Important notes:

- Do not commit real secrets or production credentials.
- The project includes demo-style auth and local development defaults.
- CORS, JWT secret, and base URL settings should be reviewed before public deployment.

## Operational status and model limits

This project is explicitly a research prototype:

- City infrastructure graphs are synthetic or reconstructed for demonstration purposes.
- Historical flood replay data is educational reference material and not equivalent to operational monitoring data.
- Warning and forecast outputs are baseline research outputs and should not be used for real emergency dispatch decisions without domain validation.
- Live adapters exist but are designed with offline-safe fallbacks and should be validated for production use before deployment.

## Useful project commands

From the repo root:

```bash
make sim
make eval
make test
```

The project also ships with a simple container setup:

```bash
docker compose up --build
```

## Repository structure summary

```text
.
├── backend/                # FastAPI service
├── frontend/               # React dashboard
├── adapters/               # Data connectors and offline fixtures
├── configs/                # scenarios and city configuration
├── engine/                 # forecasting / state / intervention modules
├── eval/                   # evaluation harness and metrics output
├── ingest/                 # ingestion and replay logic
├── quality/                # data health and credibility checks
├── sim/                    # synthetic simulator and ground truth
├── tests/                  # automated test suite
├── Dockerfile
├── docker-compose.yml
├── Makefile
├── README.md
├── requirements.txt
├── .env.example
└── backend/.env.example
```

## Security and compliance notes

- Authentication is intended for local/demo use and should be hardened before deployment.
- Sensitive environment values must be kept out of source control.
- Historical and simulated risk information is not a substitute for real-world situational assessment or official public alert systems.

## License

This project is licensed under the MIT License. See `LICENSE` for details.

## Contributing

Please read `CONTRIBUTING.md` before submitting changes.

## Related documentation

- `CONTRIBUTING.md`
- `SECURITY.md`
- `backend/routers/*` for API route definitions
- `frontend/src/` for UI and interaction logic
