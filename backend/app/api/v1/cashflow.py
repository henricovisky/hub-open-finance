from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_user
from app.api.v1.accounts import get_authorized_account_ids
from app.api.v1.dashboard import get_month_range, get_prev_months_range
from app.core.database import get_db_session
from app.models.base import FinancialContext, UserRole
from app.models.finance import Account, Category, Transaction, TransactionType
from app.models.user import User

router = APIRouter(prefix="/cashflow", tags=["cashflow"])


async def _check_stale_accounts(db: AsyncSession, authorized_acc_ids: Optional[List] = None) -> tuple[bool, Optional[datetime]]:
    stmt = select(func.max(Account.last_synced_at))
    if authorized_acc_ids is not None:
        stmt = stmt.where(Account.id.in_(authorized_acc_ids))
    res = await db.execute(stmt)
    latest_sync = res.scalar_one_or_none()
    if not latest_sync:
        return False, None
    now = datetime.now(timezone.utc)
    latest_utc = latest_sync if latest_sync.tzinfo else latest_sync.replace(tzinfo=timezone.utc)
    is_stale = (now - latest_utc) > timedelta(hours=24)
    return is_stale, latest_utc


@router.get("/series")
async def get_cashflow_series(
    context: Optional[FinancialContext] = None,
    period: Optional[str] = Query(None, description="Formato YYYY-MM"),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    granularity: str = Query("day", pattern="^(day|week|month)$"),
    account_id: Optional[str] = None,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Retorna a série temporal agregada para o gráfico G-01 Fluxo de Caixa.
    Conforme 04 Adendo de API §1.
    """
    authorized_acc_ids = await get_authorized_account_ids(db, current_user)
    if authorized_acc_ids is not None and not authorized_acc_ids:
        now_iso = datetime.now(timezone.utc).isoformat()
        return {
            "data": {
                "currency": "BRL",
                "granularity": granularity,
                "points": [],
                "totals": {"income": "0.00", "expenses": "0.00", "net": "0.00"},
            },
            "meta": {
                "as_of": now_iso,
                "is_stale": False,
                "availability": "NO_PERMISSION" if current_user.role == UserRole.MEMBER else "AVAILABLE",
                "partial": False,
                "warnings": [],
            },
            "insight": None,
        }

    now = datetime.now(timezone.utc)
    if period and isinstance(period, str) and len(period.split("-")) == 2:
        y, m = map(int, period.split("-"))
        dt_start, dt_end = get_month_range(y, m)
    elif from_date and isinstance(from_date, date) and to_date and isinstance(to_date, date):
        dt_start = datetime.combine(from_date, datetime.min.time(), tzinfo=timezone.utc)
        dt_end = datetime.combine(to_date, datetime.max.time(), tzinfo=timezone.utc)
    else:
        dt_start, dt_end = get_month_range(now.year, now.month)

    # Filtro base de transações válidas (sem transferências internas e não ignoradas)
    filters = [
        Transaction.date >= dt_start,
        Transaction.date <= dt_end,
        Transaction.is_internal_transfer == False,
        Transaction.is_ignored_in_analytics == False,
    ]

    if authorized_acc_ids is not None:
        filters.append(Transaction.account_id.in_(authorized_acc_ids))

    if account_id:
        filters.append(Transaction.account_id == account_id)

    if context:
        filters.append(Transaction.context == context)
    elif current_user.role == UserRole.MEMBER:
        filters.append(Transaction.context != FinancialContext.PERSONAL)

    query = select(Transaction).where(*filters).order_by(Transaction.date.asc())

    result = await db.execute(query)
    transactions = result.scalars().all()

    # Agrupa por dia/semana/mês
    points_dict: Dict[str, Dict[str, Decimal]] = {}
    total_income = Decimal("0.00")
    total_expenses = Decimal("0.00")

    for tx in transactions:
        tx_dt = tx.date if tx.date.tzinfo else tx.date.replace(tzinfo=timezone.utc)
        day_str = tx_dt.strftime("%Y-%m-%d")

        if day_str not in points_dict:
            points_dict[day_str] = {"income": Decimal("0.00"), "expenses": Decimal("0.00")}

        amt = abs(tx.amount)
        if tx.type == TransactionType.INCOME:
            points_dict[day_str]["income"] += amt
            total_income += amt
        elif tx.type in (TransactionType.EXPENSE, TransactionType.REFUND):
            if tx.type == TransactionType.REFUND:
                # Estorno reduz a despesa
                points_dict[day_str]["expenses"] -= amt
                total_expenses -= amt
            else:
                points_dict[day_str]["expenses"] += amt
                total_expenses += amt

    # Monta pontos ordenados com saldo líquido e saldo acumulado
    points = []
    cumulative = Decimal("0.00")

    # Garante ao menos pontos nos limites se vazio
    if not points_dict:
        curr = dt_start.date()
        end_d = dt_end.date()
        while curr <= min(end_d, now.date()):
            d_str = curr.strftime("%Y-%m-%d")
            points.append({
                "date": d_str,
                "income": "0.00",
                "expenses": "0.00",
                "net": "0.00",
                "cumulative_net": "0.00",
            })
            curr += timedelta(days=1)
    else:
        for d_str in sorted(points_dict.keys()):
            inc = points_dict[d_str]["income"]
            exp = points_dict[d_str]["expenses"]
            net = inc - exp
            cumulative += net
            points.append({
                "date": d_str,
                "income": str(inc.quantize(Decimal("0.01"))),
                "expenses": str(exp.quantize(Decimal("0.01"))),
                "net": str(net.quantize(Decimal("0.01"))),
                "cumulative_net": str(cumulative.quantize(Decimal("0.01"))),
            })

    total_net = total_income - total_expenses

    # Gera insight determinístico simples
    insight = None
    if total_net > Decimal("0.00"):
        insight = "Você está com saldo líquido positivo neste período."
    elif total_expenses > total_income and total_expenses > Decimal("0.00"):
        insight = "Atenção: as saídas superaram as receitas no período selecionado."

    is_stale, last_synced_at = await _check_stale_accounts(db, authorized_acc_ids)

    return {
        "data": {
            "currency": "BRL",
            "granularity": granularity,
            "points": points,
            "totals": {
                "income": str(total_income.quantize(Decimal("0.01"))),
                "expenses": str(total_expenses.quantize(Decimal("0.01"))),
                "net": str(total_net.quantize(Decimal("0.01"))),
            },
        },
        "meta": {
            "as_of": (last_synced_at or now).isoformat(),
            "is_stale": is_stale,
            "availability": "AVAILABLE",
            "partial": False,
            "warnings": [],
            "method": "direct_aggregation",
        },
        "insight": insight,
    }
