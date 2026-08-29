"""
Database connection setup.

Reads DATABASE_URL from environment (falls back to PostgreSQL default,
or SQLite if PostgreSQL is unreachable, ensuring out-of-the-box dev execution).
"""
import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:moongrid_dev@localhost:5433/moongrid",
)

def create_db_engine():
    try:
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        # Attempt a test connection
        with engine.connect() as conn:
            pass
        logger.info(f"Connected to primary database: {DATABASE_URL}")
        return engine
    except Exception as e:
        logger.warning(f"Could not connect to {DATABASE_URL} ({e}). Falling back to local SQLite database.")
        sqlite_url = "sqlite:///./moongrid.db"
        return create_engine(sqlite_url, connect_args={"check_same_thread": False})

engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session, closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

