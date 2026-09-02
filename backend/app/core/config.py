from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://agrilink:agrilink@localhost:5432/agrilink"
    data_gov_in_api_key: str = ""
    # Off by default in Phase 1 — no live arrivals source is wired yet (PRICE-07).
    arrivals_source_url: str = ""
    # Shared secret for POST /api/ingest/run; blank keeps the endpoint disabled (D-05).
    ingest_trigger_secret: str = ""
    cors_origins: str = "http://localhost:3000"

    # Phase 2: JWT auth settings.
    # jwt_secret_key must be set to a long random string in production.
    # Blank → tokens will fail to verify; acceptable for local demo only.
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    # Login is passwordless / OTP-less in this build: /auth/login identifies by
    # phone and issues tokens directly (see git history to restore the OTP flow).

    # v1.1: indicative road-freight cost, ₹ per quintal per km (shared-truck haulage).
    transport_cost_per_qtl_km: float = 0.4

    # v1.3: optional LLM (OpenRouter) — a *readability layer* only. Plain-language
    # advisor summary, the "Ask AgriLink" assistant, and live-string translation.
    # Blank -> those features degrade to the rule-based output / English.
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o-mini"
    openrouter_url: str = "https://openrouter.ai/api/v1/chat/completions"

    # v1.2: optional OpenWeatherMap key. When set, the 7-day forecast is enriched
    # with current conditions (humidity, feels-like, description). Blank -> the
    # keyless Open-Meteo forecast is used on its own, unchanged.
    weather_api_key: str = ""
    openweather_url: str = "https://api.openweathermap.org/data/2.5/weather"

    # v1.2: which AGMARKNET states the scheduled ingestion pulls. "ALL" pulls the
    # whole national feed in one shot (~10 pages, real prices for every state);
    # or comma-separate specific states (e.g. "Maharashtra,Karnataka").
    ingest_states: str = "ALL"
    # Free, keyless reverse-geocoder (lat/lon -> state + district).
    # Primary reverse-geocoder: OSM Nominatim (accurate, keyless; needs a UA and
    # is rate-limited to ~1 req/s — fine here, results are cached in geo_cache).
    nominatim_url: str = "https://nominatim.openstreetmap.org/reverse"
    # Secondary: BigDataCloud's client endpoint (often empty for server-side calls).
    reverse_geocode_url: str = "https://api.bigdatacloud.net/data/reverse-geocode-client"

    @property
    def ingest_state_list(self) -> list[str] | None:
        raw = self.ingest_states.strip()
        if not raw or raw.upper() == "ALL":
            return None  # no state filter -> whole India
        return [s.strip() for s in raw.split(",") if s.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
