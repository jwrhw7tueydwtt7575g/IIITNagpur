# CityGraph Frontend

React frontend for the CityGraph smart-city risk intelligence dashboard.

This app presents the simulation dashboard, historical Delhi flood replay, Nepal reference scenario, and infrastructure-risk views used by the backend API.

## Stack

- React 19
- Vite
- React Router
- Leaflet for geospatial display
- Cytoscape-based network visualization

## Run locally

From this directory:

```bash
npm install
npm run dev
```

The app is usually served at:

- http://localhost:5173

## Required backend

The frontend expects the FastAPI backend to be running locally at the URL configured in `src/config.js`.

Default backend URL:

```js
http://127.0.0.1:8000
```

You can override it with an environment variable:

```bash
VITE_API_URL=http://127.0.0.1:8000 npm run dev
```

## Available scripts

```bash
npm run dev      # start local development server
npm run build    # production build
npm run preview  # serve production build locally
npm run lint     # run Oxlint checks
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
└── README.md
```

## Notes

- The frontend is a demo dashboard and is designed for research and prototype exploration.
- Historical and scenario data are shown through backend APIs and should not be interpreted as live operational monitoring data.
- If backend services are unavailable, the UI may display warnings or empty state panels depending on the selected view.

## Troubleshooting

### API connection issues

Check that the backend is running and that `VITE_API_URL` matches the backend origin.

### Missing dependencies

Run:

```bash
npm install
```

### Build issues

Verify the project is using a compatible Node.js version and install dependencies cleanly before building.
