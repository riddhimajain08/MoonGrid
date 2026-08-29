# MoonGrid Backend (Fake-Data Stage)

This is a **real, running FastAPI server** that implements the `/predict`
contract from `MoonGrid_API_Spec.pdf` exactly — but with hardcoded/generated
fake data instead of real ML models, so your frontend teammates can build
against it *today*.

## What's actually implemented right now

- Real FastAPI app with CORS enabled (so Next.js on `localhost:3000` can call it)
- `POST /predict` — accepts an uploaded image, returns JSON matching the
  spec 100% (same field names, types, and nesting)
- It doesn't just echo static JSON — it actually generates a fake
  "super-resolution" image (2x upscale + sharpen) and a fake risk-map image
  (green/yellow/red blotches) from whatever you upload, so the frontend's
  before/after slider and risk overlay have something real to render
- Proper error handling: uploading a non-image file returns
  `400 {"error": "Invalid image format"}` like the spec says
- Static file serving at `/static/results/...` for the generated images

- **Real PostgreSQL + PostGIS persistence**, tested end-to-end: every
  `/predict` call is saved as a row (filename, summary stats, full JSON
  result, timestamp), plus `GET /jobs` (list history) and `GET /jobs/{id}`
  (fetch one past result) endpoints
- A `location` PostGIS geometry column exists on each job row but is left
  `NULL` for now — see "Next steps" for why

## What's NOT implemented yet (on purpose)

- Pixel-to-real-lunar-coordinate georeferencing (needed before `location`
  can be populated with anything meaningful)
- No real ML models — obviously, that's phase 2.

## 1. Setup (one-time)

**Start the database** (needs Docker):
```bash
cd moongrid-backend
docker compose up -d
```
This starts Postgres 16 + PostGIS on `localhost:5432` with the database
`moongrid` already created. No `.env` needed — the app's defaults already
match this. (If you don't have Docker, install PostgreSQL 16 + the
`postgis` extension natively and create a database/user matching
`.env.example`.)

**Install Python deps:**
```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Run the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
On first run it automatically creates the `prediction_jobs` table — no
manual migration step needed for this stage of the project.

Server will be live at `http://localhost:8000`.
Interactive docs (auto-generated, great for testing without Postman):
`http://localhost:8000/docs`

## 3. Test it

**Via curl:**
```bash
curl -X POST http://localhost:8000/predict \
  -F "image=@/path/to/some_moon_image.png"
```

**Via the /docs page:** open `http://localhost:8000/docs` in a browser,
expand `POST /predict`, click "Try it out", upload any `.png`/`.jpg`/`.tif`,
click Execute. You'll get the full JSON response plus links to the
generated images under `/static/results/`.

**Give this URL to your frontend teammate right now:**
`http://localhost:8000/predict` — they can start building all 10 frontend
components (upload, before/after slider, hazard overlays, risk map, safe
zone panel, 3D view, etc.) against this immediately, per section 5 of the
spec.

## 4. New endpoints (history)

- `GET /jobs` — list all past predictions, most recent first (summary
  fields only — filename, timestamp, recommended zone, crater/boulder
  counts, percent safe/moderate/hazardous)
- `GET /jobs/{id}` — fetch the full original `/predict` response for one
  past job by its UUID

Useful for a "past scans" screen in the frontend, or just for demoing
that the backend has real state, not just a stateless echo.

## 5. Project structure

```
moongrid-backend/
├── app/
│   ├── main.py          # FastAPI app + /predict, /jobs routes
│   ├── fake_data.py      # generates the hardcoded response + demo images
│   ├── schemas.py         # Pydantic models = the JSON contract, exactly
│   ├── db.py               # SQLAlchemy engine/session setup
│   ├── models.py            # PredictionJob ORM model (Postgres + PostGIS)
│   └── static/
│       ├── uploads/       # raw uploaded images land here
│       └── results/       # generated SR/original/riskmap images served here
├── docker-compose.yml     # one-command Postgres+PostGIS for local dev
├── .env.example
├── requirements.txt
└── README.md
```

## 6. Suggested order of work from here (step by step)

1. **Today:** `docker compose up -d`, run the server, confirm `/predict`
   still works and now shows up in `GET /jobs`. Then actually share the
   `/predict` URL with your frontend teammate — that's the one step from
   last time still not done.
2. **When someone figures out georeferencing** (mapping a pixel in the
   TMC image to a real selenographic lat/lon — usually from the image's
   metadata or a known footprint), populate the `location` column on each
   job with the recommended zone's real coordinates. That unlocks PostGIS
   queries like "zones within X km of here" for free — tell me when
   you're ready for this and I'll wire it in.
3. **When someone starts the SR model:** replace only the body of
   `build_fake_predict_response()` in `fake_data.py` — swap the
   `_make_super_res_image` fake upscale for a real SwinIR/ESRGAN inference
   call. Nothing in `main.py` or the route needs to change.
4. **When someone starts hazard detection:** same idea — replace the
   hardcoded `hazards` dict values with real YOLO/U-Net outputs, keeping
   the exact same keys (`craters`, `boulders`, `slope_zones`, `shadow_zones`).
5. **Deploy for the demo:** since this has zero external dependencies
   beyond `pip install -r requirements.txt`, it'll run anywhere — a
   teammate's laptop, a free Render/Railway instance, whatever's easiest
   day-of.

## 6. Common gotchas

- If `python-multipart` isn't installed, file uploads will silently fail —
  it's in `requirements.txt`, just make sure you actually ran `pip install`.
- If your frontend gets CORS errors, double check it's calling
  `http://localhost:8000` (not `127.0.0.1` — browsers treat these as
  different origins sometimes) or just leave CORS wide open like this
  starter does.
- Coordinates in the response are pixel coordinates relative to the
  **returned SR image's actual dimensions** (per spec section 3) — the
  demo correctly scales hazard/zone coordinates to whatever size image
  you upload, so test with a couple of different image sizes to confirm
  your frontend overlay math is reading actual image dimensions and not
  assuming a fixed size.
