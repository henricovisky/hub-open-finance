import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, FinancialContext, TimestampMixin


class AccountType(str, enum.Enum):
    BANK = "BANK"
    CREDIT = "CREDIT"
    INVESTMENT = "INVESTMENT"
    OTHER = "OTHER"


class TransactionType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    TRANSFER = "TRANSFER"
    REFUND = "REFUND"
    INVESTMENT = "INVESTMENT"
    UNKNOWN = "UNKNOWN"


class TransactionStatus(str, enum.Enum):
    PENDING = "PENDING"
    POSTED = "POSTED"
    CANCELED = "CANCELED"
    DELETED = "DELETED"


class Account(Base, TimestampMixin):
    """Conta bancária, carteira de investimento ou cartão de crédito."""
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("financial_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pluggy_account_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[AccountType] = mapped_column(String(50), nullable=False)
    subtype: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="BRL", nullable=False)
    current_balance: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    available_balance: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    credit_limit: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    owner_context: Mapped[FinancialContext] = mapped_column(
        String(50),
        default=FinancialContext.HOUSEHOLD,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    source_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relacionamentos
    connection = relationship("FinancialConnection", back_populates="accounts")
    card: Mapped[Optional["Card"]] = relationship(
        "Card",
        back_populates="account",
        uselist=False,
        cascade="all, delete-orphan",
    )
    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="account",
        cascade="all, delete-orphan",
    )


class Card(Base, TimestampMixin):
    """Metadados de cartão de crédito vinculado a uma conta do tipo CREDIT."""
    __tablename__ = "cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_four_digits: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)
    closing_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    due_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    limit_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    available_limit: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)

    account: Mapped["Account"] = relationship("Account", back_populates="card")


class Category(Base, TimestampMixin):
    """Categorias financeiras por contexto (Casa / Pessoal)."""
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    context: Mapped[FinancialContext] = mapped_column(String(50), nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )


class Transaction(Base):
    """Movimentação financeira unificada e normalizada."""
    __tablename__ = "transactions"

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
    pluggy_transaction_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="BRL", nullable=False)
    type: Mapped[TransactionType] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[TransactionStatus] = mapped_column(String(50), default=TransactionStatus.POSTED, nullable=False)
    provider_category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    context: Mapped[FinancialContext] = mapped_column(String(50), nullable=False, index=True)
    is_internal_transfer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_ignored_in_analytics: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    counterparty: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    installment_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    installment_total: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    provider_created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    provider_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relacionamentos
    account: Mapped["Account"] = relationship("Account", back_populates="transactions")
    category: Mapped[Optional["Category"]] = relationship("Category")
