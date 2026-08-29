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

    RIGHT NOW this returns hardcoded-but-realistic fake data (see
    app/fake_data.py) so the frontend can build against the real shape
    immediately. On integration day, replace the body of this function
    with real model calls — the route, request format, and response
    schema all stay exactly the same.

    Every call is also persisted to Postgres as a PredictionJob row, so
    you can list/inspect past runs via GET /jobs and GET /jobs/{id}.
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
