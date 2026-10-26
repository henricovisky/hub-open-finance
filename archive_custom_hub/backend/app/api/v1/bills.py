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
from app.models.investment import Bill
from app.models.user import AccountPermission, User
from app.schemas.investment import BillRead

router = APIRouter(prefix="/bills", tags=["bills"])


@router.get("", response_model=List[BillRead])
async def list_bills(
    account_id: Optional[uuid.UUID] = Query(None, description="Filtrar por conta específica"),
    bill_status: Optional[str] = Query(None, alias="status", description="Filtrar por status da fatura (OPEN, CLOSED, PAID)"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Lista faturas de cartão de crédito.
    - Administrador visualiza todas as faturas.
    - Membro visualiza apenas faturas de contas com can_view=True.
    """
    stmt = select(Bill).join(Account).options(selectinload(Bill.account)).order_by(Bill.due_date.desc())

    if current_user.role != UserRole.ADMIN:
        allowed_subquery = (
            select(AccountPermission.account_id)
            .where(
                AccountPermission.user_id == current_user.id,
                AccountPermission.can_view == True,
            )
        )
        stmt = stmt.where(Bill.account_id.in_(allowed_subquery))

    if account_id:
        stmt = stmt.where(Bill.account_id == account_id)
    if bill_status:
        stmt = stmt.where(Bill.status == bill_status.upper())

    result = await db.execute(stmt)
    bills = result.scalars().all()

    response = []
    for b in bills:
        response.append(
            BillRead(
                id=b.id,
                account_id=b.account_id,
                card_id=b.card_id,
                pluggy_bill_id=b.pluggy_bill_id,
                due_date=b.due_date,
                closing_date=b.closing_date,
                total_amount=b.total_amount,
                paid_amount=b.paid_amount,
                minimum_payment_amount=b.minimum_payment_amount,
                status=b.status,
                account_name=b.account.name if b.account else None,
                owner_context=b.account.owner_context if b.account else None,
            )
        )
    return response


@router.get("/{id}", response_model=BillRead)
async def get_bill(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Obtém detalhes de uma fatura de cartão específica."""
    stmt = select(Bill).options(selectinload(Bill.account)).where(Bill.id == id)
    result = await db.execute(stmt)
    bill = result.scalar_one_or_none()

    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fatura não encontrada.")

    if current_user.role != UserRole.ADMIN:
        perm_stmt = select(AccountPermission).where(
            AccountPermission.user_id == current_user.id,
            AccountPermission.account_id == bill.account_id,
            AccountPermission.can_view == True,
        )
        perm = (await db.execute(perm_stmt)).scalar_one_or_none()
        if not perm:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não autorizado a esta fatura.")

    return BillRead(
        id=bill.id,
        account_id=bill.account_id,
        card_id=bill.card_id,
        pluggy_bill_id=bill.pluggy_bill_id,
        due_date=bill.due_date,
        closing_date=bill.closing_date,
        total_amount=bill.total_amount,
        paid_amount=bill.paid_amount,
        minimum_payment_amount=bill.minimum_payment_amount,
        status=bill.status,
        account_name=bill.account.name if bill.account else None,
        owner_context=bill.account.owner_context if bill.account else None,
    )
