import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import require_admin, require_user
from app.core.database import get_db_session
from app.models.base import FinancialContext, UserRole
from app.models.finance import Account, AccountType
from app.models.user import AccountPermission, User
from app.schemas.finance import AccountResponse, AccountUpdate

router = APIRouter(prefix="/accounts", tags=["accounts"])


async def get_authorized_account_ids(db: AsyncSession, user: User) -> Optional[List[uuid.UUID]]:
    """Retorna a lista de IDs de contas autorizadas para o usuário (ou None para ADMIN com acesso total)."""
    if user.role == UserRole.ADMIN:
        return None  # Total

    stmt = select(AccountPermission.account_id).where(
        AccountPermission.user_id == user.id,
        AccountPermission.can_view.is_(True),
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("", response_model=List[AccountResponse])
async def list_accounts(
    context: Optional[FinancialContext] = None,
    account_type: Optional[AccountType] = None,
    include_inactive: bool = False,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Lista contas bancárias e cartões com isolamento rigoroso por perfil:
    - ADMIN: Acesso a todas as contas.
    - MEMBER: Acesso restrito exclusivamente às contas autorizadas na matriz de visibilidade.
    """
    stmt = select(Account).options(selectinload(Account.card))

    if not include_inactive:
        stmt = stmt.where(Account.is_active.is_(True))

    if context:
        stmt = stmt.where(Account.owner_context == context)

    if account_type:
        stmt = stmt.where(Account.type == account_type)

    authorized_ids = await get_authorized_account_ids(db, current_user)
    if authorized_ids is not None:
        if not authorized_ids:
            return []  # Negado por padrão se não tiver nenhuma conta liberada
        stmt = stmt.where(Account.id.in_(authorized_ids))

    stmt = stmt.order_by(Account.name.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: uuid.UUID,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Consulta detalhes de uma conta específica respeitando o isolamento RBAC."""
    authorized_ids = await get_authorized_account_ids(db, current_user)
    if authorized_ids is not None and account_id not in authorized_ids:
        # Não vaza a existência da conta alheia
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta não encontrada.",
        )

    stmt = select(Account).where(Account.id == account_id).options(selectinload(Account.card))
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta não encontrada.",
        )

    return account


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: uuid.UUID,
    payload: AccountUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Atualiza metadados e contexto da conta (Casa vs Pessoal). Restrito ao ADMIN."""
    stmt = select(Account).where(Account.id == account_id).options(selectinload(Account.card))
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta não encontrada.",
        )

    if payload.name is not None:
        account.name = payload.name
    if payload.owner_context is not None:
        account.owner_context = payload.owner_context
    if payload.is_active is not None:
        account.is_active = payload.is_active

    await db.commit()
    await db.refresh(account)
    return account
