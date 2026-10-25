import secrets
import uuid
from typing import Any, Dict
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db_session
from app.core.pluggy import get_pluggy_client
from app.integrations.pluggy import PluggyClient
from app.services.webhook_service import WebhookService

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def verify_webhook_secret(
    x_pluggy_webhook_secret: str = Header(default="", alias="X-Pluggy-Webhook-Secret"),
) -> None:
    """Valida o segredo do webhook com comparação em tempo constante."""
    expected_secret = settings.PLUGGY_WEBHOOK_SECRET
    if not expected_secret:
        return  # Em desenvolvimento sem segredo configurado

    if not x_pluggy_webhook_secret or not secrets.compare_digest(x_pluggy_webhook_secret, expected_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Segredo de webhook inválido ou ausente.",
        )


@router.post("/pluggy", status_code=status.HTTP_202_ACCEPTED)
async def handle_pluggy_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    payload: Dict[str, Any],
    _: None = Depends(verify_webhook_secret),
    client: PluggyClient = Depends(get_pluggy_client),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Endpoint para recepção rápida de webhooks da Pluggy.
    1. Valida segredo em tempo constante.
    2. Persiste o evento imediatamente em webhook_events garantindo idempotência.
    3. Responde 202 em < 1 segundo.
    4. Executa o processamento do evento de forma assíncrona.
    """
    event_type = payload.get("event")
    if not event_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload não contém o campo obrigatório 'event'.",
        )

    # Identificador único do evento
    event_id = str(payload.get("id") or payload.get("eventId") or uuid.uuid4())
    item_id = payload.get("itemId")

    event, is_new = await WebhookService.record_event(
        db=db,
        event_id=event_id,
        event_type=event_type,
        item_id=item_id,
        payload=payload,
    )

    if is_new:
        # Processa o evento em background ou imediatamente na sessão
        background_tasks.add_task(
            WebhookService.process_event,
            db=db,
            client=client,
            event_id=event_id,
        )

    return {
        "status": "received",
        "event_id": event_id,
        "is_duplicate": not is_new,
    }
