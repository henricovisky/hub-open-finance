import uuid
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db_session
from app.core.security import decode_access_token
from app.models.base import UserRole
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    """
    Extrai e valida o token JWT do cabeçalho Authorization ou cookie de sessão.
    Retorna o modelo do usuário autenticado no banco.
    """
    token: Optional[str] = None
    if auth and auth.credentials:
        token = auth.credentials
    elif "access_token" in request.cookies:
        token = request.cookies["access_token"]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(token)
        user_id_str: str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token com formato inválido (sem sub).",
            )
        user_id = uuid.UUID(user_id_str)
    except (jwt.PyJWTError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido ou expirado: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário associado ao token não encontrado.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta de usuário inativa.",
        )

    return user


async def require_user(current_user: User = Depends(get_current_user)) -> User:
    """Exige usuário autenticado e ativo."""
    return current_user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Exige perfil Administrador. Retorna 403 Forbidden se for Membro."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito ao perfil Administrador.",
        )
    return current_user
