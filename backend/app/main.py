import shutil
import uuid
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.db import Base, engine, get_db
from app.fake_data import build_fake_predict_response
from app.models import PredictionJob
from app.schemas import JobListItem, PredictResponse

# Real ML pipeline — imported lazily; falls back to fake_data if unavailable
try:
    from app.ml_pipeline import run_full_pipeline as _run_ml_pipeline
    _ML_AVAILABLE = True
except Exception as _ml_import_err:
    import logging as _logging
    _logging.getLogger(__name__).warning(
        f"ML pipeline import failed ({_ml_import_err}). Using fake_data fallback."
    )
    _ML_AVAILABLE = False


app = FastAPI(
    title="MoonGrid API",
    description="Backend for MoonGrid — lunar hazard mapping & safe landing zone detection.",
    version="0.1.0",
)

# Allow the Next.js dev server (and any origin, for hackathon speed) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Serves everything under app/static/ at http://localhost:8000/static/...
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

ALLOWED_EXTENSIONS = {".tif", ".tiff", ".png", ".jpg", ".jpeg"}


@app.on_event("startup")
def on_startup():
    # Creates the prediction_jobs table if it doesn't exist yet.
    # Fine for a hackathon/demo; use Alembic migrations for anything longer-lived.
    Base.metadata.create_all(bind=engine)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "MoonGrid API"}


