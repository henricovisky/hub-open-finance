from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(min_length=8)
    device_label: Optional[str] = Field(default=None, max_length=255)


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: Optional[UserResponse] = None
