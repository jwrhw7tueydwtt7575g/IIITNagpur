from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends

from auth_utils import get_current_user

router = APIRouter(
    prefix="/api/nepal",
    tags=["Nepal Flash-Flood Reference Scenario"],
)

NEPAL_DISCLAIMER = (
    "SIMULATED REFERENCE MODEL • NOT AN OFFICIAL OR LIVE MONITORING FEED"
)
NEPAL_SUB_DISCLAIMER = "Illustrative impact data • Not live"

REFERENCE_METADATA = {
    "scenario_id": "nepal_flash_flood_ref",
    "title": "Nepal Flash-Flood Reference Scenario",
    "subtitle": "Simulated Mountain Valley Inundation & Debris Flow Reference Model",
    "disclaimer": NEPAL_DISCLAIMER,
    "sub_disclaimer": NEPAL_SUB_DISCLAIMER,
    "data_provenance": "Simulated Mountain Valley Topography & Illustrative Asset Schematic",
    "geographic_context": "Representative Steep-Gradient Himalayan River Valley",
    "elevation_profile": {
        "valley_floor": "Illustrative Band (~1,300m - 1,400m)",
        "mid_slope": "Illustrative Band (~1,450m - 1,600m)",
        "high_ridge": "Illustrative Band (~1,700m - 1,900m)",
    },
    "hazard_type": "Simulated Glacial / Monsoonal Flash-Flood & Slope Debris Flow",
    "hazard_level": "Simulated High Surge Event (Illustrative Index: Severe)",
    "summary": {
        "total_reference_assets": 12,
        "critical_failures": 3,
        "secondary_threatened": 3,
        "operational_safe": 6,
        "highest_risk_asset": "Valley Hydropower Facility A (Reference)",
    },
}

