from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class ChatMessage(BaseModel):
    sender: str
    message: str
    timestamp: str

class SessionInfo(BaseModel):
    id: str
    active: bool
    bytes: int
    speed: float
    created: str
    messages: int

class HealthCheck(BaseModel):
    status: str
    sessions: int
    timestamp: str

class SessionStats(BaseModel):
    total: int
    active: int
    sessions: List[SessionInfo]
