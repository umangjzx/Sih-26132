"""Approximate coordinates for the Maharashtra APMC market towns that appear in
our price data. Used for weather lookups, road-distance ranking, and mapping.

These are town-level centroids (more precise than the district centroid in
``geo.py``). When a market is missing here, callers fall back to the district
centroid.
"""

MARKET_COORDS: dict[str, tuple[float, float]] = {
    "Pune": (18.5204, 73.8567),
    "Mumbai": (19.0760, 72.8777),
    "Nagpur": (21.1458, 79.0882),
    "Nashik": (19.9975, 73.7898),
    "Lasalgaon": (20.1427, 74.2395),
    "Pimpalgaon": (20.1739, 73.9880),
    "Ahmednagar": (19.0948, 74.7480),
    "Rahata": (19.7080, 74.4830),
    "Rahuri": (19.3900, 74.6500),
    "Solapur": (17.6599, 75.9064),
    "Sangli": (16.8524, 74.5815),
    "Kolhapur": (16.7050, 74.2433),
    "Satara": (17.6805, 74.0183),
    "Karad": (17.2850, 74.1840),
    "Jalgaon": (21.0077, 75.5626),
    "Chopda": (21.2470, 75.2970),
    "Dhule": (20.9042, 74.7749),
    "Nandurbar": (21.3667, 74.2400),
    "Chhatrapati Sambhajinagar": (19.8762, 75.3433),
    "Aurangabad": (19.8762, 75.3433),
    "Jalna": (19.8410, 75.8864),
    "Beed": (18.9891, 75.7601),
    "Latur": (18.4088, 76.5604),
    "Nanded": (19.1383, 77.3210),
    "Parbhani": (19.2704, 76.7602),
    "Hingoli": (19.7148, 77.1492),
    "Osmanabad": (18.1860, 76.0419),
    "Dharashiv": (18.1860, 76.0419),
    "Akola": (20.7002, 77.0082),
    "Amravati": (20.9374, 77.7796),
    "Achalpur": (21.2570, 77.5090),
    "Buldhana": (20.5293, 76.1802),
    "Khamgaon": (20.7070, 76.5670),
    "Washim": (20.1097, 77.1333),
    "Yavatmal": (20.3888, 78.1204),
    "Wardha": (20.7453, 78.6022),
    "Hinganghat": (20.5490, 78.8390),
    "Chandrapur": (19.9615, 79.2961),
    "Gondia": (21.4602, 80.1922),
    "Bhandara": (21.1667, 79.6500),
    "Ratnagiri": (16.9944, 73.3000),
    "Sindhudurg": (16.3667, 73.6833),
    "Sawantwadi": (15.9060, 73.8190),
    "Raigad": (18.5158, 73.1822),
    "Panvel": (18.9894, 73.1175),
    "Thane": (19.2183, 72.9781),
    "Kalyan": (19.2437, 73.1355),
    "Vashi": (19.0771, 73.0000),
    "Palghar": (19.6967, 72.7699),
    "Vasai": (19.3919, 72.8397),
    "Malegaon": (20.5537, 74.5288),
    "Yeola": (20.0420, 74.4890),
    "Sinnar": (19.8470, 74.0000),
    "Manmad": (20.2510, 74.4380),
    "Shrirampur": (19.6180, 74.6600),
    "Sangamner": (19.5760, 74.2110),
    "Baramati": (18.1514, 74.5772),
    "Indapur": (18.1180, 75.0290),
    "Junnar": (19.2080, 73.8750),
    "Newasa": (19.5470, 74.9250),
}


def market_coords(market: str) -> tuple[float, float] | None:
    return MARKET_COORDS.get(market.strip())
