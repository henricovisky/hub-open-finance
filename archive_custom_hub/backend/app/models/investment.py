import enum
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, FinancialContext, TimestampMixin


class BillStatus(str, enum.Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    PAID = "PAID"
    OVERDUE = "OVERDUE"
    OTHER = "OTHER"


class Bill(Base, TimestampMixin):
    """Fatura de cartão de crédito vinculada a uma conta ou cartão."""
    __tablename__ = "bills"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    card_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cards.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pluggy_bill_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    closing_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    paid_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    minimum_payment_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="OPEN", nullable=False, index=True)

    # Relacionamentos
    account = relationship("Account", back_populates="bills")
    card = relationship("Card", back_populates="bills")


class AssetClass(Base):
    """Classes macro de alocação de ativos patrimoniais."""
    __tablename__ = "asset_classes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    investments: Mapped[List["Investment"]] = relationship("Investment", back_populates="asset_class")


class Investment(Base, TimestampMixin):
    """Posição individual de custódia de investimento."""
    __tablename__ = "investments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pluggy_investment_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    subtype: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    asset_class_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("asset_classes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    invested_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    value: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="BRL", nullable=False)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    rate_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False)
    source_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relacionamentos
    account = relationship("Account", back_populates="investments")
    asset_class = relationship("AssetClass", back_populates="investments")
    transactions: Mapped[List["InvestmentTransaction"]] = relationship(
        "InvestmentTransaction",
        back_populates="investment",
        cascade="all, delete-orphan",
    )


class InvestmentTransaction(Base):
    """Operação / movimentação em posição de custódia."""
    __tablename__ = "investment_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    investment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("investments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pluggy_transaction_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True, nullable=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    value: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    investment = relationship("Investment", back_populates="transactions")


class WealthSnapshot(Base):
    """Fotografia diária consolidada do patrimônio líquido familiar e individual."""
    __tablename__ = "wealth_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    snapshot_date: Mapped[date] = mapped_column(Date, unique=True, index=True, nullable=False)
    cash_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    investment_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    credit_card_debt: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    net_worth: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    household_net_worth: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    personal_net_worth: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    items: Mapped[List["WealthSnapshotItem"]] = relationship(
        "WealthSnapshotItem",
        back_populates="snapshot",
        cascade="all, delete-orphan",
    )


class WealthSnapshotItem(Base):
    """Composição de patrimônio por classe de ativo em cada snapshot."""
    __tablename__ = "wealth_snapshot_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    snapshot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("wealth_snapshots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_class_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("asset_classes.id", ondelete="SET NULL"),
        nullable=True,
    )
    asset_class_code: Mapped[str] = mapped_column(String(50), nullable=False)
    asset_class_name: Mapped[str] = mapped_column(String(100), nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    percentage: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)

    snapshot = relationship("WealthSnapshot", back_populates="items")
