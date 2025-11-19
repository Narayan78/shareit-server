"""
WebSocket File Transfer Mediator Server
Supports multiple sessions, sender/receiver mode, and streaming of large files.
"""

import asyncio
import os
import json
import logging
from datetime import datetime
from typing import Dict, Optional
import sys
from fastapi.responses import HTMLResponse, FileResponse
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("mediator_ws")

app = FastAPI(title="File Transfer Mediator WebSocket Server")

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
        self.created_at = datetime.now()


sessions: Dict[str, TransferSession] = {}
MAX_SESSIONS = 100


# ------------------------
# WebSocket Endpoint
# ------------------------

@app.websocket("/ws/{session_id}/{mode}/{user_id}")
async def ws_transfer(websocket: WebSocket, session_id: str, mode: str, user_id: str):
    await websocket.accept()
    logger.info(f"New connection: User={user_id}, Mode={mode}, Session={session_id}")

    # Session creation
    if len(sessions) >= MAX_SESSIONS:
        await websocket.send_text(json.dumps({"status": "error", "message": "Server at capacity"}))
        await websocket.close()
        return

    if session_id not in sessions:
        sessions[session_id] = TransferSession(session_id)

    session = sessions[session_id]

    try:
        if mode == "sender":
            session.sender = websocket
            await websocket.send_text(json.dumps({
                "status": "waiting",
                "message": "Session created. Waiting for receiver...",
                "session_id": session_id,
                "timestamp": datetime.now().isoformat()
            }))

            # Wait for receiver to connect (5 min timeout)
            for _ in range(300):  # 300 * 1s = 5 min
                if session.receiver:
                    break
                await asyncio.sleep(1)
            else:
                await websocket.send_text(json.dumps({"status": "error", "message": "Receiver timeout"}))
                del sessions[session_id]
                await websocket.close()
                return

            logger.info(f"Receiver connected for session {session_id}. Starting transfer...")
            session.is_active = True

            # Start streaming data from sender → receiver
            try:
                while True:
                    data = await websocket.receive_bytes()
                    session.bytes_transferred += len(data)
                    if session.receiver:
                        await session.receiver.send_bytes(data)
            except WebSocketDisconnect:
                logger.info(f"Sender disconnected: {user_id}")
            finally:
                session.is_active = False
                logger.info(f"Session {session_id} completed. Total bytes: {session.bytes_transferred}")
                if session.receiver:
                    await session.receiver.close()
                del sessions[session_id]

        elif mode == "receiver":
            session.receiver = websocket
            await websocket.send_text(json.dumps({
                "status": "connected",
                "message": "Connected to sender",
                "metadata": session.metadata,
                "timestamp": datetime.now().isoformat()
            }))
            logger.info(f"Receiver {user_id} joined session {session_id}")

            # Notify sender
            if session.sender:
                await session.sender.send_text(json.dumps({
                    "status": "receiver_connected",
                    "message": "Receiver connected. Start transfer...",
                    "timestamp": datetime.now().isoformat()
                }))

            try:
                while True:
                    await asyncio.sleep(1)  # idle, data comes from sender
            except WebSocketDisconnect:
                logger.info(f"Receiver disconnected: {user_id}")
                session.receiver = None

        else:
            await websocket.send_text(json.dumps({"status": "error", "message": f"Invalid mode {mode}"}))
            await websocket.close()

    except Exception as e:
        logger.error(f"Error in session {session_id}: {e}", exc_info=True)
        await websocket.send_text(json.dumps({"status": "error", "message": str(e)}))
        await websocket.close()


# ------------------------
# Stats Reporter
# ------------------------
async def stats_reporter():
    while True:
        await asyncio.sleep(300)  # every 5 minutes
        active_sessions = sum(1 for s in sessions.values() if s.is_active)
        total_bytes = sum(s.bytes_transferred for s in sessions.values())
        logger.info("=" * 60)
        logger.info("SERVER STATISTICS")
        logger.info(f"Total sessions: {len(sessions)}")
        logger.info(f"Active transfers: {active_sessions}")
        logger.info(f"Total bytes transferred: {total_bytes / (1024*1024):.2f} MB")
        logger.info("=" * 60)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(stats_reporter())
    logger.info("WebSocket mediator started and ready to accept connections.")


# ------------------------
# Simple HTML Test Page
# ------------------------
@app.get("/")
async def serve_index():
    return FileResponse("index.html")


# ------------------------
# Run Uvicorn Server
# ------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, log_level="info")
