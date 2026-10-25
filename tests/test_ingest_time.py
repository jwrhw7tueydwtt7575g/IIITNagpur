from ingest import EventTimeStore, ReplayClock


def _records():
    return [
        {"source": "s", "stream": "st", "station_id": "z1", "variable": "rain", "value": 5.0, "unit": "mm", "event_time": 10, "arrival_time": 10, "quality_flags": []},
        {"source": "s", "stream": "st", "station_id": "z1", "variable": "rain", "value": 9.0, "unit": "mm", "event_time": 20, "arrival_time": 20, "quality_flags": []},
    ]


def test_time_discipline():
    store = EventTimeStore(db_path=":memory:") if False else EventTimeStore(db_path="/tmp/test_ingest.duckdb")
    # clear table
    store.con.execute("DELETE FROM records")
    store.insert(_records())
    visible = store.read_at(15)
    assert all(r["arrival_time"] <= 15 for r in visible)
    assert len(visible) == 1
    # future not visible
    assert not any(r["arrival_time"] > 15 for r in visible)


def test_leakage_strict():
    store = EventTimeStore(db_path="/tmp/test_ingest2.duckdb")
    store.con.execute("DELETE FROM records")
    base = _records()
    store.insert(base)
    before = store.read_at(15)

    # perturb future observation values (arrival 20)
    future_perturbed = [dict(r, value=999.0, arrival_time=20) for r in base if r["arrival_time"] > 15]
    # remove original future then insert perturbed future (simulate arrival)
    store.con.execute("DELETE FROM records WHERE arrival_time > 15")
    store.insert(future_perturbed)
    after = store.read_at(15)
    # outputs before t unchanged
    assert before == after


def test_replay_clock_controls():
    c = ReplayClock(start=0)
    c.play()
    c.set_speed(60)
    c.tick(10)
    assert c.current_time == 600
    c.pause()
    c.tick(10)
    assert c.current_time == 600
    c.seek(5)
    assert c.current_time == 5
