"""district_distance_km() — static district-centroid haversine (D-10, no PostGIS
this phase). The Pune<->Nagpur distance is pinned to the value produced at
implementation time with a +/-5 km tolerance so a centroid tweak is caught but
float noise is not.
"""

import pytest

from app.services.geo import district_distance_km

EXPECTED_PUNE_NAGPUR_KM = 620.1


def test_known_pair_matches_pinned_distance():
    assert district_distance_km("Pune", "Nagpur") == pytest.approx(
        EXPECTED_PUNE_NAGPUR_KM, abs=5.0
    )
    assert district_distance_km("Pune", "Nagpur") > 0


def test_same_district_is_zero():
    assert district_distance_km("Pune", "Pune") == 0.0


def test_unknown_district_is_none():
    assert district_distance_km("Pune", "Atlantis") is None
    assert district_distance_km("Atlantis", "Pune") is None


def test_symmetric():
    assert district_distance_km("Pune", "Nagpur") == district_distance_km("Nagpur", "Pune")
    assert district_distance_km("Solapur", "Nashik") == district_distance_km("Nashik", "Solapur")
