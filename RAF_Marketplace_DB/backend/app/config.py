"""Application configuration (env-driven, 12-factor friendly)."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RAF_", env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+psycopg2://postgres@localhost/raf_marketplace"

    # API
    api_title: str = "RAF Marketplace API"
    api_version: str = "0.1.0"
    default_lang: str = "ar"

    # Auth / JWT
    jwt_secret: str = "change-me-in-production"  # set RAF_JWT_SECRET in prod
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 30
    refresh_token_ttl_days: int = 14
    totp_issuer: str = "RAF Marketplace"

    # Pagination
    default_page_size: int = 24
    max_page_size: int = 100

    # CORS — comma-separated origins, or "*" for all (dev only)
    cors_origins: str = "*"

    # Production bootstrap (optional): seed roles/permissions + a first admin
    seed_admin_email: str | None = None
    seed_admin_password: str | None = None
    seed_admin_name: str = "Administrator"

    # AI layer
    ai_provider: str = "stub"            # "stub" | "anthropic"
    ai_model: str = "claude-sonnet-4-6"  # used when ai_provider="anthropic"
    anthropic_api_key: str | None = None


settings = Settings()
