import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON
from app.models.base import Base, TimestampMixin, UserRole


class User(Base, TimestampMixin):
    """Tabela de usuários do sistema (Admin e Membro)."""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, native_enum=False),
        default=UserRole.MEMBER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relacionamentos
    sessions: Mapped[List["UserSession"]] = relationship(
        "UserSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    account_permissions: Mapped[List["AccountPermission"]] = relationship(
        "AccountPermission",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    feature_permissions: Mapped[List["FeaturePermission"]] = relationship(
        "FeaturePermission",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserSession(Base):
    """Sessões ativas com refresh token rotativo armazenado como hash."""
    __tablename__ = "user_sessions"

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
    refresh_token_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    device_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="sessions")


class AccountPermission(Base):
    """Matriz de visibilidade e categorização por conta."""
    __tablename__ = "account_permissions"
    __table_args__ = (
        UniqueConstraint("user_id", "account_id", name="uq_user_account_permission"),
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
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    can_view: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_categorize: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="account_permissions")


class FeaturePermission(Base):
    """Permissões granulares de funcionalidades por usuário."""
    __tablename__ = "feature_permissions"
    __table_args__ = (
        UniqueConstraint("user_id", "feature_key", name="uq_user_feature_permission"),
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
    feature_key: Mapped[str] = mapped_column(String(100), nullable=False)
    allowed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="feature_permissions")


class AuditLog(Base):
    """Registro seguro de auditoria para ações sensíveis."""
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    metadata_safe: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
