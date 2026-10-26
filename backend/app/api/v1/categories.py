import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import require_admin, require_user
from app.core.database import get_db_session
from app.models.base import FinancialContext, UserRole
from app.models.finance import Category
from app.models.user import User
from app.schemas.finance import CategoryCreate, CategoryResponse

from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import func
from app.api.v1.accounts import get_authorized_account_ids
from app.api.v1.dashboard import get_month_range, get_prev_months_range
from app.models.finance import Transaction, TransactionType

router = APIRouter(prefix="/categories", tags=["categories"])


# Mapeamento amigável pt-BR para categorias da Pluggy
CATEGORY_TRANSLATIONS = {
    "Shopping": "Compras & Varejo",
    "Transfers": "Transferências",
    "Groceries": "Supermercado & Alimentação",
    "Transfer - PIX": "Transferência PIX",
    "Same person transfer": "Transferência Mesma Titularidade",
    "Investments": "Investimentos",
    "Proceeds interests and dividends": "Rendimentos & Dividendos",
    "Eating out": "Restaurantes & Bares",
    "Pharmacy": "Farmácia & Saúde",
    "Clothing": "Vestuário & Moda",
    "Fixed income": "Renda Fixa",
    "Taxi and ride-hailing": "Transporte por Aplicativo",
    "Credit card payment": "Pagamento de Fatura",
    "Telecommunications": "Telefonia & Internet",
    "Services": "Serviços Gerais",
    "Gas stations": "Combustível",
    "Automotive": "Automotivo",
    "Vehicle maintenance": "Manutenção Veicular",
    "Houseware": "Casa & Utilidades",
    "Bookstore": "Livraria & Papelaria",
    "Taxes on investments": "Impostos s/ Investimentos",
    "School": "Educação & Escola",
    "Parking": "Estacionamento",
    "Digital services": "Serviços Digitais",
    "Video streaming": "Streaming & Assinaturas",
    "Water": "Água & Saneamento",
    "Salary": "Salário & Remuneração",
    "Online shopping": "Compras Online",
    "Financing": "Financiamentos",
    "Electricity": "Energia Elétrica",
    "Dentist": "Dentista & Saúde",
    "Travel": "Viagens & Hospedagem",
    "Pet supplies and vet": "Pets & Veterinário",
    "Loans and financing": "Empréstimos & Financiamento",
    "Income taxes": "Imposto de Renda",
    "Gyms and fitness centers": "Academia & Esportes",
    "Transfer - TED": "Transferência TED",
    "Tickets": "Ingressos & Eventos",
    "Housing": "Moradia",
    "Gambling": "Apostas & Jogos",
    "Electronics": "Eletrônicos & Informática",
    "Food delivery": "Delivery & Comida",
    "Internet": "Internet",
}


@router.get("/summary")
async def get_categories_summary(
    context: Optional[FinancialContext] = None,
    period: Optional[str] = Query(None, description="Formato YYYY-MM"),
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Retorna o resumo de gastos por categoria comparando com a média dos últimos 3 meses (G-05).
    Conforme 04 Adendo de API §1.
    """
    authorized_acc_ids = await get_authorized_account_ids(db, current_user)
    if authorized_acc_ids is not None and not authorized_acc_ids:
        return []

    now = datetime.now(timezone.utc)
    if period and isinstance(period, str) and len(period.split("-")) == 2:
        y, m = map(int, period.split("-"))
    else:
        y, m = now.year, now.month

    cur_start, cur_end = get_month_range(y, m)
    prev_start, prev_end = get_prev_months_range(y, m, num_months=3)

    # Filtros base
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

    if context:
        cur_filters.append(Transaction.context == context)
        prev_filters.append(Transaction.context == context)
    elif current_user.role == UserRole.MEMBER:
        cur_filters.append(Transaction.context != FinancialContext.PERSONAL)
        prev_filters.append(Transaction.context != FinancialContext.PERSONAL)

    # 1. Gastos do período corrente agrupados por provider_category
    cur_query = (
        select(
            func.coalesce(Transaction.provider_category, "Outros").label("cat_name"),
            func.sum(func.abs(Transaction.amount)).label("total_spent"),
        )
        .where(*cur_filters)
        .group_by(func.coalesce(Transaction.provider_category, "Outros"))
    )
    cur_res = await db.execute(cur_query)
    cur_by_cat = {row[0]: Decimal(str(row[1])) for row in cur_res.all() if row[1] is not None}

    # 2. Gastos dos 3 meses anteriores para cálculo da média móvel
    prev_query = (
        select(
            func.coalesce(Transaction.provider_category, "Outros").label("cat_name"),
            func.sum(func.abs(Transaction.amount)).label("total_spent_3m"),
        )
        .where(*prev_filters)
        .group_by(func.coalesce(Transaction.provider_category, "Outros"))
    )
    prev_res = await db.execute(prev_query)
    prev_by_cat = {row[0]: (Decimal(str(row[1])) / Decimal("3.0")) for row in prev_res.all() if row[1] is not None}

    all_cat_names = set(cur_by_cat.keys()) | set(prev_by_cat.keys())
    summary = []

    for raw_name in all_cat_names:
        cur_val = cur_by_cat.get(raw_name, Decimal("0.00"))
        avg_val = prev_by_cat.get(raw_name, Decimal("0.00"))

        diff_pct = None
        status_label = "IN_LINE"

        if avg_val > Decimal("0.00"):
            diff_pct = float(((cur_val - avg_val) / avg_val) * Decimal("100.0"))
            if diff_pct > 15.0:
                status_label = "ABOVE_AVG"
            elif diff_pct < -15.0:
                status_label = "BELOW_AVG"
        elif cur_val > Decimal("0.00"):
            status_label = "INSUFFICIENT_HISTORY"

        if cur_val > Decimal("0.00") or avg_val > Decimal("0.00"):
            friendly_name = CATEGORY_TRANSLATIONS.get(raw_name, raw_name)
            summary.append({
                "id": raw_name,
                "name": friendly_name,
                "current_amount": str(cur_val.quantize(Decimal("0.01"))),
                "average_3m": str(avg_val.quantize(Decimal("0.01"))) if avg_val > 0 else None,
                "difference_percent": round(diff_pct, 1) if diff_pct is not None else None,
                "status": status_label,
            })

    # Ordena por maior gasto atual
    summary.sort(key=lambda x: Decimal(x["current_amount"]), reverse=True)
    return summary


@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    context: Optional[FinancialContext] = None,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Lista categorias de despesas e receitas.
    - Membro visualiza apenas categorias do contexto HOUSEHOLD.
    - Administrador visualiza todas ou filtra por contexto.
    """
    stmt = select(Category).order_by(Category.name.asc())

    if current_user.role != UserRole.ADMIN:
        stmt = stmt.where(Category.context == FinancialContext.HOUSEHOLD)
    elif context:
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
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryResponse.model_validate(cat)
