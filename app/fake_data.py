"""
FAKE / HARDCODED response generator for the /predict endpoint.

This is the piece that gets replaced on "Integration Day" once the real
models exist (see section 7 of the spec). Everything else — routes,
schemas, static file serving — stays untouched.

To make the demo look convincing right now (instead of returning the
uploaded image unchanged), this module also renders:
  - a fake "super-resolution" image (upscaled + sharpened version of the
    uploaded image)
  - a fake risk-map image (green/yellow/red overlay)
so the frontend's before/after slider and risk-map view have something
real to show, even before any ML is trained.
"""
import random
import time
import uuid
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

STATIC_RESULTS_DIR = Path(__file__).parent / "static" / "results"
STATIC_RESULTS_DIR.mkdir(parents=True, exist_ok=True)

DEMO_CANVAS_SIZE = (640, 640)  # fallback size if we can't read the upload


def _make_super_res_image(src_path: Path, dst_path: Path) -> tuple[int, int]:
    """Fake 'super-resolution': upscale 2x + sharpen. Returns (w, h)."""
    img = Image.open(src_path).convert("RGB")
    upscaled = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
    sharpened = upscaled.filter(ImageFilter.SHARPEN)
    sharpened.save(dst_path)
    return sharpened.size


def _make_original_copy(src_path: Path, dst_path: Path) -> None:
    Image.open(src_path).convert("RGB").save(dst_path)


def _make_risk_map(size: tuple[int, int], dst_path: Path) -> None:
    """Fake risk map: green/yellow/red blotches, just for visual demo."""
    w, h = size
    img = Image.new("RGB", (w, h), (20, 20, 30))
    draw = ImageDraw.Draw(img)
    colors = [(60, 200, 90), (230, 200, 40), (220, 60, 60)]  # green/yellow/red
    random.seed(42)
    for _ in range(35):
        cx, cy = random.randint(0, w), random.randint(0, h)
        r = random.randint(20, 70)
        color = random.choices(colors, weights=[0.55, 0.28, 0.17])[0]
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    img = img.filter(ImageFilter.GaussianBlur(8))
    img.save(dst_path)


def build_fake_predict_response(upload_path: Path) -> dict:
    """
    Given a path to the uploaded image, generate demo SR/risk-map images
    and return a dict matching the EXACT shape in schemas.PredictResponse.
    """
    start = time.time()
    job_id = uuid.uuid4().hex[:8]

    sr_name = f"{job_id}_sr.png"
    orig_name = f"{job_id}_original.png"
    risk_name = f"{job_id}_riskmap.png"

    sr_path = STATIC_RESULTS_DIR / sr_name
    orig_path = STATIC_RESULTS_DIR / orig_name
    risk_path = STATIC_RESULTS_DIR / risk_name

    try:
        sr_size = _make_super_res_image(upload_path, sr_path)
        _make_original_copy(upload_path, orig_path)
    except Exception:
        # If the upload isn't a real image PIL can decode, fall back to
        # a plain placeholder canvas so the demo never hard-fails.
        placeholder = Image.new("RGB", DEMO_CANVAS_SIZE, (50, 50, 60))
        placeholder.save(sr_path)
        placeholder.save(orig_path)
        sr_size = DEMO_CANVAS_SIZE

    _make_risk_map(sr_size, risk_path)

    w, h = sr_size
    processing_time_ms = int((time.time() - start) * 1000) + random.randint(2500, 4200)

    return {
        "processing_time_ms": processing_time_ms,
        "original_resolution_m": 5,
        "enhanced_resolution_m": 1,
        "super_res_image_url": f"/static/results/{sr_name}",
        "original_image_url": f"/static/results/{orig_name}",
        "hazards": {
            "craters": [
                {"x": int(w * 0.19), "y": int(h * 0.53), "width": 40, "height": 40, "confidence": 0.87},
                {"x": int(w * 0.62), "y": int(h * 0.22), "width": 30, "height": 30, "confidence": 0.71},
            ],
            "boulders": [
                {"x": int(w * 0.31), "y": int(h * 0.23), "width": 25, "height": 25, "confidence": 0.79},
                {"x": int(w * 0.45), "y": int(h * 0.68), "width": 18, "height": 18, "confidence": 0.65},
            ],
            "slope_zones": [
                {"x": int(w * 0.08), "y": int(h * 0.09), "width": 100, "height": 80, "avg_slope_deg": 14.2},
            ],
            "shadow_zones": [
                {"x": int(w * 0.47), "y": int(h * 0.47), "width": 60, "height": 60},
            ],
        },
        "risk_map_url": f"/static/results/{risk_name}",
        "safe_zones": [
            {"id": "zone_1", "x": int(w * 0.62), "y": int(h * 0.62), "radius_px": 50,
             "risk_score": 0.08, "rank": 1, "area_m2": 1200},
            {"id": "zone_2", "x": int(w * 0.23), "y": int(h * 0.78), "radius_px": 35,
             "risk_score": 0.15, "rank": 2, "area_m2": 850},
        ],
        "recommended_zone_id": "zone_1",
        "landing_path": {
            "waypoints": [
                {"x": 0, "y": 0, "altitude_m": 5000},
                {"x": int(w * 0.31), "y": int(h * 0.31), "altitude_m": 2000},
                {"x": int(w * 0.62), "y": int(h * 0.62), "altitude_m": 0},
            ]
        },
        "summary": {
            "total_craters": 12,
            "total_boulders": 7,
            "percent_safe": 62,
            "percent_moderate": 25,
            "percent_hazardous": 13,
        },
    }
