import asyncio
from typing import Dict, Optional, List
from datetime import datetime
from fastapi import WebSocket
from ..core.config import settings
from ..core.logging import logger

class TransferSession:
    def __init__(self, session_id: str, metadata: Optional[Dict] = None):
        self.session_id = session_id
        self.metadata = metadata or {}
        self.sender: Optional[WebSocket] = None
        self.receiver: Optional[WebSocket] = None
        self.bytes_transferred: int = 0
        self.is_active: bool = False
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.messages: List[Dict] = []
        self.paused: bool = False

    def update_activity(self):
        self.last_activity = datetime.now()

    def calculate_speed(self) -> float:
        if self.start_time and self.bytes_transferred > 0:
            elapsed = (datetime.now() - self.start_time).total_seconds()
            if elapsed > 0:
                return self.bytes_transferred / elapsed
        return 0.0

    def add_message(self, sender: str, message: str) -> Dict:
        msg_data = {
            "sender": sender,
            "message": message[:settings.MAX_MESSAGE_LENGTH],
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        self.messages.append(msg_data)
        if len(self.messages) > 100:
            self.messages = self.messages[-100:]
        return msg_data

class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, TransferSession] = {}
        self.connection_counts: Dict[str, int] = {}

    def get_session(self, session_id: str) -> Optional[TransferSession]:
        return self.sessions.get(session_id)

    def create_session(self, session_id: str) -> TransferSession:
        if session_id not in self.sessions:
            self.sessions[session_id] = TransferSession(session_id)
        return self.sessions[session_id]

    def remove_session(self, session_id: str):
        if session_id in self.sessions:
            del self.sessions[session_id]

    async def cleanup_stale_sessions(self):
        while True:
            await asyncio.sleep(60)
            now = datetime.now()
            stale_sessions = [
                sid for sid, session in self.sessions.items()
                if now - session.last_activity > settings.SESSION_TIMEOUT
            ]
            for sid in stale_sessions:
                logger.info(f"Cleaning up stale session: {sid}")
                session = self.sessions.pop(sid, None)
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

session_manager = SessionManager()
