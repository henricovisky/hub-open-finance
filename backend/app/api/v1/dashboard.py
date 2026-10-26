from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import require_user
from app.api.v1.accounts import get_authorized_account_ids
from app.core.database import get_db_session
from app.models.base import FinancialContext, UserRole
from app.models.connection import ConnectionStatus, FinancialConnection
from app.models.finance import Account, AccountType, Category, Transaction, TransactionType
from app.models.investment import Bill, WealthSnapshot
from app.models.user import User
from app.schemas.dashboard import (
    CategoryExpenseSummaryItem,
    DashboardOverviewResponse,
    MonthlyCashflowItem,
)
from app.services.sync_service import SyncService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def get_month_range(year: int, month: int) -> tuple[datetime, datetime]:
    """Retorna início e fim em datetime UTC para o mês especificado."""
    start = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
    _, last_day = monthrange(year, month)
    end = datetime(year, month, last_day, 23, 59, 59, 999999, tzinfo=timezone.utc)
    return start, end


def get_prev_months_range(year: int, month: int, num_months: int = 3) -> tuple[datetime, datetime]:
    """Retorna o período dos últimos N meses fechados anteriores ao mês atual."""
    current_start = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
    # Fim é o último segundo do mês anterior
    end = current_start - timedelta(microseconds=1)
    
    # Início de N meses atrás
    prev_m = month - num_months
    prev_y = year
    while prev_m <= 0:
        prev_m += 12
        prev_y -= 1
    start = datetime(prev_y, prev_m, 1, 0, 0, 0, tzinfo=timezone.utc)
    return start, end


