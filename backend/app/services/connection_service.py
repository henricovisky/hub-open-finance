import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.integrations.pluggy import PluggyClient
from app.models.connection import (
    ConnectionStatus,
    ConnectionSyncRun,
    FinancialConnection,
    SyncStatus,
    SyncTrigger,
    map_pluggy_status_to_internal,
)
from app.models.user import AuditLog, User


class ConnectionService:
    """Serviço para gerenciamento seguro do ciclo de vida das conexões financeiras."""

    @staticmethod
    async def create_connect_token(
        user: User,
        client: PluggyClient,
        webhook_url: Optional[str] = None,
    ) -> str:
        """Gera um Connect Token temporário associado ao ID estável do usuário."""
        resp = await client.connect.create_token(
            client_user_id=str(user.id),
            webhook_url=webhook_url,
        )
        return resp.connect_token

    @staticmethod
    async def complete_connection(
        db: AsyncSession,
        user: User,
        client: PluggyClient,
        item_id: str,
    ) -> FinancialConnection:
        """
        Recebe o item_id do widget e valida diretamente contra a Pluggy.
        Nunca confia em dados enviados pelo cliente no navegador.
        """
        now = datetime.now(timezone.utc)

        # 1. Validação do Item na Pluggy
        try:
            pluggy_item = await client.items.get(item_id)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Não foi possível validar o Item informado na Pluggy: {str(exc)}",
            )

        connector_id = pluggy_item.connector.id if pluggy_item.connector else 0
        institution_name = pluggy_item.connector.name if pluggy_item.connector else "Instituição Desconhecida"
        internal_status = map_pluggy_status_to_internal(pluggy_item.status)

        # 2. Busca ou criação da conexão no banco local (evita duplicações)
        stmt = select(FinancialConnection).where(FinancialConnection.pluggy_item_id == item_id)
        result = await db.execute(stmt)
        conn = result.scalar_one_or_none()

        if conn:
            conn.status = internal_status
            conn.raw_status = pluggy_item.status
            conn.status_detail = pluggy_item.status_detail
            conn.deleted_at = None
            conn.last_sync_at = now
        else:
            conn = FinancialConnection(
                provider="PLUGGY",
                pluggy_item_id=item_id,
                owner_user_id=user.id,
                institution_name=institution_name,
                connector_id=connector_id,
                status=internal_status,
                raw_status=pluggy_item.status,
                status_detail=pluggy_item.status_detail,
                consent_expires_at=pluggy_item.consent_expires_at,
                last_sync_at=now,
                created_at=now,
            )
            db.add(conn)

        await db.flush()

        # 3. Registra execução de sincronização inicial
        sync_run = ConnectionSyncRun(
            connection_id=conn.id,
            trigger=SyncTrigger.INITIAL,
            status=SyncStatus.PENDING,
            started_at=now,
        )
        db.add(sync_run)

        # 4. Auditoria
        audit = AuditLog(
            actor_user_id=user.id,
            action="CONNECTION_COMPLETED",
            entity_type="FINANCIAL_CONNECTION",
            entity_id=str(conn.id),
            metadata_safe={
                "institution_name": institution_name,
                "connector_id": connector_id,
                "status": internal_status.value,
            },
            created_at=now,
        )
        db.add(audit)
        await db.commit()
        await db.refresh(conn)
        return conn

    @staticmethod
    async def create_reconnect_token(
        db: AsyncSession,
        user: User,
        client: PluggyClient,
        connection_id: uuid.UUID,
    ) -> str:
        """Gera um Connect Token para atualizar/reconectar uma instituição existente."""
        stmt = select(FinancialConnection).where(
            FinancialConnection.id == connection_id,
            FinancialConnection.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        conn = result.scalar_one_or_none()

        if not conn:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conexão não encontrada.",
            )

        resp = await client.connect.create_token(
            item_id=conn.pluggy_item_id,
            client_user_id=str(user.id),
        )
        return resp.connect_token

    @staticmethod
    async def list_connections(db: AsyncSession) -> List[FinancialConnection]:
        """Lista conexões ativas."""
        stmt = (
            select(FinancialConnection)
            .where(FinancialConnection.deleted_at.is_(None))
            .order_by(FinancialConnection.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_connection_detail(db: AsyncSession, connection_id: uuid.UUID) -> FinancialConnection:
        """Obtém detalhes da conexão com histórico recente de sincronizações."""
        stmt = (
            select(FinancialConnection)
            .where(
                FinancialConnection.id == connection_id,
                FinancialConnection.deleted_at.is_(None),
            )
            .options(selectinload(FinancialConnection.sync_runs))
        )
        result = await db.execute(stmt)
        conn = result.scalar_one_or_none()

        if not conn:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conexão não encontrada.",
            )
        return conn

    @staticmethod
    async def delete_connection(
        db: AsyncSession,
        user: User,
        client: PluggyClient,
        connection_id: uuid.UUID,
    ) -> None:
        """Desconecta a instituição na Pluggy e marca como removida no banco."""
        stmt = select(FinancialConnection).where(
            FinancialConnection.id == connection_id,
            FinancialConnection.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        conn = result.scalar_one_or_none()

        if not conn:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conexão não encontrada.",
            )

        now = datetime.now(timezone.utc)
        conn.deleted_at = now
        conn.status = ConnectionStatus.DISCONNECTED

        # Tenta remover na Pluggy
        try:
            await client.items.delete(conn.pluggy_item_id)
        except Exception:
            pass  # Tolera caso já tenha sido excluído externamente

        audit = AuditLog(
            actor_user_id=user.id,
            action="CONNECTION_DELETED",
            entity_type="FINANCIAL_CONNECTION",
            entity_id=str(conn.id),
            created_at=now,
        )
        db.add(audit)
        await db.commit()
