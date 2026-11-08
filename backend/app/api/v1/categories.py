import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import require_admin, require_user
from app.api.v1.accounts import get_authorized_account_ids
from app.api.v1.dashboard import get_month_range, get_prev_months_range
from app.core.database import get_db_session
from app.models.base import FinancialContext, UserRole
from app.models.finance import Category, Transaction, TransactionType
from app.models.user import User
from app.schemas.finance import CategoryCreate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/summary")
async def get_categories_summary(
    context: Optional[FinancialContext] = None,
    period: Optional[str] = Query(None, description="Formato YYYY-MM"),
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Retorna o resumo comparativo de Orçado vs Realizado e variação histórica
    para todas as categorias da planilha pessoal do usuário.
    """
    authorized_acc_ids = await get_authorized_account_ids(db, current_user)
    if authorized_acc_ids is not None and not authorized_acc_ids:
        return []

    now = datetime.now(timezone.utc)
    if period and isinstance(period, str) and len(period.split("-")) == 2:
        try:
            y, m = map(int, period.split("-"))
        except ValueError:
            y, m = now.year, now.month
    else:
        y, m = now.year, now.month

    cur_start, cur_end = get_month_range(y, m)
    prev_start, prev_end = get_prev_months_range(y, m, num_months=3)

    # 1. Busca todas as categorias cadastradas
    cat_stmt = select(Category).order_by(Category.is_essential.desc(), Category.name.asc())
    if current_user.role != UserRole.ADMIN:
        cat_stmt = cat_stmt.where(Category.context == FinancialContext.HOUSEHOLD)
    elif context and context != FinancialContext.CONSOLIDATED:
        cat_stmt = cat_stmt.where(Category.context == context)

    cat_res = await db.execute(cat_stmt)
    all_categories = cat_res.scalars().all()

    # 2. Filtros base de transações
    cur_filters = [
        Transaction.date >= cur_start,
        Transaction.date <= cur_end,
        Transaction.type == TransactionType.EXPENSE,
        Transaction.is_internal_transfer == False,
        Transaction.is_ignored_in_analytics == False,
    ]
    prev_filters = [
        Transaction.date >= prev_start,
        Transaction.date <= prev_end,
        Transaction.type == TransactionType.EXPENSE,
        Transaction.is_internal_transfer == False,
        Transaction.is_ignored_in_analytics == False,
    ]

    if authorized_acc_ids is not None:
        cur_filters.append(Transaction.account_id.in_(authorized_acc_ids))
        prev_filters.append(Transaction.account_id.in_(authorized_acc_ids))

    if context and context != FinancialContext.CONSOLIDATED:
        cur_filters.append(Transaction.context == context)
        prev_filters.append(Transaction.context == context)
    elif current_user.role == UserRole.MEMBER:
        cur_filters.append(Transaction.context != FinancialContext.PERSONAL)
        prev_filters.append(Transaction.context != FinancialContext.PERSONAL)

    # 3. Agrega gastos do período atual por category_id
    cur_query = (
        select(
            Transaction.category_id,
            func.sum(func.abs(Transaction.amount)).label("total_spent"),
        )
        .where(*cur_filters)
        .group_by(Transaction.category_id)
    )
    cur_res = await db.execute(cur_query)
    cur_by_cat = {row[0]: Decimal(str(row[1])) for row in cur_res.all() if row[1] is not None}

    # 4. Agrega gastos dos 3 meses anteriores
    prev_query = (
        select(
            Transaction.category_id,
            func.sum(func.abs(Transaction.amount)).label("total_spent_3m"),
        )
        .where(*prev_filters)
        .group_by(Transaction.category_id)
    )
    prev_res = await db.execute(prev_query)
    prev_by_cat = {row[0]: (Decimal(str(row[1])) / Decimal("3.0")) for row in prev_res.all() if row[1] is not None}

    total_cur_expenses = sum(cur_by_cat.values(), Decimal("0.00"))
    summary = []

    # Se houver despesas sem categoria vinculada, busca a categoria "❓ Outros" para alocação
    outros_cat = next((c for c in all_categories if "Outros" in c.name), None)
    uncategorized_cur = cur_by_cat.get(None, Decimal("0.00"))
    uncategorized_prev = prev_by_cat.get(None, Decimal("0.00"))

    for cat in all_categories:
        # Pula categorias que são de receita no sumário de despesas
        if "Salário" in cat.name or "Entradas" in cat.name:
            continue

        spent = cur_by_cat.get(cat.id, Decimal("0.00"))
        avg_3m = prev_by_cat.get(cat.id, Decimal("0.00"))

        if cat == outros_cat:
            spent += uncategorized_cur
            avg_3m += uncategorized_prev

        budget = cat.budget_amount or Decimal("0.00")
        diff = budget - spent

        pct_budget = round(float((spent / budget) * Decimal("100.0")), 1) if budget > 0 else 0.0
        pct_total = round(float((spent / total_cur_expenses) * Decimal("100.0")), 1) if total_cur_expenses > 0 else 0.0

        diff_pct = None
        status_label = "IN_LINE"
        if avg_3m > Decimal("0.00"):
            diff_pct = float(((spent - avg_3m) / avg_3m) * Decimal("100.0"))
            if diff_pct > 15.0:
                status_label = "ABOVE_AVG"
            elif diff_pct < -15.0:
                status_label = "BELOW_AVG"

        summary.append({
            "id": str(cat.id),
            "name": cat.name,
            "icon": cat.icon,
            "color": cat.color,
            "is_essential": cat.is_essential,
            "included_items": cat.included_items,
            "budget_amount": str(budget.quantize(Decimal("0.01"))),
            "current_amount": str(spent.quantize(Decimal("0.01"))),
            "difference": str(diff.quantize(Decimal("0.01"))),
            "percentage_budget": pct_budget,
            "percentage": pct_total,
            "average_3m": str(avg_3m.quantize(Decimal("0.01"))) if avg_3m > 0 else "0.00",
            "difference_percent": round(diff_pct, 1) if diff_pct is not None else None,
            "status": status_label,
        })

    return summary


@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    context: Optional[FinancialContext] = None,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Lista categorias de despesas e receitas.
    """
    stmt = select(Category).order_by(Category.is_essential.desc(), Category.name.asc())

    if current_user.role != UserRole.ADMIN:
        stmt = stmt.where(Category.context == FinancialContext.HOUSEHOLD)
    elif context and context != FinancialContext.CONSOLIDATED:
        stmt = stmt.where(Category.context == context)

    result = await db.execute(stmt)
    categories = list(result.scalars().all())
    return [CategoryResponse.model_validate(c) for c in categories]


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Cria uma nova categoria para classificação de despesas e receitas."""
    if payload.context == FinancialContext.PERSONAL and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas o Administrador pode criar categorias do contexto Pessoal.",
        )

    cat = Category(
        id=uuid.uuid4(),
        name=payload.name.strip(),
        context=payload.context,
        icon=payload.icon,
        color=payload.color,
        parent_id=payload.parent_id,
        budget_amount=payload.budget_amount or Decimal("0.00"),
        is_essential=payload.is_essential,
        included_items=payload.included_items,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryResponse.model_validate(cat)
