from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import get_current_user
from app.core.database import get_db_session
from app.models.base import UserRole
from app.models.investment import WealthSnapshot, WealthSnapshotItem
from app.models.user import User
from app.schemas.investment import AssetAllocationItem, WealthSnapshotRead, WealthSummary
from app.services.sync_service import SyncService

router = APIRouter(prefix="/wealth", tags=["wealth"])


@router.get("/summary", response_model=WealthSummary)
async def get_wealth_summary(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna o resumo consolidado atual do patrimônio líquido, dinheiro, investimentos,
    dívida de cartão e alocação por classes de ativos.
    - Administrador: visualiza consolidado total (Casa + Pessoal).
    - Membro: visualiza exclusivamente a parcela conjunta (Casa), preservando privacidade.
    """
    # Garante snapshot atualizado
    today = date.today()
    stmt = (
        select(WealthSnapshot)
        .options(selectinload(WealthSnapshot.items))
        .where(WealthSnapshot.snapshot_date == today)
    )
    result = await db.execute(stmt)
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        snapshot = await SyncService.generate_daily_wealth_snapshot(db, today)
        # Recarrega com items
        result = await db.execute(stmt)
        snapshot = result.scalar_one_or_none()

    if not snapshot:
        return WealthSummary(
            snapshot_date=today,
            cash_balance=Decimal("0.00"),
            investment_balance=Decimal("0.00"),
            credit_card_debt=Decimal("0.00"),
            net_worth=Decimal("0.00"),
            household_net_worth=Decimal("0.00"),
            personal_net_worth=Decimal("0.00"),
            asset_allocation=[],
        )

    allocation_items = [
        AssetAllocationItem(
            asset_class_code=item.asset_class_code,
            asset_class_name=item.asset_class_name,
            balance=item.balance,
            percentage=item.percentage,
        )
        for item in (snapshot.items or [])
    ]

    if current_user.role == UserRole.ADMIN:
        return WealthSummary(
            snapshot_date=snapshot.snapshot_date,
            cash_balance=snapshot.cash_balance,
            investment_balance=snapshot.investment_balance,
            credit_card_debt=snapshot.credit_card_debt,
            net_worth=snapshot.net_worth,
            household_net_worth=snapshot.household_net_worth,
            personal_net_worth=snapshot.personal_net_worth,
            asset_allocation=allocation_items,
        )
    else:
        # Membro: visualiza apenas patrimônio conjunto (Household)
        return WealthSummary(
            snapshot_date=snapshot.snapshot_date,
            cash_balance=snapshot.cash_balance,
            investment_balance=snapshot.investment_balance,
            credit_card_debt=snapshot.credit_card_debt,
            net_worth=snapshot.household_net_worth,
            household_net_worth=snapshot.household_net_worth,
            personal_net_worth=Decimal("0.00"),
            asset_allocation=allocation_items,
        )


@router.get("/snapshots", response_model=List[WealthSnapshotRead])
async def list_wealth_snapshots(
    days: int = Query(30, ge=1, le=365, description="Número de dias de histórico"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Lista a série histórica de evolução patrimonial diária.
    - Administrador visualiza patrimônio total e decomposição.
    - Membro visualiza apenas parcela de patrimônio conjunto (household).
    """
    cutoff = date.today() - timedelta(days=days)
    stmt = (
        select(WealthSnapshot)
        .options(selectinload(WealthSnapshot.items))
        .where(WealthSnapshot.snapshot_date >= cutoff)
        .order_by(WealthSnapshot.snapshot_date.asc())
    )
    result = await db.execute(stmt)
    snapshots = result.scalars().all()

    response = []
    for s in snapshots:
        items = [
            AssetAllocationItem(
                asset_class_code=i.asset_class_code,
                asset_class_name=i.asset_class_name,
                balance=i.balance,
                percentage=i.percentage,
            )
            for i in s.items
        ]

        if current_user.role == UserRole.ADMIN:
            response.append(
                WealthSnapshotRead(
                    id=s.id,
                    snapshot_date=s.snapshot_date,
                    cash_balance=s.cash_balance,
                    investment_balance=s.investment_balance,
                    credit_card_debt=s.credit_card_debt,
                    net_worth=s.net_worth,
                    household_net_worth=s.household_net_worth,
                    personal_net_worth=s.personal_net_worth,
                    items=items,
                )
            )
        else:
            response.append(
                WealthSnapshotRead(
                    id=s.id,
                    snapshot_date=s.snapshot_date,
                    cash_balance=s.cash_balance,
                    investment_balance=s.investment_balance,
                    credit_card_debt=s.credit_card_debt,
                    net_worth=s.household_net_worth,
                    household_net_worth=s.household_net_worth,
                    personal_net_worth=Decimal("0.00"),
                    items=items,
                )
            )
    return response
