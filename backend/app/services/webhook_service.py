import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.integrations.pluggy import PluggyClient
from app.models.connection import ConnectionStatus, FinancialConnection, SyncTrigger
from app.models.webhook import WebhookEvent, WebhookEventStatus
from app.services.sync_service import SyncService


class WebhookService:
    """Gerenciamento seguro e idempotente de notificações de webhook da Pluggy."""

    @staticmethod
    async def record_event(
        db: AsyncSession,
        event_id: str,
        event_type: str,
        item_id: Optional[str],
        payload: Dict[str, Any],
    ) -> Tuple[WebhookEvent, bool]:
        """
        Registra o evento recebido garantindo idempotência estrita via chave UNIQUE(event_id).
        Retorna (evento, is_new). Se o evento já existir, is_new será False.
        """
        stmt = select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            return existing, False

        now = datetime.now(timezone.utc)
        new_event = WebhookEvent(
            event_id=event_id,
            event_type=event_type,
            item_id=item_id,
            payload_minimal={
                "event": event_type,
                "itemId": item_id,
                "data_keys": list(payload.get("data", {}).keys()) if isinstance(payload.get("data"), dict) else [],
            },
            status=WebhookEventStatus.PENDING,
            received_at=now,
        )
        db.add(new_event)
        await db.commit()
        await db.refresh(new_event)
        return new_event, True

    @staticmethod
    async def process_event(
        db: AsyncSession,
        client: PluggyClient,
        event_id: str,
    ) -> WebhookEvent:
        """
        Processa o evento de webhook:
        1. Valida se o Item pertence a uma conexão local autorizada.
        2. Atualiza estado e dispara sincronizações assíncronas pertinentes.
        """
        stmt = select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        result = await db.execute(stmt)
        event = result.scalar_one_or_none()

        if not event or event.status == WebhookEventStatus.PROCESSED:
            return event

        now = datetime.now(timezone.utc)

        # 1. Validação do vínculo do Item com uma conexão registrada no sistema
        if not event.item_id:
            event.status = WebhookEventStatus.IGNORED
            event.processed_at = now
            await db.commit()
            return event

        conn_stmt = select(FinancialConnection).where(
            FinancialConnection.pluggy_item_id == event.item_id,
            FinancialConnection.deleted_at.is_(None),
        )
        conn_res = await db.execute(conn_stmt)
        conn = conn_res.scalar_one_or_none()

        if not conn:
            # Item desconhecido: ignorado para proteger o sistema contra chamadas forjadas
            event.status = WebhookEventStatus.IGNORED
            event.processed_at = now
            await db.commit()
            return event

        # 2. Despacho por tipo de evento (conforme DTI §6.1)
        event_type = (event.event_type or "").lower()

        try:
            if event_type in ("item/created", "item/updated", "transactions/created", "transactions/updated"):
                await SyncService.sync_connection(
                    db=db,
                    connection_id=conn.id,
                    client=client,
                    trigger=SyncTrigger.WEBHOOK,
                )
            elif event_type in ("item/waiting_user_input", "item/waiting_user_action"):
                conn.status = ConnectionStatus.ACTION_REQUIRED
                conn.status_detail = "Ação de validação ou MFA necessária na instituição."
                await db.commit()
            elif event_type in ("item/error", "login_error"):
                conn.status = ConnectionStatus.ATTENTION
                conn.status_detail = "Erro na sincronização reportado pela instituição."
                await db.commit()
            elif event_type == "item/deleted":
                conn.status = ConnectionStatus.DISCONNECTED
                conn.deleted_at = now
                await db.commit()

            event.status = WebhookEventStatus.PROCESSED
            event.processed_at = datetime.now(timezone.utc)
            await db.commit()

        except Exception as exc:
            event.status = WebhookEventStatus.FAILED
            event.attempts += 1
            event.last_error = str(exc)[:500]
            await db.commit()

        return event
