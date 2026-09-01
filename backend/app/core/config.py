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
    # OTP lives for 10 minutes by default.
    otp_ttl_seconds: int = 600

    # v1.1: indicative road-freight cost, ₹ per quintal per km (shared-truck haulage).
    transport_cost_per_qtl_km: float = 0.4

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
