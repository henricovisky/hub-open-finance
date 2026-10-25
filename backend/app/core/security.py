import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from app.core.config import settings

ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=2,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """Gera hash seguro com Argon2id."""
    return ph.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Verifica senha contra hash Argon2id."""
    try:
        return ph.verify(hashed_password, password)
    except VerifyMismatchError:
        return False


def create_access_token(
    subject: str,
    claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Cria JWT de curta duração (15 min por padrão) para autorização rápida."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))

    to_encode = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access",
    }
    if claims:
        to_encode.update(claims)

    return jwt.encode(to_encode, settings.APP_SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodifica e valida o JWT de acesso."""
    return jwt.decode(token, settings.APP_SECRET_KEY, algorithms=[settings.ALGORITHM])


def generate_refresh_token() -> str:
    """Gera um refresh token criptograficamente seguro com 256 bits de entropia."""
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    """Gera hash SHA-256 do refresh token para armazenamento e busca indexada no banco."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
