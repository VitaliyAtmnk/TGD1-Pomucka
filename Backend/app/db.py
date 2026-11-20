import logging
import time
from collections.abc import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

log = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


_settings = get_settings()
engine = create_engine(_settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(retries: int = 30, delay: float = 1.0) -> None:
    """Wait for the database and create tables (idempotent)."""
    from app import models  # noqa: F401  (register models)

    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            break
        except Exception as exc:  # pragma: no cover - depends on environment
            if attempt == retries:
                raise
            log.info("Database not ready (%s), retrying in %.1fs", exc.__class__.__name__, delay)
            time.sleep(delay)
    Base.metadata.create_all(engine)
