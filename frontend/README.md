# CityGraph Frontend

This is the React frontend for the CityGraph smart-city resilience dashboard.

The app presents multiple operational views:
- dashboard and map overview
- infrastructure network analysis
- historical flood replay
- Nepal scenario reference
- 72-hour forecast and warning views
- sensor telemetry and forecasting
- water-quality analytics
- fire-defense and risk analysis views

## Stack

- React 19
- Vite
- React Router
- Leaflet
- Cytoscape-style graph visualizations

## Local setup

From this folder:

```bash
npm install
npm run dev
```

Open:

- http://localhost:5173

## Backend dependency

The frontend expects the FastAPI backend to be running. Default backend URL:

```js
http://127.0.0.1:8000
```

Override it through environment variable if needed:

```bash
VITE_API_URL=http://127.0.0.1:8000 npm run dev
```

## Useful scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Project structure

```text
frontend/
├── src/
│   ├── components/
│   ├── context/
│   ├── pages/
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── config.js
├── package.json
├── vite.config.js
├── index.html
├── README.md
└── public/
```

## Notes

- This frontend is a prototype dashboard for research and exploration.
- Historical and simulation data should be interpreted as contextual information, not live operational feeds.
- Some views depend on backend endpoints being available and returning valid data.

## Troubleshooting

### API connection issues
Check that the backend is running and the configured `VITE_API_URL` matches the actual server origin.

### Install issues
Run:

```bash
npm install
```

### Build issues
Make sure the project is using a compatible Node.js environment and install dependencies cleanly before building.
