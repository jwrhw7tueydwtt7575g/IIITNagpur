import yaml

from sim.city_sim import CitySim
from engine.state.particle_filter import ParticleFilter
from engine.discovery.deps import discover_dependencies
from engine.cascade.extract import extract_cascades
from engine.intervene.planner import plan_interventions
from quality.adversarial import sensor_quality


def test_particle_filter_and_forecast_state():
    with open("configs/default.yaml") as f:
        cfg = yaml.safe_load(f)
    pf = ParticleFilter(seed=1)
    pf.init_zone("z_north", 0.4)
    obs = {"traffic_index": 0.7, "hospital_load": 0.5}
    zone = cfg["zones"][0]
    pf.step("z_north", obs, 20, zone["vulnerability"], 0.6)
    m = pf.mean("z_north")
    assert 0 <= m <= 1
    probs = pf.state_probs("z_north")
    assert abs(sum(probs.values()) - 1.0) < 1e-6


def test_dependency_discovery_and_intervention():
    series = {"a": [0.1,0.2,0.3,0.5,0.7], "b": [0.05,0.1,0.2,0.4,0.6]}
    deps = discover_dependencies(series, threshold=0.9)
    # b depends on a likely
    assert any("a" in str(v) for v in deps.values())
    iv = plan_interventions({"a": 0.8, "b": 0.6}, budget=2)
    assert len(iv["interventions"]) >= 1


def test_quality_sensor():
    obs = {"sensor_quality": 0.9, "traffic_index": 0.5, "hospital_load": 0.4, "power_load": 0.3, "rain_mm_hr": 10}
    q = sensor_quality(obs, [])
    assert 0 <= q <= 1


def test_cascade_extract_runs():
    risk = {"a": 0.9, "b": 0.7}
    deps = {"b": [("a", 0.8)]}
    c = extract_cascades(risk, deps, threshold=0.5)
    assert "edges" in c
