STATUSES = ["NORMAL", "WATCH", "HIGH_RISK", "CRITICAL"]

THRESHOLDS = {
    "WATCH": 0.35,
    "HIGH_RISK": 0.60,
    "CRITICAL": 0.82,
}

def status_from_risk(risk: float) -> str:
    if risk >= THRESHOLDS["CRITICAL"]:
        return "CRITICAL"
    if risk >= THRESHOLDS["HIGH_RISK"]:
        return "HIGH_RISK"
    if risk >= THRESHOLDS["WATCH"]:
        return "WATCH"
    return "NORMAL"
