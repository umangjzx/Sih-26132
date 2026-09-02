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


# --------------------------------------------------------------------------- #
# All-India state centroids (v1.2) — used to snap a lat/lon or a place to a
# state when reverse geocoding is unavailable, and as a coarse fallback for
# districts outside the detailed Maharashtra table.
# --------------------------------------------------------------------------- #

STATE_CENTROIDS: dict[str, tuple[float, float]] = {
    "Andhra Pradesh": (15.9129, 79.7400),
    "Arunachal Pradesh": (28.2180, 94.7278),
    "Assam": (26.2006, 92.9376),
    "Bihar": (25.0961, 85.3131),
    "Chhattisgarh": (21.2787, 81.8661),
    "Goa": (15.2993, 74.1240),
    "Gujarat": (22.2587, 71.1924),
    "Haryana": (29.0588, 76.0856),
    "Himachal Pradesh": (31.1048, 77.1734),
    "Jharkhand": (23.6102, 85.2799),
    "Karnataka": (15.3173, 75.7139),
    "Kerala": (10.8505, 76.2711),
    "Madhya Pradesh": (22.9734, 78.6569),
    "Maharashtra": (19.7515, 75.7139),
    "Manipur": (24.6637, 93.9063),
    "Meghalaya": (25.4670, 91.3662),
    "Mizoram": (23.1645, 92.9376),
    "Nagaland": (26.1584, 94.5624),
    "Odisha": (20.9517, 85.0985),
    "Punjab": (31.1471, 75.3412),
    "Rajasthan": (27.0238, 74.2179),
    "Sikkim": (27.5330, 88.5122),
    "Tamil Nadu": (11.1271, 78.6569),
    "Telangana": (18.1124, 79.0193),
    "Tripura": (23.9408, 91.9882),
    "Uttar Pradesh": (26.8467, 80.9462),
    "Uttarakhand": (30.0668, 79.0193),
    "West Bengal": (22.9868, 87.8550),
    "Delhi": (28.7041, 77.1025),
    "Jammu and Kashmir": (33.7782, 76.5762),
    "Ladakh": (34.2996, 78.2932),
    "Puducherry": (11.9416, 79.8083),
    "Chandigarh": (30.7333, 76.7794),
    "Andaman and Nicobar Islands": (11.7401, 92.6586),
    "Dadra and Nagar Haveli and Daman and Diu": (20.1809, 73.0169),
    "Lakshadweep": (10.5667, 72.6417),
}


# Micro-UTs are geographically embedded inside larger states, so a nearest-
# centroid snap wrongly claims points that really belong to the enclosing state.
# Keep them resolvable (they're in STATE_CENTROIDS + the /states list) but don't
# use them as fallback snap targets.
_SNAP_EXCLUDE = {
    "Dadra and Nagar Haveli and Daman and Diu",
    "Chandigarh",
    "Puducherry",
    "Lakshadweep",
    "Andaman and Nicobar Islands",
}


