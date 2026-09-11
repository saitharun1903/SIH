import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "NEXUS"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Security
    JWT_SECRET: str = "super-secret-key-change-in-production-nexus-sih2026-sih26202"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = "sqlite:///./nexus.db"

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://lunor.co.in",
        "https://www.lunor.co.in",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Organization-Level Thresholds (Configurable)
    DEFAULT_UNDERUTILIZATION_THRESHOLD: float = 40.0
    DEFAULT_OVERUTILIZATION_THRESHOLD: float = 90.0
    DEFAULT_CRITICAL_UTILIZATION_THRESHOLD: float = 95.0
    DEFAULT_ENERGY_COST_PER_UNIT: float = 8.50  # INR per kWh
    MINIMUM_FORECAST_DAYS: int = 14

    # Optional External AI API Key
    OPENAI_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
