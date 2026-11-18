import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator
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
    is_hidden: bool = False
    last_synced_at: Optional[datetime] = None
    card: Optional[CardResponse] = None


class AccountUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = Field(default=None, max_length=255)
    owner_context: Optional[FinancialContext] = None
    is_active: Optional[bool] = None
    is_hidden: Optional[bool] = None


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


class TransactionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category_id: Optional[uuid.UUID] = None
    context: Optional[FinancialContext] = None
    is_ignored_in_analytics: Optional[bool] = None
    apply_to_similar: Optional[bool] = False


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    context: FinancialContext = FinancialContext.HOUSEHOLD
    icon: Optional[str] = Field(default=None, max_length=50)
    color: Optional[str] = Field(default=None, max_length=20)
    parent_id: Optional[uuid.UUID] = None
    budget_amount: Optional[Decimal] = Decimal("0.00")
    budget_limit: Optional[Decimal] = None
    is_essential: bool = True
    type: Optional[str] = None
    included_items: Optional[str] = Field(default=None, max_length=255)

    @model_validator(mode="before")
    @classmethod
    def handle_aliases_and_defaults(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Normaliza budget_limit -> budget_amount
            if "budget_limit" in data and data["budget_limit"] is not None and "budget_amount" not in data:
                data["budget_amount"] = data["budget_limit"]
            elif "budget_limit" in data and data["budget_limit"] is not None and (data.get("budget_amount") is None or data.get("budget_amount") == Decimal("0.00")):
                data["budget_amount"] = data["budget_limit"]

            # Normaliza type -> is_essential
            if "type" in data and data["type"] is not None:
                t = str(data["type"]).upper()
                if t in ("LIFESTYLE", "NON_ESSENTIAL", "NAO_ESSENCIAL", "OPTIONAL"):
                    data["is_essential"] = False
                elif t in ("ESSENTIAL", "ESSENCIAL"):
                    data["is_essential"] = True
        return data


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    context: FinancialContext
    icon: Optional[str] = None
    color: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    budget_amount: Optional[Decimal] = Decimal("0.00")
    budget_limit: Optional[Decimal] = None
    is_essential: bool = True
    type: Optional[str] = None
    included_items: Optional[str] = None

    @model_validator(mode="after")
    def populate_derived_fields(self) -> "CategoryResponse":
        if self.budget_limit is None:
            self.budget_limit = self.budget_amount
        if self.type is None:
            self.type = "ESSENTIAL" if self.is_essential else "LIFESTYLE"
        return self
