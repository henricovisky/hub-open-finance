import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.connection import ConnectionStatus, SyncStatus, SyncTrigger


class ConnectTokenResponse(BaseModel):
    connect_token: str
    expires_in_seconds: int = 1800


class ConnectCompleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    item_id: str = Field(min_length=1, max_length=100)


class ConnectionSyncRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    trigger: SyncTrigger
    status: SyncStatus
    started_at: datetime
    finished_at: Optional[datetime] = None
    records_read: int
    records_inserted: int
    records_updated: int
    error_code: Optional[str] = None
    error_message_safe: Optional[str] = None


class ConnectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: str
    pluggy_item_id: str
    institution_name: str
    connector_id: int
    status: ConnectionStatus
    status_detail: Optional[str] = None
    raw_status: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    last_successful_sync_at: Optional[datetime] = None
    consent_expires_at: Optional[datetime] = None
    created_at: datetime


class ConnectionDetailResponse(ConnectionResponse):
    sync_runs: List[ConnectionSyncRunResponse] = Field(default_factory=list)
