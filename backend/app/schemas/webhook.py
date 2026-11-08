from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class WebhookPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: Optional[str] = Field(default=None, alias="id")
    event: str = Field(alias="event")
    item_id: Optional[str] = Field(default=None, alias="itemId")
    data: Optional[Dict[str, Any]] = Field(default_factory=dict)
