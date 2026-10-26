import enum
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON
from app.models.base import Base, FinancialContext, TimestampMixin


class GoalStatus(str, enum.Enum):
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    PAUSED = "PAUSED"
    ARCHIVED = "ARCHIVED"


class GoalContributionSource(str, enum.Enum):
    MANUAL = "MANUAL"
    TRANSACTION = "TRANSACTION"


class RecurringStatus(str, enum.Enum):
    SUGGESTED = "SUGGESTED"
    CONFIRMED = "CONFIRMED"
    DISMISSED = "DISMISSED"


class Goal(Base, TimestampMixin):
    """Metas financeiras (ex: reserva de emergência, viagem, compra)."""
    __tablename__ = "goals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    context: Mapped[FinancialContext] = mapped_column(
        String(50),
        default=FinancialContext.HOUSEHOLD,
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    target_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    linked_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[GoalStatus] = mapped_column(
        String(50),
        default=GoalStatus.IN_PROGRESS,
        nullable=False,
    )

    # Relacionamentos
    contributions: Mapped[List["GoalContribution"]] = relationship(
        "GoalContribution",
        back_populates="goal",
        cascade="all, delete-orphan",
    )


class GoalContribution(Base):
    """Aporte realizado em uma meta (manual ou vinculado a uma transação)."""
    __tablename__ = "goal_contributions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("goals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    source: Mapped[GoalContributionSource] = mapped_column(
        String(50),
        default=GoalContributionSource.MANUAL,
        nullable=False,
    )
    transaction_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relacionamento
    goal: Mapped["Goal"] = relationship("Goal", back_populates="contributions")


class RecurringRule(Base, TimestampMixin):
    """Regra de despesa ou receita recorrente (assinatura, salário, aluguel)."""
    __tablename__ = "recurring_rules"

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
    description_pattern: Mapped[str] = mapped_column(String(255), nullable=False)
    expected_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    frequency: Mapped[str] = mapped_column(String(50), default="MONTHLY", nullable=False)
    day_of_month: Mapped[int] = mapped_column(Integer, nullable=False)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    context: Mapped[FinancialContext] = mapped_column(
        String(50),
        default=FinancialContext.HOUSEHOLD,
        nullable=False,
    )
    status: Mapped[RecurringStatus] = mapped_column(
        String(50),
        default=RecurringStatus.SUGGESTED,
        nullable=False,
    )
    confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), default=Decimal("1.0"), nullable=True)
    last_seen_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)


class UserPreference(Base):
    """Preferências do usuário na interface (tema, densidade, ocultar valores)."""
    __tablename__ = "user_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    theme: Mapped[str] = mapped_column(String(20), default="system", nullable=False)
    density: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)
    default_period: Mapped[str] = mapped_column(String(50), default="CURRENT_MONTH", nullable=False)
    hide_values: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    widget_layout: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class CategoryColor(Base):
    """Atribuição de token de cor persistente por categoria."""
    __tablename__ = "category_colors"

    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        primary_key=True,
    )
    color_token: Mapped[str] = mapped_column(String(50), nullable=False)


class InsightState(Base):
    """Registro de insights dispensados pelo usuário."""
    __tablename__ = "insight_states"
    __table_args__ = (
        UniqueConstraint("user_id", "insight_key", name="uq_user_insight_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    insight_key: Mapped[str] = mapped_column(String(100), nullable=False)
    dismissed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
