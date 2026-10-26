import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base declarativa padrão para todos os modelos."""
    pass


class TimestampMixin:
    """Mixin que adiciona created_at e updated_at em UTC."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class FinancialContext(str, enum.Enum):
    """
    Contextos atribuídos dinamicamente pelo Administrador na plataforma.
    Nenhuma conta é acoplada fixamente em código.
    """
    HOUSEHOLD = "HOUSEHOLD"
    PERSONAL = "PERSONAL"
    INVESTMENT = "INVESTMENT"
    WORK = "WORK"
    OTHER = "OTHER"


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