REFERENCE_ASSETS: List[dict] = [
    {
        "id": "nepal_hydro_ref",
        "name": "Valley Hydropower Facility A (Reference)",
        "short_name": "Hydro Facility A",
        "type": "hydropower",
        "type_label": "Hydropower Generation Facility (Reference)",
        "category": "Reference Asset • Illustrative Data",
        "elevation_band": "Valley Floor (~1,350m illustrative band)",
        "status": "critical_failure",
        "risk_score": 0.95,
        "failure_reason": "Simulated turbine intake overwhelmed by riverbed silt and debris surge.",
        "zone": "Valley Floor Inundation Sector",
        "diagram_pos": {"x": 220, "y": 420},
        "disclaimer": NEPAL_DISCLAIMER,
    },
    {
        "id": "nepal_bridge_ref_1",
        "name": "Gorge Suspension Footbridge 1 (Reference)",
        "short_name": "Suspension Bridge 1",
        "type": "suspension_bridge",
        "type_label": "Pedestrian Suspension Bridge (Reference)",
        "category": "Reference Asset • Illustrative Data",
        "elevation_band": "Valley Floor (~1,390m illustrative band)",
        "status": "critical_failure",
        "risk_score": 0.92,
        "failure_reason": "Simulated cable anchorage failure due to debris collision; crossing impassable.",
        "zone": "Gorge River Crossing",
        "diagram_pos": {"x": 340, "y": 380},
        "disclaimer": NEPAL_DISCLAIMER,
    },
    {
        "id": "nepal_bridge_ref_2",
        "name": "High-Span Road Bridge 2 (Reference)",
        "short_name": "High-Span Bridge 2",
        "type": "suspension_bridge",
        "type_label": "Reinforced Vehicular Bridge (Reference)",
        "category": "Reference Asset • Illustrative Data",
        "elevation_band": "Mid-Slope (~1,520m illustrative band)",
        "status": "operational",
        "risk_score": 0.25,
        "failure_reason": None,
        "zone": "Mid-Valley Crossing",
        "diagram_pos": {"x": 480, "y": 300},
        "disclaimer": NEPAL_DISCLAIMER,
    },
    {
        "id": "nepal_road_ref_1",
        "name": "Mountain Road Sector A (Reference)",
        "short_name": "Road Sector A",
        "type": "blocked_mountain_road",
        "type_label": "Arterial Mountain Corridor (Reference)",
        "category": "Reference Asset • Illustrative Data",
        "elevation_band": "Valley Floor (~1,370m illustrative band)",
        "status": "critical_failure",
        "risk_score": 0.89,
        "failure_reason": "Simulated slope failure and boulder deposit blocking corridor.",
        "zone": "Riverbank Arterial Transit",
        "diagram_pos": {"x": 410, "y": 430},
        "disclaimer": NEPAL_DISCLAIMER,
    },
    {
        "id": "nepal_road_ref_2",
        "name": "Mountain Road Sector B (Reference)",
        "short_name": "Road Sector B",
        "type": "blocked_mountain_road",
        "type_label": "Mountain Access Way (Reference)",
        "category": "Reference Asset • Illustrative Data",
        "elevation_band": "Mid-Slope (~1,480m illustrative band)",
        "status": "threatened",
        "risk_score": 0.65,
        "failure_reason": "Simulated rockfall hazard; restricted single-lane passage.",
        "zone": "Mid-Valley Access Corridor",
        "diagram_pos": {"x": 560, "y": 340},
        "disclaimer": NEPAL_DISCLAIMER,
    },
    {
        "id": "nepal_settlement_ref_1",
        "name": "Riverside Settlement Cluster (Reference)",
        "short_name": "Riverside Settlement",
        "type": "settlement",
        "type_label": "Valley Inhabited Cluster (Reference)",
        "category": "Reference Asset • Illustrative Data",
        "elevation_band": "Valley Floor (~1,340m illustrative band)",
        "status": "inundated",
        "risk_score": 0.85,
        "failure_reason": "Simulated flood plain inundation; evacuation required.",
        "zone": "Lower Riverbank Flat",
        "diagram_pos": {"x": 160, "y": 470},
        "disclaimer": NEPAL_DISCLAIMER,
    },
    {
        "id": "nepal_health_ref",
        "name": "Valley Health Post (Reference)",
        "short_name": "Health Post",
        "type": "health_post",
        "type_label": "Community Medical Post (Reference)",
        "category": "Reference Asset • Illustrative Data",
        "elevation_band": "Mid-Slope (~1,460m illustrative band)",
        "status": "threatened",
        "risk_score": 0.58,
        "failure_reason": "Simulated grid outage due to upstream hydro trip; emergency batteries active.",
        "zone": "Mid-Slope Terrace",
        "diagram_pos": {"x": 300, "y": 280},
        "disclaimer": NEPAL_DISCLAIMER,
    },
    {
        "id": "nepal_rescue_ref",
        "name": "High-Ridge Rescue Command Base (Reference)",
        "short_name": "Rescue Command Base",
        "type": "elevated_rescue_base",
        "type_label": "High-Ground Operations Base (Reference)",
        "category": "Reference Asset • Illustrative Data",
        "elevation_band": "High Ridge (~1,720m illustrative band)",
        "status": "operational",
        "risk_score": 0.10,
        "failure_reason": None,
        "zone": "Upper Ridge Safe Sector",
        "diagram_pos": {"x": 660, "y": 180},
        "disclaimer": NEPAL_DISCLAIMER,
    },
    {
        "id": "nepal_helipad_ref",
        "name": "Upper Ridge Emergency Helipad (Reference)",
        "short_name": "Emergency Helipad",
        "type": "elevated_rescue_base",
        "type_label": "Aeromedical Extraction Point (Reference)",
        "category": "Reference Asset • Illustrative Data",
        "elevation_band": "High Ridge (~1,820m illustrative band)",
        "status": "operational",
        "risk_score": 0.05,
        "failure_reason": None,
        "zone": "Summit Safe Plateau",
        "diagram_pos": {"x": 800, "y": 120},
        "disclaimer": NEPAL_DISCLAIMER,
    },
    {
        "id": "nepal_trail_ref",
        "name": "High-Ridge Evacuation Path (Reference)",
        "short_name": "Ridge Evacuation Path",
        "type": "mountain_trail",
        "type_label": "High-Ground Evacuation Trail (Reference)",
        "category": "Reference Asset • Illustrative Data",
        "elevation_band": "High Ridge (~1,650m - 1,800m band)",
        "status": "operational",
        "risk_score": 0.12,
        "failure_reason": None,
        "zone": "High-Ground Ridge Path",
        "diagram_pos": {"x": 520, "y": 210},
        "disclaimer": NEPAL_DISCLAIMER,
    },
    {
        "id": "nepal_shelter_ref",
        "name": "Elevated Community Safe Shelter (Reference)",
        "short_name": "Community Safe Shelter",
        "type": "shelter",
        "type_label": "High-Ground Evacuation Shelter (Reference)",
        "category": "Reference Asset • Illustrative Data",
        "elevation_band": "Mid-to-High Ridge (~1,620m band)",
        "status": "operational",
        "risk_score": 0.15,
        "failure_reason": None,
        "zone": "Terraced Upper Safe Zone",
        "diagram_pos": {"x": 390, "y": 200},
        "disclaimer": NEPAL_DISCLAIMER,
    },
    {
        "id": "nepal_comms_ref",
        "name": "Ridge Communications Relay (Reference)",
        "short_name": "Comms Relay Tower",
        "type": "communications",
        "type_label": "Mountain Microwave Repeater (Reference)",
        "category": "Reference Asset • Illustrative Data",
        "elevation_band": "High Summit (~1,880m band)",
        "status": "operational",
        "risk_score": 0.08,
        "failure_reason": None,
        "zone": "Summit Crest",
        "diagram_pos": {"x": 750, "y": 70},
        "disclaimer": NEPAL_DISCLAIMER,
    },
]

