import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.base import FinancialContext
from app.models.finance import AccountType, TransactionStatus, TransactionType


class CardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: Optional[str] = None
    last_four_digits: Optional[str] = None
    closing_day: Optional[int] = None
    due_day: Optional[int] = None
    limit_amount: Optional[Decimal] = None
    available_limit: Optional[Decimal] = None


class AccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    connection_id: uuid.UUID
    pluggy_account_id: str
    name: str
    type: AccountType
    subtype: Optional[str] = None
    currency: str
    current_balance: Optional[Decimal] = None
    available_balance: Optional[Decimal] = None
    credit_limit: Optional[Decimal] = None
    owner_context: FinancialContext
    is_active: bool
    last_synced_at: Optional[datetime] = None
    card: Optional[CardResponse] = None


class AccountUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = Field(default=None, max_length=255)
    owner_context: Optional[FinancialContext] = None
    is_active: Optional[bool] = None


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    account_id: uuid.UUID
    pluggy_transaction_id: str
    date: datetime
    posted_at: Optional[datetime] = None
    description: str
    amount: Decimal
    currency: str
    type: TransactionType
    status: TransactionStatus
    provider_category: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    context: FinancialContext
    is_internal_transfer: bool
    is_ignored_in_analytics: bool
    counterparty: Optional[str] = None
    installment_number: Optional[int] = None
    installment_total: Optional[int] = None


class TransactionListResponse(BaseModel):
    results: List[TransactionResponse]
    total: int
    page: int
    page_size: int
