import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.models.base import FinancialContext


class BillRead(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    card_id: Optional[uuid.UUID] = None
    pluggy_bill_id: str
    due_date: datetime
    closing_date: Optional[datetime] = None
    total_amount: Decimal
    paid_amount: Optional[Decimal] = None
    minimum_payment_amount: Optional[Decimal] = None
    status: str
    account_name: Optional[str] = None
    owner_context: Optional[FinancialContext] = None

    model_config = ConfigDict(from_attributes=True)


class InvestmentRead(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    pluggy_investment_id: str
    code: Optional[str] = None
    name: str
    type: str
    subtype: Optional[str] = None
    asset_class_code: Optional[str] = None
    asset_class_name: Optional[str] = None
    balance: Decimal
    invested_amount: Optional[Decimal] = None
    quantity: Optional[Decimal] = None
    value: Optional[Decimal] = None
    currency: str = "BRL"
    due_date: Optional[datetime] = None
    rate: Optional[Decimal] = None
    rate_type: Optional[str] = None
    status: str = "ACTIVE"
    account_name: Optional[str] = None
    owner_context: Optional[FinancialContext] = None

    model_config = ConfigDict(from_attributes=True)


class AssetAllocationItem(BaseModel):
    asset_class_code: str
    asset_class_name: str
    balance: Decimal
    percentage: Decimal

    model_config = ConfigDict(from_attributes=True)


class WealthSummary(BaseModel):
    snapshot_date: date
    cash_balance: Decimal
    investment_balance: Decimal
    credit_card_debt: Decimal
    net_worth: Decimal
    household_net_worth: Decimal
    personal_net_worth: Decimal
    asset_allocation: List[AssetAllocationItem]

    model_config = ConfigDict(from_attributes=True)


class WealthSnapshotRead(BaseModel):
    id: uuid.UUID
    snapshot_date: date
    cash_balance: Decimal
    investment_balance: Decimal
    credit_card_debt: Decimal
    net_worth: Decimal
    household_net_worth: Decimal
    personal_net_worth: Decimal
    items: List[AssetAllocationItem] = []

    model_config = ConfigDict(from_attributes=True)
