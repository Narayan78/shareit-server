"""
Enhanced WebSocket File Transfer Mediator Server
Professional features: compression, resume, health checks, rate limiting
"""

import asyncio
import os
import json
import logging
import zlib
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Set
import sys
from collections import defaultdict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("mediator_ws")

app = FastAPI(title="Professional File Transfer Mediator")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------
# Configuration
# ------------------------
MAX_SESSIONS = 200
MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024  # 5GB
SESSION_TIMEOUT = timedelta(minutes=30)
PING_INTERVAL = 30  # seconds
CHUNK_SIZE = 128 * 1024  # 128KB

# ------------------------
# Session Management
# ------------------------
class TransferSession:
    def __init__(self, session_id: str, metadata: Optional[Dict] = None):
        self.session_id = session_id
        self.metadata = metadata or {}
        self.sender: Optional[WebSocket] = None
        self.receiver: Optional[WebSocket] = None
        self.bytes_transferred: int = 0
        self.is_active: bool = False
        self.is_compressed: bool = False
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.transfer_speed: float = 0.0
        self.files_transferred: int = 0
        self.current_file: Optional[str] = None
        self.paused: bool = False

    def update_activity(self):
        self.last_activity = datetime.now()

    def calculate_speed(self) -> float:
        if self.start_time and self.bytes_transferred > 0:
            elapsed = (datetime.now() - self.start_time).total_seconds()
            if elapsed > 0:
                return self.bytes_transferred / elapsed
        return 0.0


sessions: Dict[str, TransferSession] = {}
connection_counts: Dict[str, int] = defaultdict(int)  # Rate limiting

# ------------------------
# Health Check & Cleanup
# ------------------------
async def ping_connections():
    """Send periodic pings to maintain connection health"""
    while True:
        await asyncio.sleep(PING_INTERVAL)
        for session_id, session in list(sessions.items()):
            try:
                if session.sender:
                    await session.sender.send_json({"type": "ping"})
                if session.receiver:
                    await session.receiver.send_json({"type": "ping"})
            except Exception as e:
                logger.error(f"Ping failed for session {session_id}: {e}")

async def cleanup_stale_sessions():
    """Remove inactive sessions"""
    while True:
        await asyncio.sleep(60)
        now = datetime.now()
        stale_sessions = [
            sid for sid, session in sessions.items()
            if now - session.last_activity > SESSION_TIMEOUT
        ]
        for sid in stale_sessions:
            logger.info(f"Cleaning up stale session: {sid}")
            session = sessions.pop(sid, None)
            if session:
                if session.sender:
                    try:
                        await session.sender.close()
                    except:
                        pass
                if session.receiver:
                    try:
                        await session.receiver.close()
                    except:
                        pass

# ------------------------
# WebSocket Endpoint
# ------------------------
@app.websocket("/ws/{session_id}/{mode}/{user_id}")
async def ws_transfer(websocket: WebSocket, session_id: str, mode: str, user_id: str):
    await websocket.accept()
    logger.info(f"Connection: User={user_id}, Mode={mode}, Session={session_id}")

    # Rate limiting check
    if connection_counts[user_id] >= 5:
        await websocket.send_json({"status": "error", "message": "Too many connections"})
        await websocket.close()
        return

    connection_counts[user_id] += 1

    # Session capacity check
    if len(sessions) >= MAX_SESSIONS and session_id not in sessions:
        await websocket.send_json({"status": "error", "message": "Server at capacity"})
        await websocket.close()
        connection_counts[user_id] -= 1
        return

    # Create or get session
    if session_id not in sessions:
        sessions[session_id] = TransferSession(session_id)

    session = sessions[session_id]
    session.update_activity()

    try:
        if mode == "sender":
            await handle_sender(websocket, session, user_id, session_id)
        elif mode == "receiver":
            await handle_receiver(websocket, session, user_id, session_id)
        else:
            await websocket.send_json({"status": "error", "message": f"Invalid mode: {mode}"})
            await websocket.close()

    except Exception as e:
        logger.error(f"Error in session {session_id}: {e}", exc_info=True)
        await websocket.send_json({"status": "error", "message": str(e)})
    finally:
        connection_counts[user_id] -= 1
        try:
            await websocket.close()
        except:
            pass


