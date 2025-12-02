import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.logging import logger
from .api.endpoints import websocket
from .services.session_manager import session_manager
import os
from pathlib import Path

app = FastAPI(title=settings.PROJECT_NAME)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(websocket.router)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "sessions": len(session_manager.sessions),
        "timestamp": session_manager.connection_counts
    }

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(session_manager.cleanup_stale_sessions())
    logger.info(f"{settings.PROJECT_NAME} started")

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os


# Get the directory containing main.py
BACKEND_DIR = Path(__file__).resolve().parent.parent  # Goes up to backend/
DIST_DIR = BACKEND_DIR.parent / "frontend" / "dist"  # Goes to frontend/dist

print(f"Looking for frontend at: {DIST_DIR}")  # Debug log
print(f"DIST_DIR exists: {DIST_DIR.exists()}")  # Debug log

if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

@app.get("/")
async def root():
    index_path = DIST_DIR / "index.html"
    print(f"Looking for index.html at: {index_path}")  # Debug log
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "File Transfer Pro API is running (Frontend not built)"}