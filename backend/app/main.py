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

from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Roteador versionado
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Monta arquivos estáticos do frontend SPA Responsivo v2
app_root = Path(__file__).resolve().parent.parent.parent
candidates = [
    app_root / "frontend" / "dist",
    Path("/app/frontend/dist"),
    Path("/app/frontend"),
    app_root / "frontend",
    Path("frontend/dist"),
    Path("frontend"),
]

static_target = None
for candidate in candidates:
    if candidate.exists() and (candidate / "index.html").exists():
        static_target = candidate
        break

if static_target:
    if (static_target / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(static_target / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = static_target / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        index_file = static_target / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)
        return {"error": "Frontend build not found"}


