from pydantic_settings import BaseSettings
from datetime import timedelta

class Settings(BaseSettings):
    PROJECT_NAME: str = "File Transfer Pro"
    MAX_SESSIONS: int = 200
    MAX_FILE_SIZE: int = 5 * 1024 * 1024 * 1024  # 5GB
    SESSION_TIMEOUT: timedelta = timedelta(minutes=30)
    PING_INTERVAL: int = 30
    CHUNK_SIZE: int = 128 * 1024
    MAX_MESSAGE_LENGTH: int = 5000
    
    class Config:
        env_file = ".env"

settings = Settings()
