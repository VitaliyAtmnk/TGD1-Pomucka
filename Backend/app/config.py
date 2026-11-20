from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://tgd:tgd@localhost:5432/tgd"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 14
    content_dir: Path = Path(__file__).resolve().parents[2] / "content"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]
    # Fail on content reference errors (unknown ids in `related` etc.) instead of warning.
    strict_content: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
