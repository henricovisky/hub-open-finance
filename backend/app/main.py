from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.jobs.scheduler import shutdown_scheduler, start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup de logging estruturado
    setup_logging(level="DEBUG" if settings.DEBUG else "INFO")

    # Inicia o agendador em segundo plano (em produção / dev)
    start_scheduler()
    yield
    # Encerramento gracioso
    shutdown_scheduler()


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
