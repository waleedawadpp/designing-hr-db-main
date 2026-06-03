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

    # Pagination
    default_page_size: int = 24
    max_page_size: int = 100


settings = Settings()
