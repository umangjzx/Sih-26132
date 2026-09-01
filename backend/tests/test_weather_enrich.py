"""v1.2: the optional OpenWeatherMap enrichment on get_forecast().

Open-Meteo stays the 7-day backbone and the sell/wait bias is unchanged; when a
key is configured we additionally attach a `current` block. No key -> untouched.
"""

import httpx

from app.services import weather as wx


class _Resp:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


_METEO_DAILY = {
    "daily": {
        "time": ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04",
                 "2026-09-05", "2026-09-06", "2026-09-07"],
        "precipitation_sum": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        "temperature_2m_max": [31.0] * 7,
        "wind_speed_10m_max": [12.0] * 7,
        "precipitation_probability_max": [5] * 7,
    }
}

_OWM_CURRENT = {
    "main": {"temp": 29.4, "feels_like": 32.1, "humidity": 66},
    "wind": {"speed": 3.0},
    "weather": [{"description": "scattered clouds"}],
}


def _patch_get(monkeypatch, *, owm_ok: bool):
    def fake_get(self, url, params=None, **kw):
        if "openweathermap" in url:
            if not owm_ok:
                raise httpx.ConnectError("owm down")
            return _Resp(_OWM_CURRENT)
        return _Resp(_METEO_DAILY)

    monkeypatch.setattr(httpx.Client, "get", fake_get)


def test_forecast_without_key_is_plain(monkeypatch):
    wx._CACHE.clear()
    monkeypatch.setattr(wx.settings, "weather_api_key", "")
    _patch_get(monkeypatch, owm_ok=True)

    fc = wx.get_forecast(18.52, 73.85)
    assert fc["source"] == "open-meteo"
    assert "current" not in fc
    assert len(fc["days"]) == 7


def test_forecast_with_key_attaches_current(monkeypatch):
    wx._CACHE.clear()
    monkeypatch.setattr(wx.settings, "weather_api_key", "test-key")
    _patch_get(monkeypatch, owm_ok=True)

    fc = wx.get_forecast(18.52, 73.85)
    assert fc["source"] == "open-meteo+openweather"
    assert fc["sell_bias"] == 0  # dry week — bias unchanged by enrichment
    cur = fc["current"]
    assert cur["temp_c"] == 29.4
    assert cur["humidity_pct"] == 66
    assert cur["conditions"] == "Scattered clouds"
    assert cur["wind_kmh"] == 10.8  # 3.0 m/s -> km/h


def test_forecast_with_key_but_owm_down_degrades(monkeypatch):
    wx._CACHE.clear()
    monkeypatch.setattr(wx.settings, "weather_api_key", "test-key")
    _patch_get(monkeypatch, owm_ok=False)

    fc = wx.get_forecast(18.52, 73.85)
    assert fc["source"] == "open-meteo"
    assert "current" not in fc
    assert len(fc["days"]) == 7
