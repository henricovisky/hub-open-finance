from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Aplicação
    APP_ENV: str = "development"
    APP_NAME: str = "Hub Financeiro"
    APP_SECRET_KEY: str = "insecure_dev_secret_key_change_in_production"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    FRONTEND_ORIGIN: Union[str, List[str]] = "http://localhost:3000"

    # Banco de Dados
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/hub_financeiro"

    # Pluggy
    PLUGGY_BASE_URL: str = "https://api.pluggy.ai"
    PLUGGY_CLIENT_ID: str = ""
    PLUGGY_CLIENT_SECRET: str = ""
    PLUGGY_WEBHOOK_SECRET: str = ""

    # JWT e Segurança
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    ALGORITHM: str = "HS256"

    @property
    def cors_origins(self) -> List[str]:
        if isinstance(self.FRONTEND_ORIGIN, list):
            return self.FRONTEND_ORIGIN
        return [origin.strip() for origin in self.FRONTEND_ORIGIN.split(",") if origin.strip()]


settings = Settings()
