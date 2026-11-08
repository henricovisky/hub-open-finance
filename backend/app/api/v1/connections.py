import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import require_admin
from app.core.database import get_db_session
from app.core.pluggy import get_pluggy_client
from app.integrations.pluggy import PluggyClient
from app.models.connection import SyncTrigger
from app.models.user import User
from app.schemas.connection import (
    ConnectCompleteRequest,
    ConnectionDetailResponse,
    ConnectionResponse,
    ConnectionSyncRunResponse,
    ConnectTokenResponse,
)
from app.services.connection_service import ConnectionService
from app.services.sync_service import SyncService

router = APIRouter(prefix="/connections", tags=["connections"])


@router.get("", response_model=List[ConnectionResponse])
async def list_connections(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Lista todas as conexões financeiras ativas (Acesso restrito ao Administrador)."""
    connections = await ConnectionService.list_connections(db)
    return connections


@router.post("/connect-token", response_model=ConnectTokenResponse)
async def create_connect_token(
    admin: User = Depends(require_admin),
    client: PluggyClient = Depends(get_pluggy_client),
):
    """
    Gera um Connect Token temporário (30 min) para abrir o Pluggy Connect Widget.
    Apenas o Administrador pode conectar novas contas.
    """
    token = await ConnectionService.create_connect_token(
        user=admin,
        client=client,
    )
    return ConnectTokenResponse(connect_token=token)


@router.post("/complete", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
async def complete_connection(
    payload: ConnectCompleteRequest,
    admin: User = Depends(require_admin),
    client: PluggyClient = Depends(get_pluggy_client),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Recebe o itemId retornado pelo callback do widget e valida diretamente na Pluggy
    antes de persistir a conexão no banco local e disparar a sincronização imediata.
    """
    item_id = payload.resolved_item_id
    connection = await ConnectionService.complete_connection(
        db=db,
        user=admin,
        client=client,
        item_id=item_id,
    )

    return connection


@router.post("/sync-nubank", response_model=ConnectionSyncRunResponse)
async def sync_nubank(
    admin: User = Depends(require_admin),
    client: PluggyClient = Depends(get_pluggy_client),
    db: AsyncSession = Depends(get_db_session),
):
    """Sincroniza imediatamente o Item Nubank configurado."""
    from app.core.config import settings
    from app.models.connection import ConnectionStatus, FinancialConnection

    item_id = settings.PLUGGY_ITEM_NUBANK or "9bbc4ce2-443c-4c34-bb87-bcc5826d6b20"

    conn_stmt = select(FinancialConnection).where(FinancialConnection.pluggy_item_id == item_id)
    conn = (await db.execute(conn_stmt)).scalar_one_or_none()

    if not conn:
        pluggy_item = await client.items.get(item_id)
        inst_name = pluggy_item.connector.name if pluggy_item.connector else "Nu Pagamentos S.A."
        conn = FinancialConnection(
            owner_user_id=admin.id,
            pluggy_item_id=item_id,
            connector_id=pluggy_item.connector_id,
            institution_name=inst_name,
            status=ConnectionStatus.CONNECTED,
            raw_status=pluggy_item.status,
        )
        db.add(conn)
        await db.commit()
        await db.refresh(conn)

    sync_run = await SyncService.sync_connection(
        db=db,
        connection_id=conn.id,
        client=client,
        trigger=SyncTrigger.MANUAL,
    )
    return sync_run


@router.post("/{connection_id}/sync", response_model=ConnectionSyncRunResponse)
async def sync_connection_manually(
    connection_id: uuid.UUID,
    admin: User = Depends(require_admin),
    client: PluggyClient = Depends(get_pluggy_client),
    db: AsyncSession = Depends(get_db_session),
):
    """Dispara a sincronização completa de contas e transações de uma conexão (ADMIN)."""
    sync_run = await SyncService.sync_connection(
        db=db,
        connection_id=connection_id,
        client=client,
        trigger=SyncTrigger.MANUAL,
    )
    return sync_run


@router.post("/{connection_id}/reconnect-token", response_model=ConnectTokenResponse)
async def create_reconnect_token(
    connection_id: uuid.UUID,
    admin: User = Depends(require_admin),
    client: PluggyClient = Depends(get_pluggy_client),
    db: AsyncSession = Depends(get_db_session),
):
    """Gera um Connect Token específico para atualizar ou reconectar uma conexão existente."""
    token = await ConnectionService.create_reconnect_token(
        db=db,
        user=admin,
        client=client,
        connection_id=connection_id,
    )
    return ConnectTokenResponse(connect_token=token)


@router.get("/{connection_id}", response_model=ConnectionDetailResponse)
async def get_connection_detail(
    connection_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Consulta detalhes e histórico de sincronização de uma conexão."""
    connection = await ConnectionService.get_connection_detail(db, connection_id)
    return connection


@router.delete("/{connection_id}", status_code=status.HTTP_200_OK)
async def delete_connection(
    connection_id: uuid.UUID,
    admin: User = Depends(require_admin),
    client: PluggyClient = Depends(get_pluggy_client),
    db: AsyncSession = Depends(get_db_session),
):
    """Desconecta a instituição na Pluggy e marca como removida no banco."""
    await ConnectionService.delete_connection(
        db=db,
        user=admin,
        client=client,
        connection_id=connection_id,
    )
    return {"message": "Conexão removida com sucesso."}
