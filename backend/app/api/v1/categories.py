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

router = APIRouter(prefix="/categories", tags=["categories"])


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
