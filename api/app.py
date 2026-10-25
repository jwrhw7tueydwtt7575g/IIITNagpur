from fastapi import FastAPI, WebSocket
from fastapi.responses import JSONResponse
import yaml

from sim.city_sim import CitySim
from engine.state.particle_filter import ParticleFilter
from engine.forecast.forecast import Forecaster
from twin.digital_twin import DigitalTwin
from quality.data_health import DataHealthMonitor

app = FastAPI(title="The 72-Hour Warning API")

with open("configs/default.yaml") as f:
    CONFIG = yaml.safe_load(f)


def build():
    sim = CitySim(CONFIG)
    sim.run()
    pf = ParticleFilter(seed=CONFIG["seed"])
    zones = CONFIG["zones"]
    for z in zones:
        pf.init_zone(z["id"], 0.1)
    # ingest up to current "now" t=12 for demo state
    now = 12
    obs_map = {z["id"]: None for z in zones}
    for o in sim.observations:
        if o.t <= now and o.t == now:
            obs_map[o.zone_id] = o.__dict__
    drain = {z["id"]: z.get("drainage", 0.6) for z in zones}
    # CitySim zones don't store drainage on config; use sim zones
    for z in sim.zones:
        drain[z.id] = z.drainage_capacity
    vuln = {z["id"]: z["vulnerability"] for z in zones}
    for o in [x for x in sim.observations if x.t == now]:
        pf.step(o.zone_id, o.__dict__, o.rain_mm_hr, vuln[o.zone_id], drain[o.zone_id])
    twin = DigitalTwin(seed=CONFIG["seed"])
    for z in zones:
        twin.update(z["id"], pf.mean(z["id"]))
    # forecast rain series from sim
    rain_series = [sim._rain_series[t] if t < len(sim._rain_series) else sim._rain_series[-1] for t in range(73)]
    forecaster = Forecaster(pf.particles, zones, horizon=72)
    fc = forecaster.forecast(zones, rain_series, drain, vuln)
    return sim, pf, fc, twin, now, drain, vuln


SIM, PF, FC, TWIN, NOW, DRAIN, VULN = build()
HEALTH = DataHealthMonitor()


@app.get("/health")
def health():
    return {"status": "ok", "service": "72-hour-warning"}


@app.get("/forecast")
def forecast():
    return {"now": NOW, "forecast": FC}


@app.get("/state")
def state():
    out = {}
    for z in CONFIG["zones"]:
        zid = z["id"]
        out[zid] = {
            "risk": PF.mean(zid),
            "lo": PF.quantile(zid, 0.1),
            "hi": PF.quantile(zid, 0.9),
            "probs": PF.state_probs(zid),
            "twin": TWIN.snapshot(zid),
        }
    return {"now": NOW, "state": out}


@app.get("/data-health")
def data_health():
    return {"states": HEALTH.states, "reliability": {k: v.mean() for k,v in HEALTH.reliability.items()}}


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_json({"msg": "connected", "now": NOW})
    await websocket.close()


# Additional integrated API endpoints (72-Hour Warning)
from fastapi import Query
from ingest import EventTimeStore, ReplayClock
from quality.data_health import DataHealthMonitor
from engine.discovery.discovery import DependencyDiscovery
from engine.cascade.cascade import extract_cascades
from engine.explain.explain import chain_support, narrative, ablation_attribution
from engine.intervene.planner import plan as plan_interventions

STORE = EventTimeStore(db_path="data/api_ingest.duckdb")
STORE.con.execute("DELETE FROM records")
# load sim observations into store with arrival times = t (simulated minutes)
for o in SIM.observations:
    STORE.insert([{
        "source": "synthetic",
        "stream": "obs",
        "station_id": o.zone_id,
        "variable": "risk_proxy",
        "value": o.traffic_index,
        "unit": "index",
        "event_time": o.t,
        "arrival_time": o.t + getattr(o, "delay_steps", 0),
        "quality_flags": [],
    }])
RCLOCK = ReplayClock(start=NOW)
DISC = DependencyDiscovery()
HEALTH2 = DataHealthMonitor()


@app.get("/state")
def state_at(t: int = Query(default=NOW)):
    records = STORE.read_at(t)
    by_zone = {}
    for r in records:
        by_zone.setdefault(r["station_id"], []).append(r)
    out = {}
    for z in CONFIG["zones"]:
        zid = z["id"]
        recs = by_zone.get(zid, [])
        risk = (sum(r.get("value",0) for r in recs)/len(recs)) if recs else 0.1
        risk = max(0.0, min(1.0, risk))
        out[zid] = {"risk": risk, "n_obs": len(recs), "t": t}
    return {"t": t, "state": out}


@app.get("/forecast")
def forecast(zone: str = Query(default=None), horizon: int = Query(default=72)):
    zid = zone or CONFIG["zones"][0]["id"]
    return {"zone": zid, "horizon": horizon, "from": "/forecast bulk"}


@app.get("/cascades")
def cascades(zone: str = Query(default=None)):
    risk = {z["id"]: PF.mean(z["id"]) for z in CONFIG["zones"]}
    edges = DISC.edge_list()
    return extract_cascades(risk, edges)


@app.get("/dependencies")
def dependencies(since: int = Query(default=0)):
    return {"edges": DISC.edge_list(), "since": since}


@app.get("/explain")
def explain(zone: str, t1: int, t2: int):
    risk = PF.mean(zone)
    attr = ablation_attribution(risk, {"rain": 0.2, "traffic": 0.1})
    return {"zone": zone, "t1": t1, "t2": t2, "risk": risk, "attribution": attr,
            "narrative": narrative([zone], risk)}


@app.post("/interventions")
def interventions(payload: dict):
    risk = {z["id"]: PF.mean(z["id"]) for z in CONFIG["zones"]}
    budget = payload.get("budget", 5)
    res = plan_interventions(risk, DISC.edge_list(), budget)
    return res


@app.post("/replay")
def replay(payload: dict):
    t = payload.get("t", NOW)
    RCLOCK.seek(t)
    return {"t": RCLOCK.now, "state": RCLOCK.state}


@app.get("/eval/summary")
def eval_summary():
    return {"status": "available", "report": "eval/report/index.html"}


@app.websocket("/stream")
async def stream(websocket):
    await websocket.accept()
    t = NOW
    while True:
        await websocket.send_json({"t": t, "n_zones": len(CONFIG["zones"])})
        t += 1
        import asyncio
        await asyncio.sleep(1)
        if t > NOW + 5:
            break
    await websocket.close()
