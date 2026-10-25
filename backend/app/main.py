from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core.config import settings
from app.core.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup de logging estruturado ao iniciar
    setup_logging(level="DEBUG" if settings.DEBUG else "INFO")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Hub Financeiro Pessoal & Familiar (Open Finance via Pluggy)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configuração de CORS dinâmico
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Roteador versionado
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
