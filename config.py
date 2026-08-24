"""
Centralized configuration via Pydantic BaseSettings.

All environment variables are read and validated here at import time.
Usage everywhere else: `from config import settings`
"""

import secrets

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str

    # Auth
    auth_username: str | None = None
    auth_password: str | None = None
    jwt_secret: str = ""

    # Server
    port: int = 8000
    reset_db: bool = False

    # Chat / Anthropic
    anthropic_api_key: str | None = None
    chat_model: str = "claude-haiku-4-5"
    chat_model_full: str = "claude-sonnet-4-6"
    chat_model_max: str = "claude-opus-4-7"
    extraction_model: str = "claude-haiku-4-5-20251001"
    chat_max_tokens: int = 16384
    chat_debug: bool = False

    # Webhooks
    webhook_secret_courtlistener: str = ""

    # MCP auth
    mcp_auth_password: str | None = None
    mcp_base_url: str | None = None

    # Media storage
    media_dir: str = "/app/media"

    # Google Sheets (intake sync)
    google_sheets_spreadsheet_id: str | None = None
    google_sheets_client_email: str | None = None
    google_sheets_private_key: str | None = None
    google_sheets_token_uri: str = "https://oauth2.googleapis.com/token"

    # Environment detection
    railway_environment: str | None = None
    env: str = ""

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        """Normalize postgres:// to postgresql:// (Heroku/Coolify use the former,
        but SQLAlchemy only accepts the latter)."""
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    @model_validator(mode="after")
    def set_jwt_secret_fallback(self) -> "Settings":
        """JWT_SECRET falls back to AUTH_PASSWORD, then a random hex string."""
        if not self.jwt_secret:
            if self.is_production:
                raise ValueError(
                    "JWT_SECRET must be set in production — sessions will break on every deploy without it"
                )
            if self.auth_password:
                self.jwt_secret = self.auth_password
            else:
                self.jwt_secret = secrets.token_hex(32)
        return self

    @property
    def is_production(self) -> bool:
        """Detect if running in a production environment."""
        if self.railway_environment:
            return True
        if self.env.lower() == "production":
            return True
        cloud_hosts = ["railway.app", "supabase.co", "neon.tech", "aws.com", "azure.com"]
        if any(host in self.database_url for host in cloud_hosts):
            return True
        return False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
