from engine.cascade.cascade import extract_cascades, detect_loops
from engine.explain.explain import ablation_attribution, chain_support, narrative
from engine.intervene.planner import plan

def test_cascade_extraction():
    risk = {"a":0.8, "b":0.7, "c":0.4}
    edges = [{"source":"a","target":"b","weight":0.8},{"source":"b","target":"c","weight":0.5}]
    out = extract_cascades(risk, edges)
    assert "chains" in out
    assert out["merge_points"] is not None
    loops = detect_loops([("a","b"),("b","a")])
    assert len(loops) >= 1

def test_intervention_ranking():
    risk = {"a":0.9, "b":0.7}
    edges = [{"source":"a","target":"b"}]
    res = plan(risk, edges, budget=3)
    assert len(res["plans"]) >= 1
    assert res["plans"][0]["marginal"] >= res["plans"][-1]["marginal"] or len(res["plans"])==1

def test_explanation_traceability():
    attr = ablation_attribution(0.7, {"rain":0.5, "traffic":0.6})
    assert isinstance(attr, list)
    support = chain_support(["a","b"], {"a":{"source":"sensor","freshness":1.0,"reliability":0.9}})
    assert support[0]["node"] == "a"
    text = narrative(["a","b"], 0.7)
    assert "0.70" in text

def test_side_effect_generation():
    risk = {"a":0.9,"b":0.1}
    edges = [{"source":"a","target":"b"}]
    res = plan(risk, edges, budget=2)
    # side_effects key exists
    assert "side_effects" in res["plans"][0]
