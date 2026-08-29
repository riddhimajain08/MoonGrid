"""
Pydantic models that mirror the JSON contract in MoonGrid_API_Spec.pdf
EXACTLY. The frontend team can treat this file as the single source of
truth for field names/types. When the real ML models are wired in later,
none of this should need to change — only fake_data.py changes.
"""
import uuid
from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict


class Box(BaseModel):
    x: int
    y: int
    width: int
    height: int
    confidence: float


class SlopeZone(BaseModel):
    x: int
    y: int
    width: int
    height: int
    avg_slope_deg: float


class ShadowZone(BaseModel):
    x: int
    y: int
    width: int
    height: int


class Hazards(BaseModel):
    craters: List[Box]
    boulders: List[Box]
    slope_zones: List[SlopeZone]
    shadow_zones: List[ShadowZone]


class SafeZone(BaseModel):
    id: str
    x: int
    y: int
    radius_px: int
    risk_score: float
    rank: int
    area_m2: int


class Waypoint(BaseModel):
    x: int
    y: int
    altitude_m: int


class LandingPath(BaseModel):
    waypoints: List[Waypoint]


class Summary(BaseModel):
    total_craters: int
    total_boulders: int
    percent_safe: int
    percent_moderate: int
    percent_hazardous: int


class PredictResponse(BaseModel):
    processing_time_ms: int
    original_resolution_m: int
    enhanced_resolution_m: int
    super_res_image_url: str
    original_image_url: str
    hazards: Hazards
    risk_map_url: str
    safe_zones: List[SafeZone]
    recommended_zone_id: str
    landing_path: LandingPath
    summary: Summary


class ErrorResponse(BaseModel):
    error: str


class JobListItem(BaseModel):
    """Lightweight summary row for GET /jobs — not the full prediction payload."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    original_filename: str | None
    processing_time_ms: int
    recommended_zone_id: str
    total_craters: int
    total_boulders: int
    percent_safe: float
    percent_moderate: float
    percent_hazardous: float
