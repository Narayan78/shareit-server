import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.logging import logger
from .api.endpoints import websocket
from .services.session_manager import session_manager

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

# ... existing code ...

# Mount static files
# Ensure we're pointing to the correct dist folder relative to this file
# backend/app/main.py -> backend/ -> frontend/dist
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIST_DIR = os.path.join(BASE_DIR, "frontend", "dist")

if os.path.exists(DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

@app.get("/")
async def root():
    index_path = DIST_DIR / "index.html"
    print(f"Looking for index.html at: {index_path}")  # Debug log
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "File Transfer Pro API is running (Frontend not built)"}