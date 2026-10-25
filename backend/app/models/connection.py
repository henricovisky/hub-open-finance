import enum
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class ConnectionStatus(str, enum.Enum):
    CONNECTED = "CONNECTED"
    SYNCING = "SYNCING"
    ACTION_REQUIRED = "ACTION_REQUIRED"
    ATTENTION = "ATTENTION"
    DISCONNECTED = "DISCONNECTED"
    UNKNOWN = "UNKNOWN"


class SyncTrigger(str, enum.Enum):
    WEBHOOK = "WEBHOOK"
    SCHEDULED = "SCHEDULED"
    MANUAL = "MANUAL"
    INITIAL = "INITIAL"


class SyncStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


def map_pluggy_status_to_internal(pluggy_status: str) -> ConnectionStatus:
    """Mapeia os estados brutos da Pluggy para os estados normalizados internos."""
    status_upper = (pluggy_status or "").upper()
    if status_upper in ("UPDATED", "COMPLETED"):
        return ConnectionStatus.CONNECTED
    if status_upper in ("UPDATING", "CREATING"):
        return ConnectionStatus.SYNCING
    if status_upper in ("WAITING_USER_INPUT", "WAITING_USER_ACTION"):
        return ConnectionStatus.ACTION_REQUIRED
    if status_upper in ("LOGIN_ERROR", "OUTDATED", "ERROR"):
        return ConnectionStatus.ATTENTION
    if status_upper in ("DELETED",):
        return ConnectionStatus.DISCONNECTED
    return ConnectionStatus.UNKNOWN


class FinancialConnection(Base, TimestampMixin):
    """Representa uma instituição financeira conectada (Item da Pluggy)."""
    __tablename__ = "financial_connections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    provider: Mapped[str] = mapped_column(String(50), default="PLUGGY", nullable=False)
    pluggy_item_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    institution_name: Mapped[str] = mapped_column(String(255), nullable=False)
    connector_id: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ConnectionStatus] = mapped_column(
        String(50),
        default=ConnectionStatus.UNKNOWN,
        nullable=False,
    )
    status_detail: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    raw_status: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    consent_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_successful_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relacionamentos
    owner = relationship("User")
    sync_runs: Mapped[List["ConnectionSyncRun"]] = relationship(
        "ConnectionSyncRun",
        back_populates="connection",
        cascade="all, delete-orphan",
        order_by="desc(ConnectionSyncRun.started_at)",
    )
    accounts = relationship(
        "Account",
        back_populates="connection",
        cascade="all, delete-orphan",
    )


class ConnectionSyncRun(Base):
    """Histórico de cada execução de sincronização por conexão."""
    __tablename__ = "connection_sync_runs"

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
    trigger: Mapped[SyncTrigger] = mapped_column(String(50), nullable=False)
    status: Mapped[SyncStatus] = mapped_column(String(50), default=SyncStatus.PENDING, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    records_read: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_inserted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_updated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    error_message_safe: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    connection: Mapped["FinancialConnection"] = relationship("FinancialConnection", back_populates="sync_runs")