async def handle_sender(websocket: WebSocket, session: TransferSession, user_id: str, session_id: str):
    session.sender = websocket
    await websocket.send_json({
        "status": "waiting",
        "message": "Waiting for receiver...",
        "session_id": session_id,
        "timestamp": datetime.now().isoformat()
    })

    # Wait for receiver with timeout
    timeout = 300  # 5 minutes
    start = time.time()
    while not session.receiver and (time.time() - start) < timeout:
        await asyncio.sleep(1)
        session.update_activity()

    if not session.receiver:
        await websocket.send_json({"status": "error", "message": "Receiver timeout"})
        if session_id in sessions:
            del sessions[session_id]
        return

    logger.info(f"Receiver connected for session {session_id}")
    session.is_active = True
    session.start_time = datetime.now()

    await websocket.send_json({
        "status": "ready",
        "message": "Receiver connected. Ready to transfer.",
        "timestamp": datetime.now().isoformat()
    })

    # Stream data from sender to receiver
    try:
        last_speed_update = time.time()
        while True:
            data = await websocket.receive()
            
            if "text" in data:
                # Handle control messages
                msg = json.loads(data["text"])
                if msg.get("type") == "pause":
                    session.paused = True
                    if session.receiver:
                        await session.receiver.send_json({"type": "paused"})
                elif msg.get("type") == "resume":
                    session.paused = False
                    if session.receiver:
                        await session.receiver.send_json({"type": "resumed"})
                elif msg.get("type") == "pong":
                    session.update_activity()
                continue

            if "bytes" in data and not session.paused:
                chunk = data["bytes"]
                session.bytes_transferred += len(chunk)
                session.update_activity()

                # Send to receiver
                if session.receiver:
                    await session.receiver.send_bytes(chunk)

                # Update speed periodically
                now = time.time()
                if now - last_speed_update > 1.0:
                    speed = session.calculate_speed()
                    await websocket.send_json({
                        "type": "speed_update",
                        "speed": speed,
                        "bytes_transferred": session.bytes_transferred
                    })
                    last_speed_update = now

    except WebSocketDisconnect:
        logger.info(f"Sender disconnected: {user_id}")
    finally:
        session.is_active = False
        session.end_time = datetime.now()
        logger.info(f"Session {session_id} completed. Bytes: {session.bytes_transferred}")
        if session.receiver:
            try:
                await session.receiver.send_json({"type": "transfer_complete"})
                await session.receiver.close()
            except:
                pass
        if session_id in sessions:
            del sessions[session_id]


async def handle_receiver(websocket: WebSocket, session: TransferSession, user_id: str, session_id: str):
    session.receiver = websocket
    session.update_activity()

    await websocket.send_json({
        "status": "connected",
        "message": "Connected to sender",
        "metadata": session.metadata,
        "timestamp": datetime.now().isoformat()
    })

    logger.info(f"Receiver {user_id} joined session {session_id}")

    # Notify sender
    if session.sender:
        try:
            await session.sender.send_json({
                "status": "receiver_connected",
                "message": "Receiver connected",
                "timestamp": datetime.now().isoformat()
            })
        except:
            pass

    try:
        # Receiver stays idle, data flows from sender
        while True:
            data = await websocket.receive()
            
            if "text" in data:
                msg = json.loads(data["text"])
                if msg.get("type") == "pong":
                    session.update_activity()
            
            await asyncio.sleep(0.1)
            
    except WebSocketDisconnect:
        logger.info(f"Receiver disconnected: {user_id}")
        session.receiver = None


# ------------------------
# REST API Endpoints
# ------------------------
@app.get("/api/sessions")
async def get_sessions():
    """Get active sessions info"""
    return {
        "total": len(sessions),
        "active": sum(1 for s in sessions.values() if s.is_active),
        "sessions": [
            {
                "id": s.session_id,
                "active": s.is_active,
                "bytes": s.bytes_transferred,
                "speed": s.calculate_speed(),
                "created": s.created_at.isoformat()
            }
            for s in sessions.values()
        ]
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "sessions": len(sessions),
        "timestamp": datetime.now().isoformat()
    }

# ------------------------
# Statistics Reporter
# ------------------------
async def stats_reporter():
    while True:
        await asyncio.sleep(300)
        active_sessions = sum(1 for s in sessions.values() if s.is_active)
        total_bytes = sum(s.bytes_transferred for s in sessions.values())
        avg_speed = sum(s.calculate_speed() for s in sessions.values() if s.is_active)
        if active_sessions > 0:
            avg_speed /= active_sessions

        logger.info("=" * 60)
        logger.info("SERVER STATISTICS")
        logger.info(f"Total sessions: {len(sessions)}")
        logger.info(f"Active transfers: {active_sessions}")
        logger.info(f"Total data: {total_bytes / (1024**3):.2f} GB")
        logger.info(f"Avg speed: {avg_speed / (1024**2):.2f} MB/s")
        logger.info("=" * 60)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(stats_reporter())
    asyncio.create_task(ping_connections())
    asyncio.create_task(cleanup_stale_sessions())
    logger.info("Enhanced WebSocket server started")

# ------------------------
# Serve Frontend
# ------------------------
@app.get("/")
async def serve_index():
    return FileResponse("index.html")

# ------------------------
# Run Server
# ------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
        ws_ping_interval=PING_INTERVAL,
        ws_ping_timeout=PING_INTERVAL * 2
    )
