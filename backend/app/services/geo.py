"""Static Maharashtra district centroid lookup, used for nearest-market
comparisons and (later) match-scoring distance — avoids a live geocoding API
so the calculation stays free and offline-safe, per the hackathon scope.
Coordinates are approximate district-headquarters centroids.
"""

import math

DISTRICT_CENTROIDS: dict[str, tuple[float, float]] = {
    "Ahmednagar": (19.0948, 74.7480),
    "Akola": (20.7002, 77.0082),
    "Amravati": (20.9374, 77.7796),
    "Beed": (18.9891, 75.7601),
    "Bhandara": (21.1667, 79.6500),
    "Buldhana": (20.5293, 76.1802),
    "Chandrapur": (19.9615, 79.2961),
    "Chhatrapati Sambhajinagar": (19.8762, 75.3433),
    "Dhule": (20.9042, 74.7749),
    "Gadchiroli": (20.1809, 80.0022),
    "Gondia": (21.4602, 80.1922),
    "Hingoli": (19.7148, 77.1492),
    "Jalgaon": (21.0077, 75.5626),
    "Jalna": (19.8410, 75.8864),
    "Kolhapur": (16.7050, 74.2433),
    "Latur": (18.4088, 76.5604),
    "Mumbai City": (18.9388, 72.8354),
    "Mumbai Suburban": (19.0760, 72.8777),
    "Nagpur": (21.1458, 79.0882),
    "Nanded": (19.1383, 77.3210),
    "Nandurbar": (21.3667, 74.2400),
    "Nashik": (19.9975, 73.7898),
    "Osmanabad": (18.1860, 76.0419),
    "Palghar": (19.6967, 72.7699),
    "Parbhani": (19.2704, 76.7602),
    "Pune": (18.5204, 73.8567),
    "Raigad": (18.5158, 73.1822),
    "Ratnagiri": (16.9944, 73.3000),
    "Sangli": (16.8524, 74.5815),
    "Satara": (17.6805, 74.0183),
    "Sindhudurg": (16.3667, 73.6833),
    "Solapur": (17.6599, 75.9064),
    "Thane": (19.2183, 72.9781),
    "Wardha": (20.7453, 78.6022),
    "Washim": (20.1097, 77.1333),
    "Yavatmal": (20.3888, 78.1204),
}


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = a
    lat2, lon2 = b
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    h = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def district_distance_km(district_a: str, district_b: str) -> float | None:
    a = DISTRICT_CENTROIDS.get(district_a)
    b = DISTRICT_CENTROIDS.get(district_b)
    if a is None or b is None:
        return None
    return round(haversine_km(a, b), 1)
