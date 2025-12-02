import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "File Transfer Pro")
    MAX_SESSIONS: int = int(os.getenv("MAX_SESSIONS", "200"))
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", str(5 * 1024 * 1024 * 1024)))  # 5GB
    SESSION_TIMEOUT: timedelta = timedelta(minutes=int(os.getenv("SESSION_TIMEOUT", "30")))
    PING_INTERVAL: int = int(os.getenv("PING_INTERVAL", "30"))
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", str(128 * 1024)))
    MAX_MESSAGE_LENGTH: int = int(os.getenv("MAX_MESSAGE_LENGTH", "5000"))

settings = Settings()
