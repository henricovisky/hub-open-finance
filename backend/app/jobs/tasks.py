import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import List
from sqlalchemy import delete, select
from app.core.database import async_session_factory
from app.core.pluggy import get_pluggy_auth_manager
from app.integrations.pluggy import PluggyClient
from app.models.connection import FinancialConnection, SyncTrigger
from app.models.user import UserSession
from app.models.webhook import WebhookEvent
from app.services.sync_service import SyncService

logger = logging.getLogger(__name__)


async def run_scheduled_sync():
    """
    Job de sincronização agendada das conexões ativas (07:00, 13:30, 20:30).
    Isola falhas por conexão para que a instabilidade de um banco não afete os demais.
    """
    logger.info("Iniciando rotina agendada de sincronização de conexões financeiras...")

    async with async_session_factory() as db:
        stmt = select(FinancialConnection).where(FinancialConnection.deleted_at.is_(None))
        result = await db.execute(stmt)
        connections = list(result.scalars().all())

    if not connections:
        logger.info("Nenhuma conexão ativa cadastrada para sincronização agendada.")
        return

    auth = get_pluggy_auth_manager()
    async with PluggyClient(client_id=auth.client_id, client_secret=auth.client_secret, auth_manager=auth) as client:
        for conn in connections:
            try:
                async with async_session_factory() as db_session:
                    logger.info("Sincronizando conexão agendada: %s (%s)", conn.institution_name, conn.id)
                    await SyncService.sync_connection(
                        db=db_session,
                        connection_id=conn.id,
                        client=client,
                        trigger=SyncTrigger.SCHEDULED,
                    )
            except Exception as exc:
                logger.error("Falha ao sincronizar conexão agendada %s: %s", conn.id, str(exc))

    logger.info("Rotina agendada de sincronização concluída com sucesso.")


async def run_daily_reconciliation():
    """
    Job diário de reconciliação (03:00) para cobrir possíveis eventos de webhooks perdidos.
    """
    logger.info("Iniciando rotina diária de reconciliação...")
    await run_scheduled_sync()


async def run_cleanup_expired_data():
    """
    Job semanal de manutenção: remove sessões expiradas há mais de 30 dias e eventos de webhook antigos.
    """
    logger.info("Iniciando rotina periódica de limpeza de sessões expiradas...")
    threshold = datetime.now(timezone.utc) - timedelta(days=30)

    async with async_session_factory() as db:
        # Limpa sessões expiradas e revogadas há mais de 30 dias
        sess_stmt = delete(UserSession).where(
            UserSession.expires_at < threshold,
            UserSession.revoked_at.is_not(None),
        )
        sess_res = await db.execute(sess_stmt)

        # Limpa eventos de webhook processados há mais de 30 dias
        wh_stmt = delete(WebhookEvent).where(
            WebhookEvent.received_at < threshold,
            WebhookEvent.status.in_(["PROCESSED", "IGNORED"]),
        )
        wh_res = await db.execute(wh_stmt)

        await db.commit()
        logger.info(
            "Limpeza concluída: %d sessões expiradas e %d eventos de webhook antigos removidos.",
            sess_res.rowcount,
            wh_res.rowcount,
        )