REFERENCE_TIMELINE = [
    {
        "phase": 1,
        "phase_label": "Phase 1: Initial Surge Alert",
        "relative_time": "T-00:00",
        "status": "warning",
        "headline": "Precipitation & Glacial Outflow Surge Detected",
        "summary": "Simulated heavy precipitation triggers river level rise along narrow mountain gorge. Early high-ground alerts issued for valley floor residents.",
        "active_hazards": ["nepal_settlement_ref_1"],
    },
    {
        "phase": 2,
        "phase_label": "Phase 2: Road & Bridge Breach",
        "relative_time": "T+01:30",
        "status": "danger",
        "headline": "Debris Slide & Suspension Bridge Anchorage Failure",
        "summary": "Simulated boulder slides block Mountain Road Sector A. Gorge Suspension Footbridge 1 loses cable anchorage due to debris impacts.",
        "active_hazards": ["nepal_road_ref_1", "nepal_bridge_ref_1"],
    },
    {
        "phase": 3,
        "phase_label": "Phase 3: Hydro Siltation & Peak Lowland Flood",
        "relative_time": "T+03:00",
        "status": "critical",
        "headline": "Hydropower Turbine Inundation & Silt Overload",
        "summary": "Simulated high sediment charge trips turbines at Hydropower Facility A. Downstream power loss threatens Valley Health Post.",
        "active_hazards": [
            "nepal_road_ref_1",
            "nepal_bridge_ref_1",
            "nepal_hydro_ref",
            "nepal_settlement_ref_1",
            "nepal_health_ref",
        ],
    },
    {
        "phase": 4,
        "phase_label": "Phase 4: High-Ridge Evacuation & Aerial Rescue",
        "relative_time": "T+06:00",
        "status": "recovery",
        "headline": "Ridge Evacuation Corridor Operating to Safe Helipad",
        "summary": "Evacuation path established along high ridgeline bypass, steering evacuees away from inundated lowlands to Rescue Command Base and Helipad.",
        "active_hazards": ["nepal_road_ref_1", "nepal_bridge_ref_1", "nepal_hydro_ref"],
    },
]


@router.get("/metadata")
def get_nepal_metadata():
    """Returns overview metadata and mandatory disclaimers for the Nepal Reference Scenario."""
    return REFERENCE_METADATA


@router.get("/topology")
def get_nepal_topology():
    """Returns illustrative reference infrastructure assets and diagram topology."""
    return {
        "disclaimer": NEPAL_DISCLAIMER,
        "sub_disclaimer": NEPAL_SUB_DISCLAIMER,
        "assets": REFERENCE_ASSETS,
    }


@router.get("/evacuation-route")
def get_nepal_evacuation_route():
    """Returns simulated high-ridge evacuation corridor bypassing inundated valley floor."""
    return {
        "disclaimer": NEPAL_DISCLAIMER,
        "sub_disclaimer": NEPAL_SUB_DISCLAIMER,
        "success": True,
        "corridor_name": "Simulated High-Ridge Evacuation Bypass",
        "origin": "Riverside Settlement Cluster (Reference)",
        "destination": "Upper Ridge Emergency Helipad (Reference)",
        "elevation_gain_note": "Ascent from valley floor to high-ridge sanctuary",
        "waypoints": [
            "nepal_settlement_ref_1",
            "nepal_shelter_ref",
            "nepal_trail_ref",
            "nepal_rescue_ref",
            "nepal_helipad_ref",
        ],
        "bypassed_hazards": [
            "Mountain Road Sector A — Simulated Debris Slide",
            "Gorge Suspension Footbridge 1 — Simulated Anchorage Failure",
            "Valley Hydropower Facility A — Simulated Inundation Zone",
        ],
        "safety_narrative": (
            "The simulated evacuation corridor bypasses low-lying river roads "
            "and severed bridges by ascending to the elevated ridgeline trail "
            "leading to the emergency rescue base and helipad."
        ),
    }


@router.get("/timeline")
def get_nepal_timeline():
    """Returns simulated 4-phase flash-flood progression timeline."""
    return {
        "disclaimer": NEPAL_DISCLAIMER,
        "sub_disclaimer": NEPAL_SUB_DISCLAIMER,
        "timeline": REFERENCE_TIMELINE,
    }
