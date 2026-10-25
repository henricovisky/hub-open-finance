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
    total_amount: Decimal
    percentage: Decimal
    three_month_avg: Decimal
    variation_vs_avg_pct: Optional[Decimal] = None  # Ex: +15.2 (% acima da média)
