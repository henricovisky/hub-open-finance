from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Generic, List, Optional, TypeVar
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class PluggyBaseSchema(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class PluggyConnector(PluggyBaseSchema):
    id: int
    name: str
    primary_color: Optional[str] = Field(default=None, alias="primaryColor")
    institution_url: Optional[str] = Field(default=None, alias="institutionUrl")
    type: Optional[str] = None
    country: Optional[str] = None
    is_sandbox: Optional[bool] = Field(default=False, alias="isSandbox")


class PluggyItem(PluggyBaseSchema):
    id: str
    status: str
    status_detail: Optional[str] = Field(default=None, alias="statusDetail")
    execution_status: Optional[str] = Field(default=None, alias="executionStatus")
    connector: Optional[PluggyConnector] = None
    client_user_id: Optional[str] = Field(default=None, alias="clientUserId")
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, alias="updatedAt")
    last_updated_at: Optional[datetime] = Field(default=None, alias="lastUpdatedAt")
    consent_expires_at: Optional[datetime] = Field(default=None, alias="consentExpiresAt")
    error: Optional[Dict[str, Any]] = None


class PluggyAccount(PluggyBaseSchema):
    id: str
    item_id: Optional[str] = Field(default=None, alias="itemId")
    type: str  # BANK, CREDIT, etc.
    subtype: Optional[str] = None
    name: str
    balance: Optional[Decimal] = None
    currency_code: str = Field(default="BRL", alias="currencyCode")
    number: Optional[str] = None
    credit_data: Optional[Dict[str, Any]] = Field(default=None, alias="creditData")


class PluggyTransaction(PluggyBaseSchema):
    id: str
    account_id: Optional[str] = Field(default=None, alias="accountId")
    description: str
    description_raw: Optional[str] = Field(default=None, alias="descriptionRaw")
    amount: Decimal
    currency_code: str = Field(default="BRL", alias="currencyCode")
    date: datetime
    type: Optional[str] = None  # DEBIT, CREDIT
    status: Optional[str] = None  # POSTED, PENDING
    category: Optional[str] = None
    provider_category_id: Optional[str] = Field(default=None, alias="categoryId")
    payment_data: Optional[Dict[str, Any]] = Field(default=None, alias="paymentData")
    credit_card_metadata: Optional[Dict[str, Any]] = Field(default=None, alias="creditCardMetadata")


class PluggyBill(PluggyBaseSchema):
    id: str
    due_date: datetime = Field(alias="dueDate")
    closing_date: Optional[datetime] = Field(default=None, alias="closingDate")
    total_amount: Decimal = Field(alias="totalAmount")
    paid_amount: Optional[Decimal] = Field(default=None, alias="paidAmount")
    open_amount: Optional[Decimal] = Field(default=None, alias="openAmount")
    status: Optional[str] = None
    account_id: Optional[str] = Field(default=None, alias="accountId")


class PluggyInvestment(PluggyBaseSchema):
    id: str
    name: str
    code: Optional[str] = None
    isin: Optional[str] = None
    type: str
    subtype: Optional[str] = None
    balance: Optional[Decimal] = None
    currency_code: str = Field(default="BRL", alias="currencyCode")
    value: Optional[Decimal] = None
    quantity: Optional[Decimal] = None
    amount: Optional[Decimal] = None
    due_date: Optional[datetime] = Field(default=None, alias="dueDate")
    item_id: Optional[str] = Field(default=None, alias="itemId")


class PluggyConnectToken(PluggyBaseSchema):
    connect_token: str = Field(alias="accessToken")


class PluggyPage(PluggyBaseSchema, Generic[T]):
    results: List[T] = Field(default_factory=list)
    page: Optional[int] = 1
    total: Optional[int] = 0
    total_pages: Optional[int] = Field(default=1, alias="totalPages")


class PluggyV2TransactionPage(PluggyBaseSchema):
    results: List[PluggyTransaction] = Field(default_factory=list)
    next: Optional[str] = None
