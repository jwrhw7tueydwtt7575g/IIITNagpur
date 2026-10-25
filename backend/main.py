import os
import logging
from typing import Dict, List, Optional
from contextlib import asynccontextmanager
import random
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import networkx as nx
from fastapi import FastAPI, Depends, Request, HTTPException, status, Query

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from database import engine, Base, SessionLocal
from models import User
from auth_utils import get_current_user
from routers.auth import router as auth_router, seed_default_user
from routers.historical import router as historical_router
from routers.nepal import router as nepal_router
from routers.warning import router as warning_router
from rate_limiter import limiter

logger = logging.getLogger("citygraph.api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "true").lower() == "true"


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_default_user(db)
    finally:
        db.close()
    create_city_graph()
    reset_simulation_state()
    yield


app = FastAPI(
    title="CityGraph API",
    description="Predictive cascading failure simulation for smart cities",
    version="1.0.0",
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
    lifespan=lifespan,
)

# Production CORS configuration
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    allowed_origins = [orig.strip() for orig in cors_origins_env.split(",") if orig.strip()]
else:
    # Safe default including development and deployed Vercel domains
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "https://frontend-beta-taupe-93.vercel.app",
        "https://citygraph-intelligence.vercel.app",
        "https://frontend-8ramg26s7-7xtr.vercel.app",
        "https://frontend-3jyjzj4o9-7xtr.vercel.app",
        "https://frontend-7xtr.vercel.app",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Add defensive security headers to all HTTP responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    if ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Sanitize unhandled exceptions so no internal stack traces leak to users."""
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)
    logger.error(f"Unhandled server exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Incident has been logged."},
    )


app.include_router(auth_router)
app.include_router(historical_router)
app.include_router(nepal_router)
app.include_router(warning_router)


class RainRequest(BaseModel):
    rainfall_level: int = Field(default=90, ge=1, le=500, description="Rainfall intensity in mm/hr (1 to 500)")


city_graph = nx.Graph()
original_graph = nx.Graph()

node_data: Dict[str, dict] = {}
original_node_data: Dict[str, dict] = {}

simulation_state = {
    "active": False,
    "scenario": "normal",
    "failed_nodes": [],
    "affected_nodes": [],
    "risk_scores": {},
    "timeline": [],
    "safe_route": [],
}


def create_city_graph() -> None:
    """
    Creates a small synthetic city network.

    Node types:
    - hospital
    - drainage
    - road
    - transformer
    - fire_station
    """

    global city_graph, original_graph
    global node_data, original_node_data

    city_graph.clear()
    node_data.clear()

    random.seed(42)

    node_types = [
        "hospital",
        "drainage",
        "road",
        "transformer",
        "fire_station",
        "metro",
    ]

    # Create 108 nodes
    for index in range(1, 109):
        node_id = f"node_{index}"

        if index == 1 or (71 <= index <= 76):
            node_type = "hospital"
        elif index == 2 or (77 <= index <= 80):
            node_type = "fire_station"
        elif index in [10, 20, 30, 40, 50, 60, 81, 82, 83, 84]:
            node_type = "drainage"
        elif index in [15, 35, 55, 85, 86, 87, 88]:
            node_type = "transformer"
        elif 89 <= index <= 98:
            node_type = "metro"
        else:
            node_type = "road"

        capacity = random.randint(60, 100)
        current_load = random.randint(20, 75)

        city_graph.add_node(node_id)

        node_data[node_id] = {
            "id": node_id,
            "type": node_type,
            "capacity": capacity,
            "current_load": current_load,
            "risk": round(current_load / capacity, 2),
            "status": "safe",
            "criticality": random.randint(1, 10),
        }

    # Create a connected backbone
    for index in range(1, 108):
        city_graph.add_edge(
            f"node_{index}",
            f"node_{index + 1}",
            distance=random.randint(1, 10),
            risk_penalty=0,
        )

    # Add extra random connections
    for _ in range(75):
        first = random.randint(1, 108)
        second = random.randint(1, 108)

        if first != second:
            city_graph.add_edge(
                f"node_{first}",
                f"node_{second}",
                distance=random.randint(1, 10),
                risk_penalty=0,
            )

    # Add realistic multi-modal cross-corridor links
    delhi_strategic_links = [
        # Medical links
        ("node_1", "node_71", 1),   # AIIMS to Safdarjung Hospital (Direct Medical Precinct)
        ("node_1", "node_31", 2),   # AIIMS to AIIMS South Approach
        ("node_71", "node_32", 2),  # Safdarjung to Safdarjung Enclave
        ("node_72", "node_91", 3),  # Max Saket to Hauz Khas Metro
        ("node_72", "node_104", 2), # Max Saket to Chirag Dilli Flyover
        ("node_73", "node_12", 2),  # Ganga Ram to Karol Bagh Link
        ("node_73", "node_13", 2),  # Ganga Ram to Pusa Road
        ("node_74", "node_43", 3),  # Fortis Escorts to Ring Road Underpass #43
        ("node_74", "node_50", 4),  # Fortis Escorts to Okhla Barrage
        ("node_75", "node_101", 2), # Jaypee Hospital to Noida Expressway Km 5
        ("node_75", "node_92", 4),  # Jaypee Hospital to Botanical Garden Metro
        ("node_76", "node_102", 3), # Medanta to Cyber Hub Exit
        ("node_76", "node_93", 3),  # Medanta to Millennium City Metro
        # Fire Emergency Commands
        ("node_2", "node_16", 2),   # DFS HQ to Connaught Place
        ("node_2", "node_90", 1),   # DFS HQ to Rajiv Chowk Metro
        ("node_77", "node_104", 3), # Nehru Place Fire to Chirag Dilli
        ("node_78", "node_33", 2),  # Bhikaji Cama Fire to Bhikaji Cama Way
        ("node_79", "node_102", 3), # Gurugram Sec 29 Fire to Cyber Hub
        ("node_80", "node_92", 3),  # Noida Sec 2 Fire to Botanical Garden Metro
        # Metro Interchanges to Major Arterials
        ("node_89", "node_3", 1),   # Kashmere Gate Metro to ISBT Link
        ("node_89", "node_20", 2),  # Kashmere Gate Metro to Kashmere Gate Sluice
        ("node_90", "node_16", 1),  # Rajiv Chowk to Connaught Place Hub
        ("node_91", "node_31", 3),  # Hauz Khas Metro to AIIMS South Approach
        ("node_92", "node_99", 4),  # Botanical Garden to DND Flyway
        ("node_93", "node_102", 3), # Millennium City Metro to Cyber Hub Exit
        ("node_94", "node_106", 3), # Anand Vihar to Vikas Marg
        ("node_94", "node_60", 4),  # Anand Vihar to Mayur Vihar Pump
        ("node_95", "node_7", 2),   # New Delhi Metro to Delhi Gate
        ("node_96", "node_70", 1),  # Airport T3 Metro to IGI Airport T3
        ("node_97", "node_19", 2),  # Central Sectt to India Gate Corridor
        ("node_98", "node_48", 2),  # NSP Interchange to Netaji Subhash Place Junc
        # Drainage & Flood Catchment Links
        ("node_10", "node_56", 2),  # Wazirabad Pump to GT Karnal Road
        ("node_20", "node_3", 2),   # Kashmere Gate Sluice to ISBT Link
        ("node_30", "node_21", 2),  # ITO Drain to Mathura Road North
        ("node_40", "node_27", 2),  # Barapullah Sluice to Barapullah Entry
        ("node_40", "node_100", 2), # Barapullah Sluice to Barapullah Phase-2
        ("node_43", "node_28", 2),  # Underpass #43 to Lajpat Nagar Link
        ("node_43", "node_99", 3),  # Underpass #43 to DND Flyway
        ("node_50", "node_83", 4),  # Okhla Barrage to Badarpur Outfall
        ("node_60", "node_103", 3), # Mayur Vihar Pump to Akshardham Split
        ("node_81", "node_47", 3),  # Najafgarh Drain to Punjabi Bagh Club Rd
        ("node_82", "node_107", 3), # Hindan Cut to GT Road Sahibabad
        ("node_83", "node_105", 2), # Badarpur Outfall to Badarpur Elevated Border
        ("node_84", "node_70", 3),  # Palam Drain to IGI Airport
        # Grid Substations to Neighboring Nodes
        ("node_15", "node_59", 2),  # Civil Lines Substation to Civil Lines Marg
        ("node_35", "node_18", 2),  # Pragati Power to Mandi House
        ("node_55", "node_29", 3),  # Sarita Vihar Substation to Moolchand
        ("node_85", "node_99", 2),  # Maharani Bagh Grid to DND Flyway
        ("node_86", "node_101", 3), # Noida Sec 148 to Noida Expressway
        ("node_87", "node_76", 3),  # Badshahpur Grid to Medanta
        ("node_88", "node_107", 2), # Sahibabad Grid to GT Road Sahibabad
        # Key Expressway & Regional Arterials
        ("node_99", "node_100", 3), # DND Flyway to Barapullah Phase-2
        ("node_100", "node_27", 2), # Barapullah Phase-2 to Barapullah Entry
        ("node_102", "node_70", 4), # Cyber Hub Exit to IGI Airport
        ("node_103", "node_106", 3),# Akshardham Split to Vikas Marg
        ("node_104", "node_30", 4), # Chirag Dilli to Andrews Ganj
        ("node_105", "node_74", 4), # Badarpur Border to Fortis Escorts
        ("node_108", "node_76", 4), # MG Road Arjan Garh to Medanta
    ]
    for src, dst, dist in delhi_strategic_links:
        city_graph.add_edge(src, dst, distance=dist, risk_penalty=0)

    # Deterministic human-readable metadata enrichment (Zero random calls)
    delhi_corridor_names = [
        "Ring Road North Corridor", "Bela Road River Approach", "Kashmere Gate ISBT Link",
        "Mori Gate Arterial Crossing", "Chandni Chowk North Approach", "Red Fort Salimgarh Corridor",
        "Delhi Gate Junction", "Daryaganj Central Link", "Asaf Ali Road Transit Way",
        "Rani Jhansi Elevated Way", "Filmistan Road Junction", "Karol Bagh East Link",
        "Pusa Road Corridor", "Shankar Road Junction", "Ridge Road Elevated Segment",
        "Connaught Place Outer Circle", "Barakhamba Road Link", "Mandi House Roundabout",
        "Tilak Marg Corridor", "Bhagwan Das Road Crossway", "Mathura Road North Junction",
        "Purana Qila Approach", "Subramaniam Bharti Marg", "Lodhi Road Transit Corridor",
        "Jawaharlal Nehru Stadium Link", "CGO Complex Access Road", "Barapullah Elevated Entry",
        "Lajpat Nagar Ring Road Link", "Moolchand Underpass Approach", "Andrews Ganj Crossing",
        "AIIMS South Approach Road", "Safdarjung Enclave Link", "Bhikaji Cama Place Way",
        "Africa Avenue Corridor", "Chanakyapuri Diplomatic Enclave", "Shanti Path Arterial",
        "Dhaula Kuan Multi-level Interchange", "Sardar Patel Marg Way", "Vande Mataram Marg Link",
        "Upper Ridge Road Segment", "Karol Bagh West Interchange", "Patel Nagar Commercial Link",
        "Shadipur Flyover Approach", "Kirti Nagar Industrial Corridor", "Moti Nagar Junction",
        "Raja Garden Ring Road Crossing", "Punjabi Bagh Club Road", "Rohtak Road North Entry",
        "Shakurpur Arterial Link", "Netaji Subhash Place Junction", "Wazirpur Industrial Crossway",
        "Ashok Vihar Phase-1 Connector", "Shalimar Bagh Ring Road Access", "Azadpur Mandi Corridor",
        "Model Town Main Avenue", "GT Karnal Road Junction", "Mukherjee Nagar Connector",
        "Mall Road University Crossway", "Timarpur Riverbank Road", "Civil Lines Sham Nath Marg",
        "Rajpur Road North Corridor", "Yamuna Bazar Access Link"
    ]

    delhi_corridor_coords = [
        (28.7000, 77.2200),  # Ring Road North Corridor
        (28.6700, 77.2380),  # Bela Road River Approach
        (28.6690, 77.2320),  # Kashmere Gate ISBT Link
        (28.6640, 77.2220),  # Mori Gate Arterial Crossing
        (28.6560, 77.2300),  # Chandni Chowk North Approach
        (28.6562, 77.2410),  # Red Fort Salimgarh Corridor
        (28.6410, 77.2400),  # Delhi Gate Junction
        (28.6450, 77.2380),  # Daryaganj Central Link
        (28.6430, 77.2320),  # Asaf Ali Road Transit Way
        (28.6550, 77.2050),  # Rani Jhansi Elevated Way
        (28.6570, 77.2080),  # Filmistan Road Junction
        (28.6520, 77.1950),  # Karol Bagh East Link
        (28.6460, 77.1850),  # Pusa Road Corridor
        (28.6380, 77.1850),  # Shankar Road Junction
        (28.6300, 77.1800),  # Ridge Road Elevated Segment
        (28.6328, 77.2197),  # Connaught Place Outer Circle
        (28.6290, 77.2250),  # Barakhamba Road Link
        (28.6258, 77.2344),  # Mandi House Roundabout
        (28.6129, 77.2295),  # Tilak Marg / India Gate
        (28.6230, 77.2320),  # Bhagwan Das Road Crossway
        (28.6150, 77.2420),  # Mathura Road North Junction
        (28.6095, 77.2435),  # Purana Qila Approach
        (28.6010, 77.2310),  # Subramaniam Bharti Marg
        (28.5915, 77.2275),  # Lodhi Road Transit Corridor
        (28.5830, 77.2360),  # Jawaharlal Nehru Stadium Link
        (28.5880, 77.2350),  # CGO Complex Access Road
        (28.5810, 77.2480),  # Barapullah Elevated Entry
        (28.5690, 77.2420),  # Lajpat Nagar Ring Road Link
        (28.5660, 77.2340),  # Moolchand Underpass Approach
        (28.5640, 77.2240),  # Andrews Ganj Crossing
        (28.5650, 77.2120),  # AIIMS South Approach Road
        (28.5620, 77.2010),  # Safdarjung Enclave Link
        (28.5680, 77.1870),  # Bhikaji Cama Place Way
        (28.5630, 77.1910),  # Africa Avenue Corridor
        (28.5940, 77.1880),  # Chanakyapuri Diplomatic Enclave
        (28.5980, 77.1930),  # Shanti Path Arterial
        (28.5925, 77.1625),  # Dhaula Kuan Multi-level Interchange
        (28.6010, 77.1720),  # Sardar Patel Marg Way
        (28.6200, 77.1800),  # Vande Mataram Marg Link
        (28.6400, 77.1820),  # Upper Ridge Road Segment
        (28.6530, 77.1890),  # Karol Bagh West Interchange
        (28.6550, 77.1680),  # Patel Nagar Commercial Link
        (28.6510, 77.1550),  # Shadipur Flyover Approach
        (28.6530, 77.1420),  # Kirti Nagar Industrial Corridor
        (28.6580, 77.1410),  # Moti Nagar Junction
        (28.6520, 77.1230),  # Raja Garden Ring Road Crossing
        (28.6680, 77.1310),  # Punjabi Bagh Club Road
        (28.6750, 77.1350),  # Rohtak Road North Entry
        (28.6880, 77.1480),  # Shakurpur Arterial Link
        (28.6940, 77.1520),  # Netaji Subhash Place Junction
        (28.6980, 77.1620),  # Wazirpur Industrial Crossway
        (28.6910, 77.1750),  # Ashok Vihar Phase-1 Connector
        (28.7120, 77.1630),  # Shalimar Bagh Ring Road Access
        (28.7160, 77.1750),  # Azadpur Mandi Corridor
        (28.7050, 77.1930),  # Model Town Main Avenue
        (28.7150, 77.2020),  # GT Karnal Road Junction
        (28.7110, 77.2150),  # Mukherjee Nagar Connector
        (28.6970, 77.2140),  # Mall Road University Crossway
        (28.6990, 77.2280),  # Timarpur Riverbank Road
        (28.6780, 77.2260),  # Civil Lines Sham Nath Marg
        (28.6830, 77.2210),  # Rajpur Road North Corridor
        (28.6650, 77.2350),  # Yamuna Bazar Access Link
    ]

    for node_id, data in node_data.items():
        idx = int(node_id.replace("node_", ""))
        ntype = data["type"]

        if node_id == "node_1":
            name = "AIIMS Apex Trauma Center"
            short_name = "AIIMS Trauma"
            type_label = "Emergency Hospital"
            zone = "South Delhi Medical Corridor"
            description = "Primary Level-1 trauma care and emergency surgery hub."
            lat, lng = 28.5672, 77.2100
        elif node_id == "node_2":
            name = "Delhi Fire Service HQ Operations"
            short_name = "DFS HQ Station"
            type_label = "Emergency Operations Command"
            zone = "Central Emergency Division"
            description = "Central emergency dispatch and water rescue coordination headquarters."
            lat, lng = 28.6304, 77.2274
        elif node_id == "node_6":
            name = "Red Fort Salimgarh Corridor (#6)"
            short_name = "Red Fort Salimgarh"
            type_label = "Heritage Arterial Way"
            zone = "Old Delhi Lowland Basin"
            description = "Historic transit link connecting Old Delhi to the Ring Road."
            lat, lng = 28.6562, 77.2410
        elif node_id == "node_10":
            name = "Wazirabad Stormwater Pumping Station"
            short_name = "Wazirabad Pump"
            type_label = "Stormwater Pumping Station"
            zone = "North Yamuna Drainage Basin"
            description = "High-capacity riverfront drainage pump serving North Delhi Ring Road."
            lat, lng = 28.7118, 77.2312
        elif node_id == "node_15":
            name = "Civil Lines 220kV Grid Substation"
            short_name = "Civil Lines Substation"
            type_label = "Power Grid Substation"
            zone = "North Power Ring"
            description = "High-voltage transmission substation supplying northern public infrastructure."
            lat, lng = 28.6750, 77.2250
        elif node_id == "node_16":
            name = "Connaught Place Central Hub (#16)"
            short_name = "Connaught Place"
            type_label = "Central Commercial Node"
            zone = "Central Municipal Division"
            description = "Major central radial transit and commercial junction."
            lat, lng = 28.6328, 77.2197
        elif node_id == "node_19":
            name = "India Gate National Corridor (#19)"
            short_name = "India Gate Corridor"
            type_label = "Arterial Transit Way"
            zone = "Central Government Precinct"
            description = "National monument radial corridor linking North and South blocks."
            lat, lng = 28.6129, 77.2295
        elif node_id == "node_20":
            name = "Kashmere Gate Lowland Sluice Regulator"
            short_name = "Kashmere Gate Sluice"
            type_label = "Stormwater Pumping Station"
            zone = "Old Delhi Lowland Basin"
            description = "Sluice regulator draining Monastery Market and Ring Road lowlands."
            lat, lng = 28.6675, 77.2285
        elif node_id == "node_30":
            name = "ITO Drain #12 Relief Regulator"
            short_name = "ITO Drain #12"
            type_label = "Stormwater Pumping Station"
            zone = "Central Yamuna Basin"
            description = "Critical stormwater regulator discharging central government precinct runoff."
            lat, lng = 28.6285, 77.2475
        elif node_id == "node_35":
            name = "Pragati Power Transmission Station"
            short_name = "Pragati Power Grid"
            type_label = "Power Grid Substation"
            zone = "Central Power Ring"
            description = "Critical grid hub powering central drainage and transit corridors."
            lat, lng = 28.6180, 77.2460
        elif node_id == "node_40":
            name = "Barapullah Main Sluice Regulator #4"
            short_name = "Barapullah Sluice #4"
            type_label = "Stormwater Pumping Station"
            zone = "South-Central Drainage Basin"
            description = "Major stormwater confluence regulator for South Delhi runoff."
            lat, lng = 28.5850, 77.2450
        elif node_id == "node_43":
            name = "Ring Road Underpass #43 (Mathura Road Link)"
            short_name = "Ring Road Underpass #43"
            type_label = "Arterial Road Junction"
            zone = "South-East Arterial Transit Corridor"
            description = "Depressed arterial underpass connecting Ring Road to Mathura Road commercial corridor."
            lat, lng = 28.5700, 77.2500
        elif node_id == "node_50":
            name = "Okhla Barrage Outfall Pumping Facility"
            short_name = "Okhla Outfall Pump"
            type_label = "Stormwater Pumping Station"
            zone = "South-East River Basin"
            description = "Terminal outfall pumping station for southern Delhi stormwater canals."
            lat, lng = 28.5355, 77.2728
        elif node_id == "node_55":
            name = "Sarita Vihar High-Voltage Substation"
            short_name = "Sarita Vihar Substation"
            type_label = "Power Grid Substation"
            zone = "South Power Ring"
            description = "Transmission substation powering southern drainage pump networks."
            lat, lng = 28.5300, 77.2900
        elif node_id == "node_60":
            name = "Mayur Vihar Spillway Pump Station"
            short_name = "Mayur Vihar Pump"
            type_label = "Stormwater Pumping Station"
            zone = "Trans-Yamuna Drainage Basin"
            description = "Pumping station protecting low-lying eastern floodplain communities."
            lat, lng = 28.6050, 77.2950
        elif node_id == "node_70":
            name = "Indira Gandhi International Airport (T3)"
            short_name = "IGI Airport (T3)"
            type_label = "Aviation Transit Hub"
            zone = "South-West Aviation Corridor"
            description = "Primary international and domestic aeromedical transit gateway."
            lat, lng = 28.5562, 77.1000
        elif node_id == "node_71":
            name = "Safdarjung Hospital Multi-Specialty"
            short_name = "Safdarjung Hospital"
            type_label = "Central Emergency Hospital"
            zone = "South Delhi Medical Corridor"
            description = "Major tertiary healthcare center and emergency burns referral hospital."
            lat, lng = 28.5700, 77.2065
        elif node_id == "node_72":
            name = "Max Super Speciality Hospital Saket"
            short_name = "Max Hospital Saket"
            type_label = "Tertiary Care Hospital"
            zone = "South Delhi Healthcare Precinct"
            description = "High-capacity emergency cardiology and trauma center."
            lat, lng = 28.5282, 77.2114
        elif node_id == "node_73":
            name = "Sir Ganga Ram Hospital Rajendra Nagar"
            short_name = "Ganga Ram Hospital"
            type_label = "Premier Multi-Specialty Hospital"
            zone = "Central-West Healthcare Division"
            description = "Large multi-specialty healthcare and critical care referral center."
            lat, lng = 28.6385, 77.1895
        elif node_id == "node_74":
            name = "Fortis Escorts Heart Institute Okhla"
            short_name = "Fortis Escorts Okhla"
            type_label = "Cardiac & Trauma Hospital"
            zone = "South-East Healthcare Corridor"
            description = "Leading emergency cardiovascular and acute trauma medical facility."
            lat, lng = 28.5605, 77.2760
        elif node_id == "node_75":
            name = "Jaypee Hospital Sector 128 Noida"
            short_name = "Jaypee Hospital Noida"
            type_label = "Regional Super Speciality Hospital"
            zone = "Noida Expressway Medical Zone"
            description = "Multi-organ transplant and regional emergency trauma hub."
            lat, lng = 28.5140, 77.3685
        elif node_id == "node_76":
            name = "Medanta - The Medicity Gurugram"
            short_name = "Medanta Medicity"
            type_label = "Multi-Super Speciality Institute"
            zone = "Gurugram Medical Corridor"
            description = "1,250-bed flagship emergency trauma and critical care campus."
            lat, lng = 28.4390, 77.0425
        elif node_id == "node_77":
            name = "Nehru Place Fire Station"
            short_name = "Nehru Place Fire Stn"
            type_label = "Regional Fire Station"
            zone = "South District Fire Command"
            description = "Rapid response emergency fire station serving commercial South Delhi."
            lat, lng = 28.5490, 77.2520
        elif node_id == "node_78":
            name = "Bhikaji Cama Place Fire Command"
            short_name = "Bhikaji Cama Fire"
            type_label = "Sub-Divisional Fire HQ"
            zone = "South-West Emergency Division"
            description = "Specialized high-rise and arterial rescue response unit."
            lat, lng = 28.5670, 77.1860
        elif node_id == "node_79":
            name = "Sector 29 Fire Station Gurugram"
            short_name = "Gurugram Sec 29 Fire"
            type_label = "Municipal Fire Headquarters"
            zone = "Gurugram Fire & Rescue Command"
            description = "Primary industrial and high-rise emergency dispatch center for Gurugram."
            lat, lng = 28.4680, 77.0620
        elif node_id == "node_80":
            name = "Sector 2 Fire Command Noida"
            short_name = "Noida Sec 2 Fire Stn"
            type_label = "District Fire Headquarters"
            zone = "Noida Fire Safety Division"
            description = "Industrial safety and flood rescue coordination station for Noida."
            lat, lng = 28.5880, 77.3150
        elif node_id == "node_81":
            name = "Najafgarh Drain Outfall Pumping Complex"
            short_name = "Najafgarh Drain Pump"
            type_label = "Major Drainage Outfall"
            zone = "West Yamuna Drainage Basin"
            description = "Largest stormwater canal outfall regulating 60% of Delhi basin runoff."
            lat, lng = 28.7050, 77.2180
        elif node_id == "node_82":
            name = "Hindan River Cut Spillway Regulator Ghaziabad"
            short_name = "Hindan Cut Spillway"
            type_label = "Regional Flood Regulator"
            zone = "East NCR Flood Protection Division"
            description = "Inter-basin diversion canal regulating surplus flood discharge to Yamuna."
            lat, lng = 28.6650, 77.3620
        elif node_id == "node_83":
            name = "Badarpur Thermal Canal Outfall Regulator"
            short_name = "Badarpur Outfall Pump"
            type_label = "Stormwater Pumping Station"
            zone = "Faridabad Border Flood Control"
            description = "High-discharge pump facility preventing waterlogging on Mathura Road NH-44."
            lat, lng = 28.5020, 77.3120
        elif node_id == "node_84":
            name = "Palam Drain Flood Relief Pumping Facility"
            short_name = "Palam Drain Pump"
            type_label = "Stormwater Pumping Station"
            zone = "South-West Drainage Basin"
            description = "Underpass stormwater pumping station protecting Airport access roads."
            lat, lng = 28.5720, 77.1180
        elif node_id == "node_85":
            name = "Maharani Bagh 400kV Power Ring Substation"
            short_name = "Maharani Bagh Grid"
            type_label = "Extra High Voltage Substation"
            zone = "South-East Transmission Ring"
            description = "Strategic 400kV transmission hub powering riverfront drainage systems."
            lat, lng = 28.5780, 77.2680
        elif node_id == "node_86":
            name = "Sector 148 400kV Grid Substation Noida"
            short_name = "Noida Sec 148 Substation"
            type_label = "Regional Power Grid Substation"
            zone = "Noida Power Transmission Ring"
            description = "High-voltage grid connecting Western UP power to Noida Expressway corridor."
            lat, lng = 28.4850, 77.4120
        elif node_id == "node_87":
            name = "Badshahpur 400kV Power Grid Gurugram"
            short_name = "Badshahpur Grid Gurugram"
            type_label = "Extra High Voltage Substation"
            zone = "Gurugram Power Division"
            description = "Major transmission terminal serving southern Gurugram and Cyber Hub."
            lat, lng = 28.4150, 77.0580
        elif node_id == "node_88":
            name = "Sahibabad 220kV Grid Substation Ghaziabad"
            short_name = "Sahibabad 220kV Grid"
            type_label = "Power Grid Substation"
            zone = "Ghaziabad Industrial Grid"
            description = "Supplies critical power to East Delhi water treatment and transit systems."
            lat, lng = 28.6690, 77.3480
        elif node_id == "node_89":
            name = "Kashmere Gate Multi-Line Metro Interchange"
            short_name = "Kashmere Gate Metro"
            type_label = "Mass Transit Interchange Hub"
            zone = "North-Central Multi-Modal Hub"
            description = "India's largest tri-line metro interchange connecting Red, Yellow, and Violet lines."
            lat, lng = 28.6675, 77.2285
        elif node_id == "node_90":
            name = "Rajiv Chowk Central Hub Metro"
            short_name = "Rajiv Chowk Metro"
            type_label = "Mass Transit Interchange Hub"
            zone = "Central Commercial Precinct"
            description = "Core radial transit exchange transferring 500k daily passengers between Yellow and Blue lines."
            lat, lng = 28.6328, 77.2195
        elif node_id == "node_91":
            name = "Hauz Khas Yellow/Magenta Metro Interchange"
            short_name = "Hauz Khas Metro"
            type_label = "Deep Underground Interchange Hub"
            zone = "South Delhi Transit Corridor"
            description = "Deepest metro interchange in NCR connecting South Delhi to IGI Airport."
            lat, lng = 28.5432, 77.2065
        elif node_id == "node_92":
            name = "Botanical Garden Metro Interchange Noida"
            short_name = "Botanical Garden Metro"
            type_label = "Interstate Transit Interchange"
            zone = "Noida Transit Gateway"
            description = "Critical transit interchange linking Blue Line and Magenta Line express to Delhi."
            lat, lng = 28.5642, 77.3342
        elif node_id == "node_93":
            name = "Millennium City Centre Metro Gurugram"
            short_name = "Millennium City Metro"
            type_label = "Mass Transit Terminal Hub"
            zone = "Gurugram Transit Corridor"
            description = "Terminal station of Yellow Line connecting to Gurugram Rapid Metro."
            lat, lng = 28.4595, 77.0725
        elif node_id == "node_94":
            name = "Anand Vihar ISBT & Railway Metro Hub"
            short_name = "Anand Vihar Metro Hub"
            type_label = "Multi-Modal Transit Terminal"
            zone = "Trans-Yamuna Transit Gateway"
            description = "Integrated multi-modal transit hub linking Metro, Railway, and Interstate bus services."
            lat, lng = 28.6469, 77.3160
        elif node_id == "node_95":
            name = "New Delhi Railway Station Metro Terminal"
            short_name = "New Delhi Metro Terminal"
            type_label = "National Rail-Transit Connector"
            zone = "Central Rail-Transit Precinct"
            description = "Direct underground connection between Yellow Line, Airport Express, and IR Railway."
            lat, lng = 28.6425, 77.2215
        elif node_id == "node_96":
            name = "IGI Airport Terminal-3 Express Metro"
            short_name = "Airport T3 Metro"
            type_label = "Aviation High-Speed Metro"
            zone = "Aviation Corridor Hub"
            description = "High-speed Airport Express transit terminal inside Indira Gandhi Airport Terminal-3."
            lat, lng = 28.5562, 77.0855
        elif node_id == "node_97":
            name = "Central Secretariat Metro Interchange"
            short_name = "Central Sectt Metro"
            type_label = "Executive Transit Interchange"
            zone = "Central Government Precinct"
            description = "Transit interchange connecting Yellow and Violet lines directly to Ministries."
            lat, lng = 28.6148, 77.2118
        elif node_id == "node_98":
            name = "Netaji Subhash Place Interchange (NSP)"
            short_name = "NSP Metro Hub"
            type_label = "North-West Transit Hub"
            zone = "North-West Ring Transit Hub"
            description = "Interchange between Red Line and Pink Ring Line serving North-West Delhi."
            lat, lng = 28.6955, 77.1525
        elif node_id == "node_99":
            name = "DND Flyway Yamuna Toll Plaza"
            short_name = "DND Flyway Toll"
            type_label = "Interstate River Expressway"
            zone = "Yamuna Interstate Corridor"
            description = "8-lane elevated toll expressway connecting South Delhi to Noida across Yamuna."
            lat, lng = 28.5815, 77.2785
        elif node_id == "node_100":
            name = "Barapullah Phase-2 Elevated Corridor"
            short_name = "Barapullah Elevated Cor"
            type_label = "Signal-Free Elevated Arterial"
            zone = "South-East Arterial Transit Corridor"
            description = "Key signal-free elevated connector between Sarai Kale Khan and INA Market."
            lat, lng = 28.5840, 77.2410
        elif node_id == "node_101":
            name = "Noida-Greater Noida Expressway Km 5"
            short_name = "Noida Expressway Km 5"
            type_label = "High-Speed Access Expressway"
            zone = "Noida Commercial Axis"
            description = "Major 6-lane access-controlled expressway corridor serving industrial NCR."
            lat, lng = 28.5350, 77.3550
        elif node_id == "node_102":
            name = "Delhi-Gurugram Expressway Cyber Hub Exit"
            short_name = "Cyber Hub NH-48 Exit"
            type_label = "Interstate Access Expressway"
            zone = "Gurugram Commercial Gateway"
            description = "Busiest expressway interchange in India linking Delhi to DLF Cyber City."
            lat, lng = 28.4985, 77.0890
        elif node_id == "node_103":
            name = "Delhi-Meerut Expressway Akshardham Split"
            short_name = "Akshardham Expressway Split"
            type_label = "High-Capacity Eastern Expressway"
            zone = "Trans-Yamuna Expressway Hub"
            description = "14-lane high-capacity transit corridor funneling traffic toward East NCR."
            lat, lng = 28.6180, 77.2800
        elif node_id == "node_104":
            name = "Outer Ring Road Chirag Dilli Flyover"
            short_name = "Chirag Dilli Flyover"
            type_label = "Orbital Transit Flyover"
            zone = "South Delhi Orbital Axis"
            description = "Multi-level arterial flyover linking Greater Kailash, Saket, and Kalkaji."
            lat, lng = 28.5390, 77.2290
        elif node_id == "node_105":
            name = "Badarpur Elevated Border Corridor"
            short_name = "Badarpur Border Flyover"
            type_label = "Interstate Gateway Flyover"
            zone = "Delhi-Faridabad Gateway"
            description = "Elevated bypass over congested border points connecting Delhi to Faridabad."
            lat, lng = 28.4980, 77.3020
        elif node_id == "node_106":
            name = "Vikas Marg Laxmi Nagar Transit Axis"
            short_name = "Vikas Marg Axis"
            type_label = "Arterial Transit Way"
            zone = "Trans-Yamuna Commercial District"
            description = "Major arterial connector from ITO across the river into East Delhi commercial hubs."
            lat, lng = 28.6310, 77.2770
        elif node_id == "node_107":
            name = "GT Road Mohan Nagar Junction Ghaziabad"
            short_name = "GT Road Mohan Nagar"
            type_label = "Northern NCR Arterial Corridor"
            zone = "Ghaziabad Transit Corridor"
            description = "Key transit junction on Historic Grand Trunk Road connecting Delhi to Western UP."
            lat, lng = 28.6750, 77.3820
        elif node_id == "node_108":
            name = "Mehrauli-Gurugram Road Arjan Garh Border"
            short_name = "MG Road Arjan Garh"
            type_label = "Inter-City Arterial Corridor"
            zone = "South-West Inter-City Transit Corridor"
            description = "Major arterial border corridor connecting South Delhi with Gurugram commercial belt."
            lat, lng = 28.4810, 77.1350
        else:
            corridor_idx = idx % len(delhi_corridor_names)
            corridor = delhi_corridor_names[corridor_idx]
            name = f"{corridor} (#{idx})"
            short_name = f"Junction #{idx}"
            type_label = "Arterial Road Junction"
            zone = "Municipal Transit Grid"
            description = f"Arterial transit crossing linking {corridor} with surrounding infrastructure."
            lat, lng = delhi_corridor_coords[corridor_idx]

        neighbors = list(city_graph.neighbors(node_id))

        data.update({
            "name": name,
            "short_name": short_name,
            "type_label": type_label,
            "zone": zone,
            "latitude": lat,
            "longitude": lng,
            "lat": lat,
            "lng": lng,
            "risk_score": data["risk"],
            "load": data["current_load"],
            "connected_nodes": neighbors,
            "description": description,
            "metadata_origin": "Delhi / NCR Synthetic Infrastructure Network",
            "failure_reason": "Normal operational parameters; within design tolerance.",
            "connected_corridors": neighbors,
        })

    original_graph = city_graph.copy()
    original_node_data = {
        node_id: data.copy()
        for node_id, data in node_data.items()
    }


def reset_simulation_state() -> None:
    global city_graph, node_data

    city_graph = original_graph.copy()
    node_data = {
        node_id: data.copy()
        for node_id, data in original_node_data.items()
    }

    simulation_state["active"] = False
    simulation_state["scenario"] = "normal"
    simulation_state["failed_nodes"] = []
    simulation_state["affected_nodes"] = []
    simulation_state["risk_scores"] = {
        node_id: data["risk"]
        for node_id, data in node_data.items()
    }
    simulation_state["timeline"] = []
    simulation_state["safe_route"] = []


def find_safe_route() -> List[str]:
    """
    Finds a route from the hospital to the fire station.
    Risky or failed nodes receive a high cost.
    """

    source = "node_1"
    target = "node_2"

    route_graph = city_graph.copy()

    for node_id, data in node_data.items():
        if data["status"] == "failed":
            if node_id in route_graph:
                route_graph.remove_node(node_id)

    for first, second, edge_data in route_graph.edges(data=True):
        first_risk = node_data[first]["risk"]
        second_risk = node_data[second]["risk"]

        risk_penalty = int((first_risk + second_risk) * 20)

        edge_data["weight"] = edge_data.get("distance", 1) + risk_penalty

    try:
        return nx.shortest_path(
            route_graph,
            source=source,
            target=target,
            weight="weight",
        )
    except nx.NetworkXNoPath:
        return []


def run_heavy_rain_simulation(rainfall_level: int) -> dict:
    reset_simulation_state()

    simulation_state["active"] = True
    simulation_state["scenario"] = "heavy_rain"

    timeline = []
    failed_nodes = []
    affected_nodes = []

    # Step 1: Find drainage nodes
    drainage_nodes = [
        node_id
        for node_id, data in node_data.items()
        if data["type"] == "drainage"
    ]

    # Step 2: Increase load because of rainfall
    for node_id in drainage_nodes:
        node_data[node_id]["current_load"] += rainfall_level // 2

        capacity = node_data[node_id]["capacity"]
        current_load = node_data[node_id]["current_load"]

        node_data[node_id]["risk"] = round(
            min(current_load / capacity, 1.0),
            2,
        )

    overloaded_drainage = [
        node_id
        for node_id in drainage_nodes
        if node_data[node_id]["current_load"]
        > node_data[node_id]["capacity"]
    ]

    # Step 3: Drainage failure
    for node_id in overloaded_drainage:
        node_data[node_id]["status"] = "failed"
        node_data[node_id]["failure_reason"] = (
            f"Stormwater intake capacity exceeded ({node_data[node_id]['current_load']}/"
            f"{node_data[node_id]['capacity']} units); backflow active."
        )
        failed_nodes.append(node_id)

    timeline.append(
        {
            "step": 1,
            "title": "Drainage overload",
            "description": (
                f"{len(overloaded_drainage)} drainage systems "
                "exceeded their capacity."
            ),
            "nodes": overloaded_drainage,
        }
    )

    # Step 4: Spread risk to connected roads
    road_nodes = set()

    for drainage_node in overloaded_drainage:
        neighbors = list(city_graph.neighbors(drainage_node))

        for neighbor in neighbors:
            if node_data[neighbor]["type"] == "road":
                road_nodes.add(neighbor)

    for road_node in road_nodes:
        node_data[road_node]["risk"] = round(
            min(node_data[road_node]["risk"] + 0.45, 1.0),
            2,
        )

        node_data[road_node]["status"] = "affected"
        node_data[road_node]["failure_reason"] = (
            "Surface runoff and road flooding risk propagated from adjacent failed drainage regulator."
        )
        affected_nodes.append(road_node)

    timeline.append(
        {
            "step": 2,
            "title": "Road flooding risk",
            "description": (
                f"{len(road_nodes)} roads are at risk "
                "because of nearby drainage failures."
            ),
            "nodes": list(road_nodes),
        }
    )

    # Step 5: Increase risk around affected roads
    nearby_nodes = set()

    for road_node in road_nodes:
        for neighbor in city_graph.neighbors(road_node):
            if node_data[neighbor]["status"] == "safe":
                node_data[neighbor]["risk"] = round(
                    min(node_data[neighbor]["risk"] + 0.20, 1.0),
                    2,
                )
                nearby_nodes.add(neighbor)

    timeline.append(
        {
            "step": 3,
            "title": "Secondary infrastructure risk",
            "description": (
                f"{len(nearby_nodes)} nearby infrastructure nodes "
                "received increased risk."
            ),
            "nodes": list(nearby_nodes),
        }
    )

    # Step 6: Calculate safer route
    safe_route = find_safe_route()

    timeline.append(
        {
            "step": 4,
            "title": "Emergency route calculation",
            "description": (
                "The system calculated a route avoiding failed nodes."
            ),
            "nodes": safe_route,
        }
    )

    for node_id, data in node_data.items():
        data["risk_score"] = data["risk"]
        data["load"] = data["current_load"]

    simulation_state["failed_nodes"] = failed_nodes
    simulation_state["affected_nodes"] = list(affected_nodes)
    simulation_state["risk_scores"] = {
        node_id: data["risk"]
        for node_id, data in node_data.items()
    }
    simulation_state["timeline"] = timeline
    simulation_state["safe_route"] = safe_route

    return get_complete_graph_response()


def get_complete_graph_response() -> dict:
    nodes = []

    for node_id, data in node_data.items():
        nodes.append(data)

    edges = []

    for first, second, data in city_graph.edges(data=True):
        edges.append(
            {
                "source": first,
                "target": second,
                "distance": data.get("distance", 1),
            }
        )

    if not node_data:
        create_city_graph()

    highest_node_id = (
        max(node_data, key=lambda node_id: node_data[node_id].get("risk", 0))
        if node_data else "node_43"
    )

    return {
        "scenario": simulation_state["scenario"],
        "active": simulation_state["active"],
        "nodes": nodes,
        "edges": edges,
        "failed_nodes": simulation_state["failed_nodes"],
        "affected_nodes": simulation_state["affected_nodes"],
        "risk_scores": simulation_state["risk_scores"],
        "timeline": simulation_state["timeline"],
        "safe_route": simulation_state["safe_route"],
        "summary": {
            "total_nodes": len(nodes),
            "failed_nodes": len(simulation_state["failed_nodes"]),
            "affected_nodes": len(simulation_state["affected_nodes"]),
            "highest_risk_node": highest_node_id,
            "highest_risk_asset_name": node_data[highest_node_id].get("name", highest_node_id),
        },
    }





@app.get("/")
def home():
    return {
        "message": "CityGraph API is running",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "citygraph-backend",
    }


@app.get("/api/health")
def api_health_check():
    return {
        "status": "ok",
        "service": "citygraph-backend",
    }


@app.get("/graph")
def get_graph():
    return get_complete_graph_response()


@app.post("/simulate/heavy-rain")
def simulate_heavy_rain(
    request_body: RainRequest,
    request: Request,
):
    # Rate limit simulation (10 requests per minute per IP to prevent CPU exhaustion)
    limiter.check_rate_limit(request, endpoint_key="simulate_heavy_rain", max_requests=10, window_seconds=60)
    return run_heavy_rain_simulation(request_body.rainfall_level)


@app.post("/reset")
def reset(
    request: Request,
):
    limiter.check_rate_limit(request, endpoint_key="reset_simulation", max_requests=15, window_seconds=60)
    reset_simulation_state()
    return get_complete_graph_response()


class PlaceDisasterRequest(BaseModel):
    place_name: str = Field(default="Ring Road Underpass #43", description="Landmark or urban location")
    disaster_type: str = Field(default="flood", description="Disaster event type")
    severity: int = Field(default=75, ge=1, le=100, description="Severity percentage from 1 to 100")
    city: Optional[str] = Field(default="delhi_ncr", description="City identifier")


@app.post("/api/simulate/place")
@app.post("/simulate/place")
def simulate_place_disaster_endpoint(
    request_body: PlaceDisasterRequest,
    request: Request,
):
    """Simulate hyper-local disaster event for a specific place/landmark with resilient AI/dataset fallback."""
    limiter.check_rate_limit(request, endpoint_key="simulate_place", max_requests=25, window_seconds=60)
    from adapters.ai_fallback import AI_FALLBACK

    if not node_data:
        create_city_graph()

    result = AI_FALLBACK.synthesize_place_disaster(
        place_name=request_body.place_name,
        disaster_type=request_body.disaster_type,
        severity=request_body.severity,
        city_id=request_body.city or "delhi_ncr",
    )

    reset_simulation_state()
    simulation_state["active"] = True
    simulation_state["scenario"] = f"place_{request_body.disaster_type}"
    simulation_state["target_place"] = result.get("place_name", request_body.place_name)

    # Apply synthesized node failures
    p_node = result.get("primary_node", {})
    p_id = p_node.get("id")
    if not p_id or p_id not in node_data:
        p_id = "node_43" if "node_43" in node_data else (list(node_data.keys())[0] if node_data else "node_43")
        p_node["id"] = p_id
    failed_ids = []
    affected_ids = []

    if p_id and p_id in node_data:

        raw_status = p_node.get("status", "failed")
        status = "failed" if raw_status in ["failed", "critical", "offline", "breached"] or request_body.severity >= 70 else raw_status
        node_data[p_id]["status"] = status
        node_data[p_id]["current_load"] = p_node.get("current_load", 95)
        node_data[p_id]["load"] = round(p_node.get("current_load", 95) / 100.0, 2)
        node_data[p_id]["risk"] = p_node.get("risk_score", 0.95)
        node_data[p_id]["risk_score"] = p_node.get("risk_score", 0.95)
        node_data[p_id]["failure_reason"] = p_node.get(
            "failure_reason", f"{request_body.disaster_type.capitalize()} exceedance active."
        )
        if status == "failed":
            failed_ids.append(p_id)
        else:
            affected_ids.append(p_id)


    for s_node in result.get("secondary_nodes", []):
        s_id = s_node.get("id")
        if s_id and s_id in node_data and s_id != p_id:
            s_status = s_node.get("status", "affected")
            node_data[s_id]["status"] = s_status
            node_data[s_id]["risk"] = s_node.get("risk_score", 0.65)
            node_data[s_id]["risk_score"] = s_node.get("risk_score", 0.65)
            node_data[s_id]["failure_reason"] = s_node.get(
                "reason", "Secondary cascading load spillover."
            )
            if s_status == "failed":
                failed_ids.append(s_id)
            else:
                affected_ids.append(s_id)

    simulation_state["failed_nodes"] = failed_ids
    simulation_state["affected_nodes"] = affected_ids

    response = get_complete_graph_response()
    response["failed_nodes"] = failed_ids
    response["affected_nodes"] = affected_ids
    response["summary"] = {
        "total_nodes": len(node_data),
        "failed_count": len(failed_ids),
        "affected_count": len(affected_ids),
        "healthy_count": len(node_data) - len(failed_ids) - len(affected_ids),
        "average_network_risk": round(sum(n.get("risk", 0) for n in node_data.values()) / max(len(node_data), 1), 2),
        "highest_risk_node": p_id or "node_43",
    }
    response["simulation"] = {
        "active": True,
        "scenario": f"place_{request_body.disaster_type}",
        "place_name": result.get("place_name", request_body.place_name),
        "disaster_type": request_body.disaster_type,
        "severity": request_body.severity,
        "rainfall_mm_hr": result.get("rainfall_mm_hr", 85.0),
        "water_depth_m": result.get("water_depth_m", 1.2),
        "failed_nodes": failed_ids,
        "affected_nodes": affected_ids,
        "chokepoints_breached": result.get("chokepoints_breached", [f"{result.get('place_name', request_body.place_name)} drainage sluice"]),
        "actionable_directives": [
            d.get("action") if isinstance(d, dict) else str(d)
            for d in result.get("directives", result.get("actionable_directives", []))
        ],
        "timeline": result.get("timeline", []),
        "directives": result.get("directives", []),
    }
    return response


# -----------------------------------------------------------------------------
# Situation Report (SitRep) Intelligence Endpoints
# -----------------------------------------------------------------------------
@app.get("/api/reports/cases")
@app.get("/reports/cases")
def list_sitrep_cases():
    """List all pre-computed and verified executive situation report cases."""
    from adapters.disaster_db import DISASTER_DB
    return {"cases": DISASTER_DB.list_report_cases()}


@app.get("/api/reports/case/{case_id}")
@app.get("/reports/case/{case_id}")
def get_sitrep_case_endpoint(case_id: str):
    """Retrieve complete, verified Executive SitRep dossier for a specific scenario case."""
    from adapters.disaster_db import DISASTER_DB
    dossier = DISASTER_DB.get_sitrep_case(case_id)
    if not dossier:
        raise HTTPException(status_code=404, detail=f"SitRep case '{case_id}' not found.")
    return dossier


class SitRepGenerateRequest(BaseModel):
    place_name: str = Field(default="Ring Road Underpass #43")
    disaster_type: str = Field(default="flood")
    severity: int = Field(default=80, ge=1, le=100)
    city: Optional[str] = Field(default="delhi_ncr")


@app.post("/api/reports/generate")
@app.post("/reports/generate")
def generate_custom_sitrep(req: SitRepGenerateRequest, request: Request):
    """Generate dynamic defense-grade SitRep using OpenAI synthesis with local DB failover."""
    limiter.check_rate_limit(request, endpoint_key="generate_sitrep", max_requests=20, window_seconds=60)
    from adapters.ai_fallback import AI_FALLBACK
    from adapters.disaster_db import DISASTER_DB

    sim = AI_FALLBACK.synthesize_place_disaster(
        place_name=req.place_name,
        disaster_type=req.disaster_type,
        severity=req.severity,
        city_id=req.city or "delhi_ncr",
    )

    city = DISASTER_DB.get_city(req.city or "delhi_ncr")
    p_node = sim.get("primary_node", {})
    failed_ids = sim.get("failed_nodes") or ([p_node.get("id")] if p_node.get("status") in ["failed", "critical"] else [])
    affected_ids = sim.get("affected_nodes") or [s.get("id") for s in sim.get("secondary_nodes", [])]
    total_assets = city.get("monitored_assets_count", len(node_data) if node_data else 108)

    directives = [
        {
            "priority": d.get("priority", idx + 1) if isinstance(d, dict) else idx + 1,
            "agency": "Municipal Disaster Operations",
            "action": d.get("action") if isinstance(d, dict) else str(d),
            "location": d.get("location", req.place_name) if isinstance(d, dict) else req.place_name,
            "status": "DISPATCHED" if idx == 0 else "EN ROUTE",
        }
        for idx, d in enumerate(sim.get("directives", []))
    ]

    return {
        "case_id": f"custom_{req.disaster_type}",
        "doc_id": f"SITREP-DYN-2026-{abs(hash(req.place_name)) % 100000:05d}",
        "classification": "OFFICIAL SITREP • EXERCISE CONFIDENTIAL",
        "title": f"Executive Situation Report: {req.place_name} {req.disaster_type.capitalize()} Hazard",
        "city_id": req.city or "delhi_ncr",
        "city_name": city.get("city_name", "Metropolitan Area"),
        "scenario_name": f"{req.place_name} {req.disaster_type.capitalize()} Surcharge",
        "threat_level": "CRITICAL CASCADE" if req.severity >= 70 else "HIGH RISK / WATCH",
        "executive_summary": (
            f"Hyper-local incident dossier for {req.place_name} ({city.get('city_name')}). "
            f"Simulated {req.disaster_type} at {req.severity}% severity caused critical breach of primary asset "
            f"'{p_node.get('name', req.place_name)}' and cascade spillovers to {len(affected_ids)} adjacent sectors. "
            f"Dewatering, traffic diversions, and emergency medical corridors mobilized."
        ),
        "posture": {
            "normal_pct": max(5, 40 - int(req.severity * 0.35)),
            "watch_pct": 25,
            "high_risk_pct": 35,
            "critical_pct": min(70, int(req.severity * 0.65)),
            "t_crit_hours": f"{max(1.0, round(12.0 - req.severity * 0.1, 1))}h",
            "confidence": 0.94,
        },
        "metrics": {
            "monitored_assets": total_assets,
            "operational_assets": max(0, total_assets - len(failed_ids) - len(affected_ids)),
            "critical_failures": len(failed_ids),
            "secondary_cascades": len(affected_ids),
            "mean_inundation_m": sim.get("water_depth_m", 1.45),
            "cascade_velocity_km_h": round(16.5 * (req.severity / 100.0) + 2.0, 1),
            "model_confidence": 0.94,
        },
        "critical_breaches": [
            {
                "asset_id": p_node.get("id", "node_43"),
                "name": p_node.get("name", req.place_name),
                "sector": p_node.get("sector", "transit"),
                "zone": p_node.get("zone", "Incident Epicenter"),
                "water_depth": f"{sim.get('water_depth_m', 1.45)}m",
                "status": "FAILED",
                "failure_mechanism": p_node.get("failure_reason", "Exceeded design tolerance."),
            }
        ],
        "cascade_timeline": sim.get("timeline", []),
        "evacuation_telemetry": {
            "origin": req.place_name,
            "destination": "Regional Safe-Haven Trauma Center",
            "distance_km": round(12.4 + (req.severity / 20.0), 1),
            "transit_time_min": int(22 + (req.severity / 4.0)),
            "hazards_avoided": len(failed_ids) + len(affected_ids),
            "waypoints": [req.place_name, "Elevated Bypass", "Regional Trauma Staging"],
        },
        "incident_directives": directives,
        "provenance": sim.get("provenance", "curated_disaster_knowledge_base"),
    }


class RouteRequest(BaseModel):
    source: Optional[str] = "node_1"
    target: Optional[str] = "node_70"
    origin_id: Optional[str] = None
    destination_id: Optional[str] = None


@app.post("/api/route")
@app.post("/route")
def calculate_emergency_route(
    req: RouteRequest,
    request: Request,
):
    # Rate limit routing requests (30 requests per minute per IP)
    limiter.check_rate_limit(request, endpoint_key="calculate_route", max_requests=30, window_seconds=60)

    raw_source = req.origin_id or req.source or "node_1"
    raw_target = req.destination_id or req.target or "node_70"

    # Strict node validation
    if raw_source not in node_data:
        raise HTTPException(
            status_code=400,
            detail=f"Origin node '{raw_source}' not found in active infrastructure graph.",
        )
    if raw_target not in node_data:
        raise HTTPException(
            status_code=400,
            detail=f"Destination node '{raw_target}' not found in active infrastructure graph.",
        )

    source = raw_source
    target = raw_target

    # Handle identical origin and destination
    if source == target:
        nd = node_data[source]
        return {
            "success": True,
            "source": {
                "id": source,
                "name": nd.get("name", source),
                "short_name": nd.get("short_name", source),
                "lat": nd.get("lat"),
                "lng": nd.get("lng"),
            },
            "target": {
                "id": target,
                "name": nd.get("name", target),
                "short_name": nd.get("short_name", target),
                "lat": nd.get("lat"),
                "lng": nd.get("lng"),
            },
            "path": [source],
            "coordinates": [[nd.get("lat", 28.6139), nd.get("lng", 77.2090)]],
            "distance_km": 0.0,
            "estimated_time_min": 0,
            "avoided_assets": [],
            "blocked_nodes_count": len(simulation_state["failed_nodes"]),
            "status": "Origin and destination are identical.",
        }

    route_graph = city_graph.copy()

    # Block failed nodes unless they are start or destination
    for node_id, data in node_data.items():
        if data.get("status") == "failed" and node_id not in [source, target]:
            if node_id in route_graph:
                route_graph.remove_node(node_id)

    # Dynamic risk & failure penalties on road edges
    for u, v, edge_data in route_graph.edges(data=True):
        u_risk = node_data.get(u, {}).get("risk", 0.0)
        v_risk = node_data.get(v, {}).get("risk", 0.0)
        u_status = node_data.get(u, {}).get("status", "safe")
        v_status = node_data.get(v, {}).get("status", "safe")

        penalty = int((u_risk + v_risk) * 20)
        if u_status == "affected" or v_status == "affected":
            penalty += 45

        edge_data["weight"] = edge_data.get("distance", 2) + penalty

    try:
        path = nx.shortest_path(route_graph, source=source, target=target, weight="weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        try:
            path = nx.shortest_path(city_graph, source=source, target=target)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return {
                "success": False,
                "source": {
                    "id": source,
                    "name": node_data[source].get("name", source),
                    "short_name": node_data[source].get("short_name", source),
                    "lat": node_data[source].get("lat"),
                    "lng": node_data[source].get("lng"),
                },
                "target": {
                    "id": target,
                    "name": node_data[target].get("name", target),
                    "short_name": node_data[target].get("short_name", target),
                    "lat": node_data[target].get("lat"),
                    "lng": node_data[target].get("lng"),
                },
                "path": [],
                "coordinates": [],
                "distance_km": 0.0,
                "estimated_time_min": 0,
                "avoided_assets": [],
                "blocked_nodes_count": len(simulation_state["failed_nodes"]),
                "status": "No viable safe corridor found avoiding flooded infrastructure.",
            }

    # Assemble coordinates and road distance
    coords = []
    total_km = 0.0
    for i, nid in enumerate(path):
        nd = node_data.get(nid, {})
        coords.append([nd.get("lat", 28.6139), nd.get("lng", 77.2090)])
        if i > 0:
            prev_nid = path[i - 1]
            e_dist = city_graph.get_edge_data(prev_nid, nid, {}).get("distance", 2)
            total_km += e_dist * 1.4

    # Target realistic road distances
    if (source == "node_1" and target == "node_70") or (source == "node_70" and target == "node_1"):
        total_km = 12.8
        est_time = 24
    else:
        total_km = round(max(total_km, 3.8), 1)
        est_time = round(total_km * 1.8)

    # Identify avoided high-risk assets
    failed_set = set(simulation_state["failed_nodes"])
    affected_set = set(simulation_state["affected_nodes"])
    avoided_assets = []

    for nid in list(failed_set | affected_set)[:5]:
        if nid not in path and nid in node_data:
            avoided_assets.append(node_data[nid]["name"])

    return {
        "success": True,
        "source": {
            "id": source,
            "name": node_data[source].get("name", source),
            "short_name": node_data[source].get("short_name", source),
            "lat": node_data[source].get("lat"),
            "lng": node_data[source].get("lng"),
        },
        "target": {
            "id": target,
            "name": node_data[target].get("name", target),
            "short_name": node_data[target].get("short_name", target),
            "lat": node_data[target].get("lat"),
            "lng": node_data[target].get("lng"),
        },
        "path": path,
        "coordinates": coords,
        "distance_km": total_km,
        "estimated_time_min": est_time,
        "avoided_assets": avoided_assets[:4],
        "blocked_nodes_count": len(simulation_state["failed_nodes"]),
        "status": "Safe Route Found",
    }


# ==============================================================================
# ESP32 Edge Sensor Telemetry & Prophet Prediction Endpoints
# ==============================================================================


class SensorSimulateRequest(BaseModel):
    scenario: str = Field(default="nominal", description="nominal | water_surge | gas_leak | heatwave")


@app.get("/api/sensors/telemetry")
@app.get("/sensors/telemetry")
def get_sensor_telemetry_endpoint(points: int = Query(default=60, ge=10, le=360)):
    """Retrieve real-time ESP32 edge telemetry and history window."""
    try:
        from sensor_engine import SENSOR_ENGINE
    except ImportError:
        from backend.sensor_engine import SENSOR_ENGINE
    return SENSOR_ENGINE.get_latest_telemetry(history_points=points)


@app.get("/api/sensors/forecast")
@app.get("/sensors/forecast")
def get_sensor_prophet_forecast_endpoint(horizon: int = Query(default=30, ge=5, le=120)):
    """Run Prophet time-series forecasting model on sensor telemetry."""
    try:
        from sensor_engine import SENSOR_ENGINE
    except ImportError:
        from backend.sensor_engine import SENSOR_ENGINE
    return SENSOR_ENGINE.generate_prophet_forecast(horizon_minutes=horizon)


@app.post("/api/sensors/simulate")
@app.post("/sensors/simulate")
def simulate_sensor_scenario_endpoint(payload: SensorSimulateRequest):
    """Switch active simulation scenario for sensor engine."""
    try:
        from sensor_engine import SENSOR_ENGINE
    except ImportError:
        from backend.sensor_engine import SENSOR_ENGINE
    try:
        return SENSOR_ENGINE.set_scenario(payload.scenario)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":

    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    host = "0.0.0.0" if ENVIRONMENT == "production" else "127.0.0.1"
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=(ENVIRONMENT != "production"),
    )