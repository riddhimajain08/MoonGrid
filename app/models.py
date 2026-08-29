"""
ORM models.

PredictionJob stores one row per /predict call: the uploaded filename,
the full JSON result (so nothing is lost even before you build dedicated
columns for every field), quick-access summary stats for listing/filtering,
and a PostGIS `location` point column.

`location` is nullable for now because pixel coordinates from TMC images
aren't real lunar lat/lon until someone does the georeferencing step
(mapping pixel space -> selenographic coordinates using the image's
metadata/footprint). Once that exists, populate `location` with the
recommended safe zone's real coordinates and you get PostGIS's spatial
queries (nearest zone, zones within a region, etc.) for free.
"""
import uuid
from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import JSON, Column, DateTime, Float, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.db import Base


class PredictionJob(Base):
    __tablename__ = "prediction_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    original_filename = Column(String, nullable=True)
    original_image_url = Column(String, nullable=False)
    super_res_image_url = Column(String, nullable=False)
    risk_map_url = Column(String, nullable=False)

    processing_time_ms = Column(Integer, nullable=False)
    recommended_zone_id = Column(String, nullable=False)

    # Quick-access summary fields (mirrors `summary` in the JSON response)
    total_craters = Column(Integer, nullable=False)
    total_boulders = Column(Integer, nullable=False)
    percent_safe = Column(Float, nullable=False)
    percent_moderate = Column(Float, nullable=False)
    percent_hazardous = Column(Float, nullable=False)

    # Full response payload, kept as-is so no data is ever lost even for
    # fields that don't have a dedicated column.
    full_result = Column(JSON, nullable=False)

    # Real-world lunar coordinates of the recommended landing zone.
    # NULL until georeferencing is implemented.
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=True)

    def __repr__(self):
        return f"<PredictionJob {self.id} recommended={self.recommended_zone_id}>"