# Major cities across every state — used as a finer fallback than state centroids
# when reverse geocoding is unavailable (a state centroid can be 150+ km from a
# border city, e.g. the Tamil Nadu centroid is far east of Coimbatore).
# (lat, lon) -> (state, district).
CITY_COORDS: dict[tuple[float, float], tuple[str, str]] = {
    (28.6139, 77.2090): ("Delhi", "New Delhi"),
    (19.0760, 72.8777): ("Maharashtra", "Mumbai"),
    (18.5204, 73.8567): ("Maharashtra", "Pune"),
    (21.1458, 79.0882): ("Maharashtra", "Nagpur"),
    (19.9975, 73.7898): ("Maharashtra", "Nashik"),
    (12.9716, 77.5946): ("Karnataka", "Bengaluru"),
    (15.3647, 75.1240): ("Karnataka", "Dharwad"),
    (12.2958, 76.6394): ("Karnataka", "Mysuru"),
    (17.3850, 78.4867): ("Telangana", "Hyderabad"),
    (17.9689, 79.5941): ("Telangana", "Warangal"),
    (13.0827, 80.2707): ("Tamil Nadu", "Chennai"),
    (11.0168, 76.9558): ("Tamil Nadu", "Coimbatore"),
    (9.9252, 78.1198): ("Tamil Nadu", "Madurai"),
    (11.6643, 78.1460): ("Tamil Nadu", "Salem"),
    (10.7905, 78.7047): ("Tamil Nadu", "Tiruchirappalli"),
    (8.5241, 76.9366): ("Kerala", "Thiruvananthapuram"),
    (9.9312, 76.2673): ("Kerala", "Ernakulam"),
    (11.2588, 75.7804): ("Kerala", "Kozhikode"),
    (17.6868, 83.2185): ("Andhra Pradesh", "Visakhapatnam"),
    (16.5062, 80.6480): ("Andhra Pradesh", "Vijayawada"),
    (16.3067, 80.4365): ("Andhra Pradesh", "Guntur"),
    (22.5726, 88.3639): ("West Bengal", "Kolkata"),
    (22.9089, 88.3960): ("West Bengal", "Hooghly"),
    (26.8467, 80.9462): ("Uttar Pradesh", "Lucknow"),
    (26.4499, 80.3319): ("Uttar Pradesh", "Kanpur"),
    (27.1767, 78.0081): ("Uttar Pradesh", "Agra"),
    (25.3176, 82.9739): ("Uttar Pradesh", "Varanasi"),
    (28.5355, 77.3910): ("Uttar Pradesh", "Noida"),
    (30.9010, 75.8573): ("Punjab", "Ludhiana"),
    (31.3260, 75.5762): ("Punjab", "Jalandhar"),
    (31.6340, 74.8723): ("Punjab", "Amritsar"),
    (29.6857, 76.9905): ("Haryana", "Karnal"),
    (28.4595, 77.0266): ("Haryana", "Gurugram"),
    (29.3909, 76.9635): ("Haryana", "Panipat"),
    (26.9124, 75.7873): ("Rajasthan", "Jaipur"),
    (26.2389, 73.0243): ("Rajasthan", "Jodhpur"),
    (25.2138, 75.8648): ("Rajasthan", "Kota"),
    (22.7196, 75.8577): ("Madhya Pradesh", "Indore"),
    (23.2599, 77.4126): ("Madhya Pradesh", "Bhopal"),
    (23.1815, 79.9864): ("Madhya Pradesh", "Jabalpur"),
    (26.4691, 74.6399): ("Rajasthan", "Ajmer"),
    (23.0225, 72.5714): ("Gujarat", "Ahmedabad"),
    (22.3072, 73.1812): ("Gujarat", "Vadodara"),
    (21.1702, 72.8311): ("Gujarat", "Surat"),
    (22.3039, 70.8022): ("Gujarat", "Rajkot"),
    (21.2514, 81.6296): ("Chhattisgarh", "Raipur"),
    (20.2961, 85.8245): ("Odisha", "Bhubaneswar"),
    (20.4625, 85.8828): ("Odisha", "Cuttack"),
    (25.5941, 85.1376): ("Bihar", "Patna"),
    (25.8560, 85.7799): ("Bihar", "Samastipur"),
    (23.3441, 85.3096): ("Jharkhand", "Ranchi"),
    (22.8046, 86.2029): ("Jharkhand", "Jamshedpur"),
    (26.1445, 91.7362): ("Assam", "Guwahati"),
    (30.3165, 78.0322): ("Uttarakhand", "Dehradun"),
    (31.1048, 77.1734): ("Himachal Pradesh", "Shimla"),
    (32.7266, 74.8570): ("Jammu and Kashmir", "Jammu"),
    (34.0837, 74.7973): ("Jammu and Kashmir", "Srinagar"),
    (15.4909, 73.8278): ("Goa", "North Goa"),
    (11.9416, 79.8083): ("Puducherry", "Puducherry"),
}


def nearest_place(lat: float, lon: float) -> tuple[str, str]:
    """(state, district) of the nearest major city, else (nearest_state, "")."""
    best = min(
        CITY_COORDS.items(),
        key=lambda kv: haversine_km((lat, lon), kv[0]),
    )
    (clat, clon), (state, district) = best
    if haversine_km((lat, lon), (clat, clon)) <= 200:
        return state, district
    return nearest_state(lat, lon), ""


def nearest_state(lat: float, lon: float) -> str:
    """Coarse point -> state via nearest state centroid (micro-UTs excluded)."""
    candidates = [s for s in STATE_CENTROIDS if s not in _SNAP_EXCLUDE]
    return min(
        candidates,
        key=lambda s: haversine_km((lat, lon), STATE_CENTROIDS[s]),
    )


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
