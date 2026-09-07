"""Optional satellite crop-health (NDVI) overlay (v1.12) — see
app/services/satellite.py. Everything is gated on real GEE credentials, which
are blank by default in every other test in this repo, so ``available()`` is
False and nothing below runs unless a test explicitly configures fake ones and
mocks the Earth Engine client itself. No real network / GEE call is ever made.
"""

from unittest.mock import MagicMock

import pytest

from app.core.config import settings
from app.services import satellite


@pytest.fixture(autouse=True)
def _clear_client_cache():
    """_client() is process-cached via lru_cache — clear it before each test
    so the previous test's fake client can't leak in. (Not cleared again on
    teardown: a test that monkeypatches _client has it restored to the real,
    cache-bearing function by monkeypatch's own teardown, in either order.)"""
    satellite._client.cache_clear()
    yield


def _configure_fake_credentials(monkeypatch, tmp_path):
    key_file = tmp_path / "fake_gee_key.json"
    key_file.write_text("{}")
    monkeypatch.setattr(settings, "gee_project_id", "test-project")
    monkeypatch.setattr(settings, "gee_service_account", "test@test-project.iam.gserviceaccount.com")
    monkeypatch.setattr(settings, "gee_credentials_path", str(key_file))


def _fake_ee(ndvi_value: float, as_of: str, image_count: int = 1) -> MagicMock:
    """A MagicMock standing in for the ``ee`` module's fluent chain, exactly
    as far as satellite.get_ndvi() calls it."""
    ee = MagicMock()
    col = ee.ImageCollection.return_value.filterBounds.return_value.filterDate.return_value.sort.return_value
    col.size.return_value.getInfo.return_value = image_count
    image = col.first.return_value
    image.select.return_value.multiply.return_value.reduceRegion.return_value.getInfo.return_value = {
        "NDVI": ndvi_value
    }
    ee.Date.return_value.format.return_value.getInfo.return_value = as_of
    return ee


def test_unavailable_without_credentials(monkeypatch):
    monkeypatch.setattr(settings, "gee_project_id", "")
    monkeypatch.setattr(settings, "gee_service_account", "")
    monkeypatch.setattr(settings, "gee_credentials_path", "")
    assert satellite.available() is False
    assert satellite.get_ndvi(18.52, 73.86) is None


def test_unavailable_when_credentials_file_missing(monkeypatch):
    monkeypatch.setattr(settings, "gee_project_id", "test-project")
    monkeypatch.setattr(settings, "gee_service_account", "test@test-project.iam.gserviceaccount.com")
    monkeypatch.setattr(settings, "gee_credentials_path", "no/such/file.json")
    assert satellite.available() is False


def test_available_with_real_looking_credentials(monkeypatch, tmp_path):
    _configure_fake_credentials(monkeypatch, tmp_path)
    assert satellite.available() is True


def test_get_ndvi_parses_a_successful_response(monkeypatch, tmp_path):
    _configure_fake_credentials(monkeypatch, tmp_path)
    fake_ee = _fake_ee(ndvi_value=0.55, as_of="2026-08-13")
    monkeypatch.setattr(satellite, "_client", lambda: fake_ee)

    reading = satellite.get_ndvi(18.52, 73.86)
    assert reading == {
        "ndvi": 0.55, "as_of": "2026-08-13", "health": "good", "source": "MODIS/061/MOD13Q1",
    }


@pytest.mark.parametrize(
    "ndvi_value, expected_health",
    [(0.05, "poor"), (0.3, "fair"), (0.5, "good"), (0.8, "excellent")],
)
def test_health_bands(monkeypatch, tmp_path, ndvi_value, expected_health):
    _configure_fake_credentials(monkeypatch, tmp_path)
    monkeypatch.setattr(satellite, "_client", lambda: _fake_ee(ndvi_value, "2026-08-13"))
    assert satellite.get_ndvi(18.52, 73.86)["health"] == expected_health


def test_get_ndvi_none_when_no_imagery_in_window(monkeypatch, tmp_path):
    _configure_fake_credentials(monkeypatch, tmp_path)
    monkeypatch.setattr(satellite, "_client", lambda: _fake_ee(0.5, "2026-08-13", image_count=0))
    assert satellite.get_ndvi(18.52, 73.86) is None


def test_get_ndvi_none_when_earth_engine_raises(monkeypatch, tmp_path):
    _configure_fake_credentials(monkeypatch, tmp_path)

    def _boom():
        raise RuntimeError("quota exceeded")

    monkeypatch.setattr(satellite, "_client", _boom)
    assert satellite.get_ndvi(18.52, 73.86) is None
