import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import get_current_user
from app.core.database import get_db_session
from app.models.base import UserRole
from app.models.finance import Account
from app.models.investment import AssetClass, Investment
from app.models.user import AccountPermission, User
from app.schemas.investment import InvestmentRead

router = APIRouter(prefix="/investments", tags=["investments"])


@router.get("", response_model=List[InvestmentRead])
async def list_investments(
    account_id: Optional[uuid.UUID] = Query(None, description="Filtrar por conta de custódia"),
    asset_class_code: Optional[str] = Query(None, alias="asset_class", description="Filtrar por código da classe de ativos"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Lista posições de investimentos em custódia.
    - Administrador visualiza todas as posições.
    - Membro visualiza apenas posições de contas com can_view=True.
    """
    stmt = (
        select(Investment)
        .join(Account)
        .outerjoin(AssetClass)
        .options(selectinload(Investment.account), selectinload(Investment.asset_class))
        .order_by(Investment.balance.desc())
    )

    if current_user.role != UserRole.ADMIN:
        allowed_subquery = (
            select(AccountPermission.account_id)
            .where(
                AccountPermission.user_id == current_user.id,
                AccountPermission.can_view == True,
            )
        )
        stmt = stmt.where(Investment.account_id.in_(allowed_subquery))

    if account_id:
        stmt = stmt.where(Investment.account_id == account_id)
    if asset_class_code:
        stmt = stmt.where(AssetClass.code == asset_class_code.upper())

    result = await db.execute(stmt)
    investments = result.scalars().all()

    response = []
    for inv in investments:
        response.append(
            InvestmentRead(
                id=inv.id,
                account_id=inv.account_id,
                pluggy_investment_id=inv.pluggy_investment_id,
                code=inv.code,
                name=inv.name,
                type=inv.type,
                subtype=inv.subtype,
                asset_class_code=inv.asset_class.code if inv.asset_class else None,
                asset_class_name=inv.asset_class.name if inv.asset_class else None,
                balance=inv.balance,
                invested_amount=inv.invested_amount,
                quantity=inv.quantity,
                value=inv.value,
                currency=inv.currency,
                due_date=inv.due_date,
                rate=inv.rate,
                rate_type=inv.rate_type,
                status=inv.status,
                account_name=inv.account.name if inv.account else None,
                owner_context=inv.account.owner_context if inv.account else None,
            )
        )
    return response


@router.get("/portfolio")
async def get_portfolio_allocation(
    context: Optional[str] = Query(None, description="Filtrar por contexto de custódia"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna a alocação atual de investimentos consolidada por classe de ativos (G-16).
    """
    stmt = (
        select(Investment)
        .join(Account)
        .outerjoin(AssetClass)
        .options(selectinload(Investment.account), selectinload(Investment.asset_class))
    )

    if current_user.role != UserRole.ADMIN:
        allowed_subquery = (
            select(AccountPermission.account_id)
            .where(
                AccountPermission.user_id == current_user.id,
                AccountPermission.can_view == True,
            )
        )
        stmt = stmt.where(Investment.account_id.in_(allowed_subquery))

    if context:
        stmt = stmt.where(Account.owner_context == context)

    result = await db.execute(stmt)
    investments = result.scalars().all()

    class_totals: dict[str, float] = {}
    total_val = 0.0

    for inv in investments:
        class_name = inv.asset_class.name if inv.asset_class else (inv.type or "Outros")
        bal = float(inv.balance or 0.0)
        class_totals[class_name] = class_totals.get(class_name, 0.0) + bal
        total_val += bal

    allocation = []
    for name, val in sorted(class_totals.items(), key=lambda x: x[1], reverse=True):
        pct = (val / total_val * 100.0) if total_val > 0 else 0.0
        allocation.append({
            "name": name,
            "currentVal": round(val, 2),
            "current": round(pct, 1),
            "target": round(pct, 1),  # Default target = atual se não customizado
        })

    return allocation


@router.get("/{id}", response_model=InvestmentRead)
async def get_investment(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Obtém detalhes de uma posição de investimento específica."""
    stmt = (
        select(Investment)
        .options(selectinload(Investment.account), selectinload(Investment.asset_class))
        .where(Investment.id == id)
    )
    result = await db.execute(stmt)
    inv = result.scalar_one_or_none()

    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investimento não encontrado.")

    if current_user.role != UserRole.ADMIN:
        perm_stmt = select(AccountPermission).where(
            AccountPermission.user_id == current_user.id,
            AccountPermission.account_id == inv.account_id,
            AccountPermission.can_view == True,
        )
        perm = (await db.execute(perm_stmt)).scalar_one_or_none()
        if not perm:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não autorizado a este investimento.")

    return InvestmentRead(
        id=inv.id,
        account_id=inv.account_id,
        pluggy_investment_id=inv.pluggy_investment_id,
        code=inv.code,
        name=inv.name,
        type=inv.type,
        subtype=inv.subtype,
        asset_class_code=inv.asset_class.code if inv.asset_class else None,
        asset_class_name=inv.asset_class.name if inv.asset_class else None,
        balance=inv.balance,
        invested_amount=inv.invested_amount,
        quantity=inv.quantity,
        value=inv.value,
        currency=inv.currency,
        due_date=inv.due_date,
        rate=inv.rate,
        rate_type=inv.rate_type,
        status=inv.status,
        account_name=inv.account.name if inv.account else None,
        owner_context=inv.account.owner_context if inv.account else None,
    )
