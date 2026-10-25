import sys
import os
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app, create_city_graph, reset_simulation_state


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_endpoints(client):
    res1 = client.get("/health")
    assert res1.status_code == 200
    assert res1.json()["status"] == "ok"

    res2 = client.get("/api/health")
    assert res2.status_code == 200
    assert res2.json()["status"] == "ok"


def test_home_endpoint(client):
    res = client.get("/")
    assert res.status_code == 200
    assert "CityGraph" in res.json()["message"]


def test_graph_endpoint(client):
    res = client.get("/graph")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) >= 100
    assert len(data["edges"]) > 0
    assert "summary" in data
    assert data["summary"]["total_nodes"] == len(data["nodes"])


def test_simulate_heavy_rain(client):
    res = client.post("/simulate/heavy-rain", json={"rainfall_level": 90})
    assert res.status_code == 200
    data = res.json()
    assert data["active"] is True
    assert data["scenario"] == "heavy_rain"
    assert len(data["failed_nodes"]) > 0
    assert len(data["affected_nodes"]) > 0
    assert "timeline" in data


def test_reset_network(client):
    # After simulation, reset back to baseline
    res = client.post("/reset")
    assert res.status_code == 200
    data = res.json()
    assert data["active"] is False
    assert data["scenario"] == "normal"
    assert len(data["failed_nodes"]) == 0


def test_emergency_route_calculation(client):
    # Route between AIIMS (node_1) and IGI Airport (node_70)
    res = client.post(
        "/api/route",
        json={"origin_id": "node_1", "destination_id": "node_70"},
    )
    assert res.status_code == 200
    route = res.json()
    assert "path" in route
    assert len(route["path"]) >= 2
    assert route["path"][0] == "node_1"
    assert route["path"][-1] == "node_70"
    assert route["distance_km"] > 0
    assert route["estimated_time_min"] > 0


def test_auth_registration_and_login(client):
    import time

    unique_user = f"analyst_{int(time.time())}"
    unique_email = f"{unique_user}@citygraph.test"

    # Register
    reg_res = client.post(
        "/api/auth/register",
        json={
            "email": unique_email,
            "username": unique_user,
            "password": "securepassword123",
            "full_name": "Test Analyst",
        },
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["username"] == unique_user

    # Login
    login_res = client.post(
        "/api/auth/login",
        json={
            "username_or_email": unique_user,
            "password": "securepassword123",
        },
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # Verify protected /me endpoint
    me_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["username"] == unique_user


def test_historical_delhi_endpoints(client):
    meta_res = client.get("/api/historical/delhi/metadata")
    assert meta_res.status_code == 200
    assert "event_name" in meta_res.json()

    time_res = client.get("/api/historical/delhi/timeline")
    assert time_res.status_code == 200
    assert "timeline" in time_res.json()
    assert len(time_res.json()["timeline"]) > 0


def test_nepal_reference_endpoints(client):
    meta_res = client.get("/api/nepal/metadata")
    assert meta_res.status_code == 200
    assert "title" in meta_res.json()

    topo_res = client.get("/api/nepal/topology")
    assert topo_res.status_code == 200
    assert "assets" in topo_res.json()
