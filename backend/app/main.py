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

@app.get("/")
async def root():
    return {"message": "File Transfer Pro API is running"}
