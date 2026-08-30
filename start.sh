#!/usr/bin/env bash
# MoonGrid — Start both backend and frontend dev servers
# Run from the repo root: bash start.sh
set -e

echo "========================================="
echo "  MoonGrid — Full Stack Startup"
echo "========================================="

# ── Backend ──────────────────────────────────
echo ""
echo "[1/2] Starting FastAPI backend on http://localhost:8000 ..."
echo "      (First run loads ML models — may take 30-60s)"
echo ""

cd backend
# Activate venv if present
if [ -f "venv/Scripts/activate" ]; then
  source venv/Scripts/activate
elif [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
fi

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# ── Frontend ─────────────────────────────────
echo "[2/2] Starting Next.js frontend on http://localhost:3000 ..."
echo ""

cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================="
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:3000"
echo "  API Docs → http://localhost:8000/docs"
echo "========================================="
echo ""
echo "Press Ctrl+C to stop both servers."
wait $BACKEND_PID $FRONTEND_PID