@router.get("/overview", response_model=DashboardOverviewResponse)
async def get_dashboard_overview(
    context: Optional[FinancialContext] = None,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Retorna os indicadores essenciais do topo da tela mobile:
    - Saldo líquido disponível (contas correntes e poupança)
    - Entradas e saídas do mês corrente vs média móvel dos últimos 3 meses
    - Faturas pendentes de cartão de crédito
    - Patrimônio líquido consolidado
    - Alertas de conectividade (atenção ou conexões defasadas)
    """
    now = datetime.now(timezone.utc)
    today = now.date()

    authorized_ids = await get_authorized_account_ids(db, current_user)
    
    # Membro é estritamente limitado ao contexto HOUSEHOLD
    if current_user.role != UserRole.ADMIN:
        applied_context = "HOUSEHOLD"
    elif context:
        applied_context = context.value
    else:
        applied_context = "ALL"

    # 1. Saldo Líquido Disponível
    acc_filter = [Account.is_active == True, Account.type.in_([AccountType.BANK, AccountType.OTHER])]
    if authorized_ids is not None:
        acc_filter.append(Account.id.in_(authorized_ids))
    if applied_context != "ALL":
        acc_filter.append(Account.owner_context == applied_context)

    acc_stmt = select(Account).where(*acc_filter)
    acc_res = await db.execute(acc_stmt)
    accounts = acc_res.scalars().all()
    liquid_balance = sum((a.current_balance or Decimal("0.00") for a in accounts), Decimal("0.00"))

    # 2. Entradas e Saídas do Mês Corrente
    curr_start, curr_end = get_month_range(now.year, now.month)
    tx_filter = [
        Transaction.date >= curr_start,
        Transaction.date <= curr_end,
        Transaction.is_ignored_in_analytics == False,
        Transaction.is_internal_transfer == False,
    ]
    if authorized_ids is not None:
        tx_filter.append(Transaction.account_id.in_(authorized_ids))
    if applied_context != "ALL":
        tx_filter.append(Transaction.context == applied_context)

    tx_stmt = select(Transaction).where(*tx_filter)
    tx_res = await db.execute(tx_stmt)
    current_txs = tx_res.scalars().all()

    monthly_income = Decimal("0.00")
    monthly_expenses = Decimal("0.00")

    for t in current_txs:
        amt = abs(t.amount)
        if t.type == TransactionType.INCOME:
            monthly_income += amt
        elif t.type == TransactionType.EXPENSE:
            monthly_expenses += amt

    monthly_net = monthly_income - monthly_expenses

    # 3. Médias Móveis dos 3 Meses Anteriores
    prev_start, prev_end = get_prev_months_range(now.year, now.month, num_months=3)
    prev_filter = [
        Transaction.date >= prev_start,
        Transaction.date <= prev_end,
        Transaction.is_ignored_in_analytics == False,
        Transaction.is_internal_transfer == False,
    ]
    if authorized_ids is not None:
        prev_filter.append(Transaction.account_id.in_(authorized_ids))
    if applied_context != "ALL":
        prev_filter.append(Transaction.context == applied_context)

    prev_res = await db.execute(select(Transaction).where(*prev_filter))
    prev_txs = prev_res.scalars().all()

    prev_income_total = Decimal("0.00")
    prev_expenses_total = Decimal("0.00")
    for t in prev_txs:
        amt = abs(t.amount)
        if t.type == TransactionType.INCOME:
            prev_income_total += amt
        elif t.type == TransactionType.EXPENSE:
            prev_expenses_total += amt

    three_month_avg_income = round(prev_income_total / Decimal("3.0"), 2)
    three_month_avg_expenses = round(prev_expenses_total / Decimal("3.0"), 2)

    # 4. Faturas de Cartão Pendentes
    bill_filter = [Bill.status.in_(["OPEN", "CLOSED", "OVERDUE"])]
    if authorized_ids is not None:
        bill_filter.append(Bill.account_id.in_(authorized_ids))

    bill_stmt = select(Bill).options(selectinload(Bill.account)).where(*bill_filter)
    bills = (await db.execute(bill_stmt)).scalars().all()

    pending_bills_amount = Decimal("0.00")
    for b in bills:
        if applied_context != "ALL" and b.account:
            ctx = (b.account.owner_context.value if hasattr(b.account.owner_context, "value") else str(b.account.owner_context)).upper()
            if applied_context not in ctx:
                continue
        tot = b.total_amount or Decimal("0.00")
        paid = b.paid_amount or Decimal("0.00")
        pending_bills_amount += max(Decimal("0.00"), tot - paid)

    # 5. Patrimônio Líquido
    snap_stmt = select(WealthSnapshot).where(WealthSnapshot.snapshot_date == today)
    snapshot = (await db.execute(snap_stmt)).scalar_one_or_none()
    if not snapshot:
        snapshot = await SyncService.generate_daily_wealth_snapshot(db, today)

    if current_user.role == UserRole.ADMIN and applied_context in ("ALL", "PERSONAL"):
        net_worth = snapshot.net_worth if applied_context == "ALL" else snapshot.personal_net_worth
    else:
        net_worth = snapshot.household_net_worth

    # 6. Alertas de Conexão
    conn_res = await db.execute(select(FinancialConnection).where(FinancialConnection.deleted_at.is_(None)))
    connections = conn_res.scalars().all()
    has_attention = any(c.status in (ConnectionStatus.ATTENTION, ConnectionStatus.ACTION_REQUIRED) for c in connections)
    
    def _check_stale(sync_dt: Optional[datetime]) -> bool:
        if not sync_dt:
            return False
        if sync_dt.tzinfo is None:
            sync_dt = sync_dt.replace(tzinfo=timezone.utc)
        return (now - sync_dt) > timedelta(hours=12)

    has_stale = any(_check_stale(c.last_sync_at) for c in connections)

    return DashboardOverviewResponse(
        as_of=now,
        context_applied=applied_context,
        liquid_balance=liquid_balance,
        monthly_income=monthly_income,
        monthly_expenses=monthly_expenses,
        monthly_net=monthly_net,
        pending_bills_amount=pending_bills_amount,
        three_month_avg_income=three_month_avg_income,
        three_month_avg_expenses=three_month_avg_expenses,
        net_worth=net_worth,
        has_attention_connections=has_attention,
        has_stale_connections=has_stale,
    )


@router.get("/cashflow", response_model=List[MonthlyCashflowItem])
async def get_dashboard_cashflow(
    months: int = Query(6, ge=1, le=24, description="Número de meses de histórico"),
    context: Optional[FinancialContext] = None,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Retorna a evolução mensal de receitas, despesas e saldo líquido para gráficos."""
    now = datetime.now(timezone.utc)
    authorized_ids = await get_authorized_account_ids(db, current_user)
    applied_context = "HOUSEHOLD" if current_user.role != UserRole.ADMIN else (context.value if context else "ALL")

    result_items: List[MonthlyCashflowItem] = []

    # Itera pelos últimos N meses
    for i in range(months - 1, -1, -1):
        target_m = now.month - i
        target_y = now.year
        while target_m <= 0:
            target_m += 12
            target_y -= 1

        start_dt, end_dt = get_month_range(target_y, target_m)
        month_label = f"{target_y:04d}-{target_m:02d}"

        tx_filter = [
            Transaction.date >= start_dt,
            Transaction.date <= end_dt,
            Transaction.is_ignored_in_analytics == False,
            Transaction.is_internal_transfer == False,
        ]
        if authorized_ids is not None:
            tx_filter.append(Transaction.account_id.in_(authorized_ids))
        if applied_context != "ALL":
            tx_filter.append(Transaction.context == applied_context)

        tx_stmt = select(Transaction).where(*tx_filter)
        month_txs = (await db.execute(tx_stmt)).scalars().all()

        m_inc = Decimal("0.00")
        m_exp = Decimal("0.00")
        for t in month_txs:
            amt = abs(t.amount)
            if t.type == TransactionType.INCOME:
                m_inc += amt
            elif t.type == TransactionType.EXPENSE:
                m_exp += amt

        result_items.append(
            MonthlyCashflowItem(
                month=month_label,
                income=m_inc,
                expenses=m_exp,
                net=m_inc - m_exp,
            )
        )

    return result_items


@router.get("/categories", response_model=List[CategoryExpenseSummaryItem])
async def get_dashboard_categories(
    context: Optional[FinancialContext] = None,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Retorna despesas do mês corrente agrupadas por categoria,
    com cálculo de representatividade percentual e comparação com a média dos últimos 3 meses.
    """
    now = datetime.now(timezone.utc)
    authorized_ids = await get_authorized_account_ids(db, current_user)
    applied_context = "HOUSEHOLD" if current_user.role != UserRole.ADMIN else (context.value if context else "ALL")

    # Mês corrente
    curr_start, curr_end = get_month_range(now.year, now.month)
    tx_filter = [
        Transaction.date >= curr_start,
        Transaction.date <= curr_end,
        Transaction.type == TransactionType.EXPENSE,
        Transaction.is_ignored_in_analytics == False,
        Transaction.is_internal_transfer == False,
    ]
    if authorized_ids is not None:
        tx_filter.append(Transaction.account_id.in_(authorized_ids))
    if applied_context != "ALL":
        tx_filter.append(Transaction.context == applied_context)

    tx_stmt = select(Transaction).options(selectinload(Transaction.category)).where(*tx_filter)
    curr_txs = (await db.execute(tx_stmt)).scalars().all()

    # Mês anterior (3 meses) para cálculo de média histórica por categoria
    prev_start, prev_end = get_prev_months_range(now.year, now.month, num_months=3)
    prev_filter = [
        Transaction.date >= prev_start,
        Transaction.date <= prev_end,
        Transaction.type == TransactionType.EXPENSE,
        Transaction.is_ignored_in_analytics == False,
        Transaction.is_internal_transfer == False,
    ]
    if authorized_ids is not None:
        prev_filter.append(Transaction.account_id.in_(authorized_ids))
    if applied_context != "ALL":
        prev_filter.append(Transaction.context == applied_context)

    prev_res = await db.execute(select(Transaction).where(*prev_filter))
    prev_txs = prev_res.scalars().all()

    # Agrega 3 meses passados por categoria
    prev_cat_totals: Dict[Optional[str], Decimal] = {}
    for pt in prev_txs:
        cat_key = str(pt.category_id) if pt.category_id else (pt.provider_category or "Sem Categoria")
        prev_cat_totals[cat_key] = prev_cat_totals.get(cat_key, Decimal("0.00")) + abs(pt.amount)

    total_current_expenses = Decimal("0.00")
    cat_items: Dict[str, dict] = {}

    for t in curr_txs:
        amt = abs(t.amount)
        total_current_expenses += amt
        cat_key = str(t.category_id) if t.category_id else (t.provider_category or "Sem Categoria")
        cat_name = t.category.name if t.category else (t.provider_category or "Outras Despesas")
        icon = t.category.icon if t.category else None
        color = t.category.color if t.category else None

        if cat_key not in cat_items:
            cat_items[cat_key] = {
                "category_id": t.category_id,
                "category_name": cat_name,
                "icon": icon,
                "color": color,
                "total_amount": Decimal("0.00"),
            }
        cat_items[cat_key]["total_amount"] += amt

    response: List[CategoryExpenseSummaryItem] = []
    for cat_key, c_info in cat_items.items():
        tot = c_info["total_amount"]
        pct = round((tot / total_current_expenses * 100), 2) if total_current_expenses > 0 else Decimal("0.00")
        hist_total = prev_cat_totals.get(cat_key, Decimal("0.00"))
        avg_3m = round(hist_total / Decimal("3.0"), 2)

        var_pct = None
        if avg_3m > Decimal("0.00"):
            var_pct = round(((tot - avg_3m) / avg_3m * 100), 1)

        response.append(
            CategoryExpenseSummaryItem(
                category_id=c_info["category_id"],
                category_name=c_info["category_name"],
                icon=c_info["icon"],
                color=c_info["color"],
                total_amount=tot,
                percentage=pct,
                three_month_avg=avg_3m,
                variation_vs_avg_pct=var_pct,
            )
        )

    # Ordena por maior gasto
    response.sort(key=lambda x: x.total_amount, reverse=True)
    return response