@app.post("/predict", response_model=PredictResponse, responses={400: {"description": "Invalid image format"}})
async def predict(image: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Accepts a TMC image (.tif/.png/.jpg) and returns hazard/risk analysis.

    Processing order:
      1. Try real ML pipeline (RRDB super-res + Faster R-CNN crater detector
         + CV hazard masks + risk-map fusion + safe-zone ranking).
      2. If ML inference fails for any reason, fall back to fake_data.py so
         the demo never hard-errors. A `ml_mode` field in the response log
         tells you which path ran.

    Every call is persisted to the DB as a PredictionJob row.
    """
    ext = Path(image.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid image format"},
        )

    # Save the upload to disk
    save_name = f"{uuid.uuid4().hex[:8]}{ext}"
    save_path = UPLOAD_DIR / save_name
    with save_path.open("wb") as f:
        shutil.copyfileobj(image.file, f)

    result = None

    # ── Try real ML pipeline ──────────────────────────────────────────────────
    if _ML_AVAILABLE:
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            # Run blocking ML inference in a thread pool so we don't block the event loop
            result = await loop.run_in_executor(None, _run_ml_pipeline, save_path)
        except Exception as ml_err:
            import logging
            logging.getLogger(__name__).warning(
                f"ML pipeline inference failed ({ml_err}). Falling back to fake_data."
            )
            result = None

    # ── Fallback to fake_data ─────────────────────────────────────────────────
    if result is None:
        try:
            result = build_fake_predict_response(save_path)
        except Exception:
            return JSONResponse(
                status_code=500,
                content={"error": "Failed to process image"},
            )

    job = PredictionJob(
        original_filename=image.filename,
        original_image_url=result["original_image_url"],
        super_res_image_url=result["super_res_image_url"],
        risk_map_url=result["risk_map_url"],
        processing_time_ms=result["processing_time_ms"],
        recommended_zone_id=result["recommended_zone_id"],
        total_craters=result["summary"]["total_craters"],
        total_boulders=result["summary"]["total_boulders"],
        percent_safe=result["summary"]["percent_safe"],
        percent_moderate=result["summary"]["percent_moderate"],
        percent_hazardous=result["summary"]["percent_hazardous"],
        full_result=result,
        # location left NULL until pixel->lunar-lat/lon georeferencing exists
    )
    db.add(job)
    db.commit()

    return result


@app.get("/jobs", response_model=List[JobListItem])
def list_jobs(db: Session = Depends(get_db)):
    """Lists past predictions, most recent first. Handy for a 'history' screen."""
    jobs = db.query(PredictionJob).order_by(PredictionJob.created_at.desc()).all()
    return jobs


@app.get("/jobs/{job_id}", response_model=PredictResponse)
def get_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """Returns the full original /predict response for a past job, by id."""
    job = db.query(PredictionJob).filter(PredictionJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.full_result


@app.get("/lunar-sites")
def get_lunar_sites():
    """
    Returns candidate lunar landing sites with coordinates and hazard metadata.
    Used by the Cesium 3D viewer to plot site markers and hazard overlays.
    """
    return [
        {
            "id": "shackleton",
            "name": "Shackleton Crater Rim",
            "region": "South Pole",
            "lat": -89.54,
            "lon": 0.0,
            "risk_score": 0.12,
            "risk_label": "Low",
            "slope_deg": 2.4,
            "description": "Prime candidate site near permanently shadowed regions with high water ice potential.",
            "hazards": {
                "craters": [
                    {"lat": -89.60, "lon": 5.0, "radius_km": 0.8, "depth_m": 120},
                    {"lat": -89.45, "lon": -10.0, "radius_km": 0.5, "depth_m": 80},
                    {"lat": -89.70, "lon": 15.0, "radius_km": 1.2, "depth_m": 200},
                ],
                "slope_zones": [
                    {"lat": -89.55, "lon": -5.0, "radius_km": 1.5, "avg_slope_deg": 12.4},
                ],
                "shadow_zones": [
                    {"lat": -89.80, "lon": 0.0, "radius_km": 4.0},
                ],
                "safe_zones": [
                    {"lat": -89.50, "lon": 2.0, "radius_km": 0.6, "area_km2": 1.13},
                ],
            },
            "descent_waypoints": [
                {"lat": -89.0, "lon": 0.0, "alt_km": 150},
                {"lat": -89.25, "lon": 0.5, "alt_km": 60},
                {"lat": -89.40, "lon": 1.0, "alt_km": 20},
                {"lat": -89.50, "lon": 2.0, "alt_km": 2},
                {"lat": -89.50, "lon": 2.0, "alt_km": 0},
            ],
        },
        {
            "id": "malapert",
            "name": "Malapert Mountain",
            "region": "South Pole",
            "lat": -84.9,
            "lon": 12.9,
            "risk_score": 0.18,
            "risk_label": "Low",
            "slope_deg": 3.1,
            "description": "Elevated plateau providing continuous Earth line-of-sight communication.",
            "hazards": {
                "craters": [
                    {"lat": -85.1, "lon": 13.5, "radius_km": 0.6, "depth_m": 90},
                    {"lat": -84.7, "lon": 12.0, "radius_km": 0.4, "depth_m": 60},
                ],
                "slope_zones": [
                    {"lat": -84.85, "lon": 12.8, "radius_km": 2.0, "avg_slope_deg": 15.2},
                ],
                "shadow_zones": [],
                "safe_zones": [
                    {"lat": -84.9, "lon": 12.9, "radius_km": 0.5, "area_km2": 0.78},
                ],
            },
            "descent_waypoints": [
                {"lat": -83.5, "lon": 12.9, "alt_km": 150},
                {"lat": -84.0, "lon": 12.9, "alt_km": 60},
                {"lat": -84.5, "lon": 12.9, "alt_km": 15},
                {"lat": -84.9, "lon": 12.9, "alt_km": 2},
                {"lat": -84.9, "lon": 12.9, "alt_km": 0},
            ],
        },
        {
            "id": "procellarum",
            "name": "Oceanus Procellarum",
            "region": "Near Side — Western Mare",
            "lat": 18.4,
            "lon": -57.4,
            "risk_score": 0.08,
            "risk_label": "Very Low",
            "slope_deg": 1.1,
            "description": "Vast, flat basaltic lunar mare with minimal crater obstruction.",
            "hazards": {
                "craters": [
                    {"lat": 18.8, "lon": -56.8, "radius_km": 1.4, "depth_m": 180},
                    {"lat": 17.9, "lon": -58.2, "radius_km": 0.9, "depth_m": 130},
                ],
                "slope_zones": [],
                "shadow_zones": [],
                "safe_zones": [
                    {"lat": 18.4, "lon": -57.4, "radius_km": 2.0, "area_km2": 12.6},
                ],
            },
            "descent_waypoints": [
                {"lat": 20.0, "lon": -57.4, "alt_km": 150},
                {"lat": 19.5, "lon": -57.4, "alt_km": 60},
                {"lat": 19.0, "lon": -57.4, "alt_km": 15},
                {"lat": 18.4, "lon": -57.4, "alt_km": 2},
                {"lat": 18.4, "lon": -57.4, "alt_km": 0},
            ],
        },
        {
            "id": "tranquillitatis",
            "name": "Mare Tranquillitatis",
            "region": "Near Side — Equatorial",
            "lat": 0.67,
            "lon": 23.47,
            "risk_score": 0.15,
            "risk_label": "Low",
            "slope_deg": 1.8,
            "description": "Apollo 11 heritage site — equatorial mare with titanium-rich basalts.",
            "hazards": {
                "craters": [
                    {"lat": 1.2, "lon": 24.0, "radius_km": 1.0, "depth_m": 150},
                    {"lat": 0.3, "lon": 22.8, "radius_km": 0.7, "depth_m": 100},
                    {"lat": 1.0, "lon": 23.0, "radius_km": 0.4, "depth_m": 50},
                ],
                "slope_zones": [
                    {"lat": 0.8, "lon": 23.5, "radius_km": 1.2, "avg_slope_deg": 8.5},
                ],
                "shadow_zones": [],
                "safe_zones": [
                    {"lat": 0.67, "lon": 23.47, "radius_km": 0.8, "area_km2": 2.0},
                ],
            },
            "descent_waypoints": [
                {"lat": 2.0, "lon": 23.47, "alt_km": 150},
                {"lat": 1.5, "lon": 23.47, "alt_km": 60},
                {"lat": 1.0, "lon": 23.47, "alt_km": 15},
                {"lat": 0.67, "lon": 23.47, "alt_km": 2},
                {"lat": 0.67, "lon": 23.47, "alt_km": 0},
            ],
        },
    ]
