import json
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import APIRouter, Query, HTTPException, Depends
import networkx as nx
from shapely.geometry import shape, Point, LineString

from auth_utils import get_current_user

router = APIRouter(
    prefix="/api/historical/delhi",
    tags=["Delhi Historical Flood Replay (July 2023)"],
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "delhi"

FLOOD_GEOJSON_PATH = DATA_DIR / "flood_july2023.geojson"
INFRA_GEOJSON_PATH = DATA_DIR / "infrastructure.geojson"
ROADS_GEOJSON_PATH = DATA_DIR / "road_corridors.geojson"

HISTORICAL_DISCLAIMER = (
    "HISTORICAL REFERENCE DATA (DELHI - JULY 2023) • NOT FOR LIVE EMERGENCY USE"
)

TIMELINE_DATA = [
    {
        "date": "2023-07-10",
        "day_label": "Day 1 - Warning Stage",
        "water_level_m": 205.33,
        "status": "warning",
        "headline": "Yamuna touches Warning Mark (205.33m)",
        "summary": "Heavy rainfall in Himachal Pradesh and Haryana triggers early discharge from Hathnikund Barrage. Floodplain Khadar evacuations begin.",
        "active_flood_zones": []
    },
    {
        "date": "2023-07-11",
        "day_label": "Day 2 - Danger Mark Breached",
        "water_level_m": 206.32,
        "status": "danger",
        "headline": "Danger Mark (205.33m) Breached",
        "summary": "River overspills natural banks. Lowlands at Monastery Market and Yamuna Bazar inundated.",
        "active_flood_zones": ["flood_jul11_monastery"]
    },
    {
        "date": "2023-07-12",
        "day_label": "Day 3 - Historic Record Broken",
        "water_level_m": 207.71,
        "status": "critical",
        "headline": "1978 All-Time Record (207.49m) Surpassed",
        "summary": "Water invades Ring Road near Kashmere Gate and Civil Lines Bela Road. Wazirabad and Chandrawal WTPs flooded, disrupting drinking water.",
        "active_flood_zones": ["flood_jul11_monastery", "flood_jul12_kashmere_gate", "flood_jul12_wazirabad_wtp"]
    },
    {
        "date": "2023-07-13",
        "day_label": "Day 4 - All-Time Historic Peak",
        "water_level_m": 208.66,
        "status": "peak",
        "headline": "Historic Peak: 208.66m (3.33m above danger mark)",
        "summary": "Drain #12 regulator near WHO building collapses. Yamuna backflow floods ITO intersection, Ring Road, Red Fort Salimgarh underpass, and Supreme Court periphery.",
        "active_flood_zones": [
            "flood_jul11_monastery",
            "flood_jul12_kashmere_gate",
            "flood_jul12_wazirabad_wtp",
            "flood_jul13_ito_breach",
            "flood_jul13_red_fort",
            "flood_jul13_mayur_vihar"
        ]
    },
    {
        "date": "2023-07-14",
        "day_label": "Day 5 - Defense & Containment",
        "water_level_m": 208.17,
        "status": "containment",
        "headline": "Indian Army & NDRF mobilize to plug Drain 12",
        "summary": "Indian Army engineers and NDRF begin constructing stone bunds at ITO regulator. River level begins slow descent.",
        "active_flood_zones": [
            "flood_jul11_monastery",
            "flood_jul12_kashmere_gate",
            "flood_jul12_wazirabad_wtp",
            "flood_jul13_ito_breach",
            "flood_jul13_red_fort",
            "flood_jul13_mayur_vihar"
        ]
    },
    {
        "date": "2023-07-15",
        "day_label": "Day 6 - Receding Phase",
        "water_level_m": 206.87,
        "status": "receding",
        "headline": "Water recedes below 207m; Ring Road sludge cleared",
        "summary": "Water drains out of ITO and Ring Road; pump out operations active. Wazirabad WTP resumes partial operations.",
        "active_flood_zones": [
            "flood_jul11_monastery",
            "flood_jul12_wazirabad_wtp",
            "flood_jul13_mayur_vihar"
        ]
    },
    {
        "date": "2023-07-16",
        "day_label": "Day 7 - Recovery & Assessment",
        "water_level_m": 205.80,
        "status": "recovery",
        "headline": "Yamuna stabilizes near warning level",
        "summary": "Traffic reopened on Ring Road and Vikas Marg. Reconstruction of damaged regulators initiated.",
        "active_flood_zones": []
    }
]


def load_geojson(path: Path) -> dict:
    if not path.exists():
        raise HTTPException(
            status_code=500, detail=f"GeoJSON data file not found: {path.name}"
        )
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/metadata")
def get_historical_metadata():
    """Returns overview metadata for the Delhi July 2023 Yamuna flood event."""
    return {
        "city": "Delhi, India",
        "event_name": "Yamuna River Historic Flood",
        "event_date_range": "July 10 – July 16, 2023",
        "peak_water_level_m": 208.66,
        "danger_mark_m": 205.33,
        "warning_level_m": 204.50,
        "historical_record_1978_m": 207.49,
        "description": (
            "In July 2023, extreme upstream discharge from the Hathnikund barrage "
            "coupled with high local rainfall pushed the Yamuna River in Delhi to an "
            "all-time record 208.66m. Major arterial corridors, drainage regulators, "
            "and water treatment plants were inundated."
        ),
        "disclaimer": HISTORICAL_DISCLAIMER,
        "map_center": {"lat": 28.6450, "lng": 77.2350},
        "default_zoom": 12,
        "dates_available": [t["date"] for t in TIMELINE_DATA],
    }


@router.get("/timeline")
def get_historical_timeline():
    """Returns the day-by-day chronological timeline of the flood progression."""
    return {
        "disclaimer": HISTORICAL_DISCLAIMER,
        "timeline": TIMELINE_DATA,
    }


@router.get("/flood-layer")
def get_flood_layer(date: str = Query("2023-07-13", description="Date in YYYY-MM-DD format")):
    """Returns GeoJSON polygons representing inundated zones for the chosen date."""
    data = load_geojson(FLOOD_GEOJSON_PATH)

    active_features = []
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        dates_active = props.get("dates_active", [props.get("date")])
        if date in dates_active:
            active_features.append(feature)

    timeline_entry = next((t for t in TIMELINE_DATA if t["date"] == date), None)

    return {
        "type": "FeatureCollection",
        "disclaimer": HISTORICAL_DISCLAIMER,
        "selected_date": date,
        "water_level_m": timeline_entry["water_level_m"] if timeline_entry else None,
        "status": timeline_entry["status"] if timeline_entry else "unknown",
        "headline": timeline_entry["headline"] if timeline_entry else None,
        "features": active_features,
    }


@router.get("/infrastructure")
def get_infrastructure(date: Optional[str] = Query(None, description="Optional date to evaluate inundation status")):
    """Returns GeoJSON point markers for Delhi hospitals, fire stations, and utilities."""
    infra_data = load_geojson(INFRA_GEOJSON_PATH)

    active_flood_polys = []
    if date:
        flood_data = load_geojson(FLOOD_GEOJSON_PATH)
        for feat in flood_data.get("features", []):
            dates_active = feat.get("properties", {}).get("dates_active", [])
            if date in dates_active:
                active_flood_polys.append(shape(feat["geometry"]))

    updated_features = []
    for feature in infra_data.get("features", []):
        feat_copy = json.loads(json.dumps(feature))
        props = feat_copy.get("properties", {})

        if date and active_flood_polys:
            point = shape(feat_copy["geometry"])
            inundated = False
            for poly in active_flood_polys:
                if poly.contains(point) or poly.distance(point) < 0.003:  # ~300m buffer
                    inundated = True
                    break

            if inundated:
                if props["type"] == "water_treatment_plant":
                    props["status"] = "inundated"
                elif props["status"] != "failed":
                    props["status"] = "threatened"
            else:
                if props["type"] != "water_treatment_plant" and props["type"] != "drainage_regulator":
                    props["status"] = "operational"

        updated_features.append(feat_copy)

    return {
        "type": "FeatureCollection",
        "disclaimer": HISTORICAL_DISCLAIMER,
        "selected_date": date,
        "features": updated_features,
    }


@router.get("/roads")
def get_road_corridors(date: Optional[str] = Query("2023-07-13", description="Date to evaluate road inundation")):
    """Returns arterial road corridors with spatial status (passable vs submerged)."""
    roads_data = load_geojson(ROADS_GEOJSON_PATH)

    active_flood_polys = []
    if date:
        flood_data = load_geojson(FLOOD_GEOJSON_PATH)
        for feat in flood_data.get("features", []):
            dates_active = feat.get("properties", {}).get("dates_active", [])
            if date in dates_active:
                active_flood_polys.append(shape(feat["geometry"]))

    updated_roads = []
    for road in roads_data.get("features", []):
        road_copy = json.loads(json.dumps(road))
        props = road_copy.get("properties", {})
        line = shape(road_copy["geometry"])

        submerged = False
        if active_flood_polys:
            for poly in active_flood_polys:
                if poly.intersects(line):
                    submerged = True
                    break

        if submerged:
            props["current_status"] = "submerged"
            props["risk_weight"] = 9999.0
        else:
            props["current_status"] = "passable"
            props["risk_weight"] = props.get("distance_km", 1.0)

        updated_roads.append(road_copy)

    return {
        "type": "FeatureCollection",
        "disclaimer": HISTORICAL_DISCLAIMER,
        "selected_date": date,
        "features": updated_roads,
    }


@router.get("/safe-route")
def get_historical_safe_route(
    source: str = Query("hosp_sushruta", description="Origin facility ID (e.g. hosp_sushruta or hosp_lnjp)"),
    target: str = Query("fire_dfs_hq", description="Destination facility ID (e.g. fire_dfs_hq)"),
    date: str = Query("2023-07-13", description="Date of historical event"),
):
    """
    Finds the safest emergency route connecting hospitals to fire stations
    by bypassing submerged roads in the historical flood model.
    """
    # Map infrastructure facilities to network intersection anchors
    facility_map = {
        "hosp_sushruta": "int_civil_lines",
        "hosp_lnjp": "int_delhi_gate",
        "hosp_hindu_rao": "int_hindu_rao_ridge",
        "fire_dfs_hq": "int_connaught_place",
        "fire_kashmere_gate": "int_kashmere_gate",
    }

    source_node = facility_map.get(source, "int_civil_lines")
    target_node = facility_map.get(target, "int_connaught_place")

    roads_response = get_road_corridors(date=date)
    road_features = roads_response.get("features", [])

    # Build NetworkX graph
    G = nx.Graph()
    road_lookup: Dict[str, dict] = {}

    for road in road_features:
        props = road["properties"]
        u = props["source"]
        v = props["target"]
        dist = props.get("distance_km", 1.0)
        is_submerged = props.get("current_status") == "submerged"

        road_lookup[f"{u}-{v}"] = road
        road_lookup[f"{v}-{u}"] = road

        # Submerged roads receive high penalty so routing detours away
        weight = 10000.0 if is_submerged else dist
        G.add_edge(u, v, weight=weight, submerged=is_submerged, name=props["name"], geometry=road["geometry"])

    try:
        path = nx.shortest_path(G, source=source_node, target=target_node, weight="weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return {
            "disclaimer": HISTORICAL_DISCLAIMER,
            "success": False,
            "message": "No passable route available between chosen facilities for this date.",
            "route_nodes": [],
            "coordinates": [],
            "distance_km": 0,
        }

    # Assemble route coordinates and distance
    route_coords: List[List[float]] = []
    total_km = 0.0
    segments_used = []
    has_submerged_crossing = False

    for i in range(len(path) - 1):
        u, v = path[i], path[i + 1]
        edge_data = G[u][v]
        total_km += edge_data.get("weight", 0) if not edge_data.get("submerged") else 0

        if edge_data.get("submerged"):
            has_submerged_crossing = True

        road_feat = road_lookup.get(f"{u}-{v}")
        if road_feat:
            segments_used.append(road_feat["properties"]["name"])
            coords = road_feat["geometry"]["coordinates"]
            # If coordinates need to be reversed to connect continuously
            if route_coords and coords[0] != route_coords[-1]:
                coords = list(reversed(coords))
            for pt in coords:
                if not route_coords or route_coords[-1] != pt:
                    route_coords.append(pt)

    narrative = (
        f"Route successfully bypasses submerged Ring Road & ITO by utilizing "
        f"the elevated Ridge & Rani Jhansi corridor ({total_km:.1f} km)."
        if not has_submerged_crossing
        else "Warning: Route passes near flooded segments."
    )

    return {
        "disclaimer": HISTORICAL_DISCLAIMER,
        "success": True,
        "date": date,
        "source": source,
        "target": target,
        "path_nodes": path,
        "distance_km": round(total_km, 2),
        "segments": segments_used,
        "narrative": narrative,
        "geojson": {
            "type": "Feature",
            "properties": {
                "name": f"Safe Emergency Detour ({date})",
                "distance_km": round(total_km, 2),
                "narrative": narrative,
            },
            "geometry": {
                "type": "LineString",
                "coordinates": route_coords,
            },
        },
    }
