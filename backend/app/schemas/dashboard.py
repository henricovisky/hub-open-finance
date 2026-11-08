import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.models.base import FinancialContext


class DashboardOverviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    as_of: datetime
    context_applied: str  # HOUSEHOLD, PERSONAL, ou ALL
    liquid_balance: Decimal
    monthly_income: Decimal
    monthly_expenses: Decimal
    monthly_net: Decimal
    pending_bills_amount: Decimal
    three_month_avg_income: Decimal
    three_month_avg_expenses: Decimal
    net_worth: Decimal
    has_attention_connections: bool
    has_stale_connections: bool
    total_budget: Optional[Decimal] = Decimal("0.00")
    total_budget_diff: Optional[Decimal] = Decimal("0.00")
    essential_spent: Optional[Decimal] = Decimal("0.00")
    non_essential_spent: Optional[Decimal] = Decimal("0.00")
    account_name: Optional[str] = None


class MonthlyCashflowItem(BaseModel):
    month: str  # "YYYY-MM"
    income: Decimal
    expenses: Decimal
    net: Decimal
    three_month_avg_expenses: Optional[Decimal] = None


class CategoryExpenseSummaryItem(BaseModel):
    category_id: Optional[uuid.UUID] = None
    category_name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    is_essential: bool = True
    included_items: Optional[str] = None
    budget_amount: Decimal = Decimal("0.00")
    total_amount: Decimal = Decimal("0.00")
    difference: Decimal = Decimal("0.00")
    percentage_budget: Decimal = Decimal("0.00")
    percentage: Decimal = Decimal("0.00")
    three_month_avg: Decimal = Decimal("0.00")
    variation_vs_avg_pct: Optional[Decimal] = None
