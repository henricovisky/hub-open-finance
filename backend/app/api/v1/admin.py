import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import require_admin
from app.core.database import get_db_session
from app.jobs.scheduler import get_scheduler_info
from app.models.connection import ConnectionSyncRun, FinancialConnection, SyncStatus
from app.models.finance import Account, Card, Category, Transaction
from app.models.investment import Bill, Investment, InvestmentTransaction, WealthSnapshot, WealthSnapshotItem
from app.models.planning import (
    CategoryColor,
    Goal,
    GoalContribution,
    InsightState,
    RecurringRule,
    UserPreference,
)
from app.models.user import AccountPermission, AuditLog, FeaturePermission, User
from app.models.webhook import WebhookEvent
from app.schemas.connection import ConnectionSyncRunResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/reset-data")
async def reset_financial_data(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Limpa e zera todos os dados financeiros (transações, contas, conexões, faturas, investimentos),
    preservando os usuários e credenciais de acesso do sistema (ADMIN).
    """
    models_to_clear = [
        WealthSnapshotItem,
        WealthSnapshot,
        InvestmentTransaction,
        Investment,
        Bill,
        Transaction,
        Card,
        AccountPermission,
        FeaturePermission,
        Account,
        ConnectionSyncRun,
        FinancialConnection,
        GoalContribution,
        Goal,
        RecurringRule,
        UserPreference,
        CategoryColor,
        InsightState,
        WebhookEvent,
        Category,
    ]
    for model in models_to_clear:
        await db.execute(delete(model))

    audit = AuditLog(
        actor_user_id=admin.id,
        action="RESET_FINANCIAL_DATA",
        entity_type="SYSTEM",
        metadata_safe={"requested_by": admin.email},
    )
    db.add(audit)
    await db.commit()

    return {
        "status": "ok",
        "message": "Todos os dados financeiros foram limpos com sucesso. O sistema está completamente zerado.",
    }


@router.get("/system-status")
async def get_system_status(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Retorna o diagnóstico de saúde do sistema, agendador de tarefas e conexões (ADMIN).
    Calcula o indicador 'is_stale' (defasagem > 12h) para cada instituição (DDI §18 / DTI §9.9).
    """
    now = datetime.now(timezone.utc)
    stale_threshold = now - timedelta(hours=12)

    # 1. Consulta conexões ativas
    conn_stmt = (
        select(FinancialConnection)
        .where(FinancialConnection.deleted_at.is_(None))
        .order_by(FinancialConnection.created_at.desc())
    )
    conn_res = await db.execute(conn_stmt)
    connections = list(conn_res.scalars().all())

    connections_status = []
    for c in connections:
        last_success = c.last_successful_sync_at
        if last_success is not None and last_success.tzinfo is None:
            last_success = last_success.replace(tzinfo=timezone.utc)
        is_stale = last_success is None or last_success < stale_threshold
        connections_status.append({
            "id": c.id,
            "institution_name": c.institution_name,
            "status": c.status,
            "status_detail": c.status_detail,
            "last_sync_at": c.last_sync_at,
            "last_successful_sync_at": c.last_successful_sync_at,
            "is_stale": is_stale,
        })

    # 2. Contagem de falhas nas últimas 24h
    failed_24h_stmt = select(func.count(ConnectionSyncRun.id)).where(
        ConnectionSyncRun.status == SyncStatus.FAILED,
        ConnectionSyncRun.started_at >= (now - timedelta(hours=24)),
    )
    failed_res = await db.execute(failed_24h_stmt)
    failed_runs_24h = failed_res.scalar() or 0

    return {
        "status": "operational",
        "admin_user": admin.email,
        "scheduler": get_scheduler_info(),
        "total_connections": len(connections),
        "failed_runs_last_24h": failed_runs_24h,
        "connections": connections_status,
    }


@router.get("/sync-runs")
async def list_sync_runs(
    connection_id: Optional[uuid.UUID] = None,
    run_status: Optional[SyncStatus] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Lista o histórico de sincronizações das instituições financeiras com filtros e paginação."""
    base_filter = []
    if connection_id:
        base_filter.append(ConnectionSyncRun.connection_id == connection_id)
    if run_status:
        base_filter.append(ConnectionSyncRun.status == run_status)

    count_stmt = select(func.count(ConnectionSyncRun.id)).where(*base_filter)
    count_res = await db.execute(count_stmt)
    total = count_res.scalar() or 0

    offset = (page - 1) * page_size
    stmt = (
        select(ConnectionSyncRun)
        .where(*base_filter)
        .order_by(ConnectionSyncRun.started_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    runs = list(result.scalars().all())

    return {
        "results": [ConnectionSyncRunResponse.model_validate(r) for r in runs],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
