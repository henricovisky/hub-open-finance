from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import require_user
from app.core.config import settings
from app.core.database import get_db_session
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from app.schemas.user import UserResponse
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Configura cookies seguros HttpOnly para prevenção contra XSS."""
    is_prod = settings.APP_ENV == "production"

    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=is_prod,
        samesite="lax",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        secure=is_prod,
        samesite="lax",
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
):
    """Autentica o usuário com email e senha, iniciando uma sessão rotativa."""
    user = await AuthService.authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token, raw_refresh = await AuthService.create_session(
        db=db,
        user=user,
        device_label=payload.device_label,
    )

    _set_auth_cookies(response, access_token, raw_refresh)

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    payload: Optional[RefreshRequest] = None,
    db: AsyncSession = Depends(get_db_session),
):
    """Rotaciona o refresh token gerando um novo par de tokens válidos."""
    token = None
    if payload and payload.refresh_token:
        token = payload.refresh_token
    elif "refresh_token" in request.cookies:
        token = request.cookies["refresh_token"]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token não fornecido.",
        )

    new_access, new_refresh, _ = await AuthService.rotate_refresh_token(
        db=db,
        raw_refresh_token=token,
    )

    _set_auth_cookies(response, new_access, new_refresh)

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    request: Request,
    response: Response,
    payload: Optional[RefreshRequest] = None,
    db: AsyncSession = Depends(get_db_session),
):
    """Encerra a sessão revogando o refresh token e limpando os cookies."""
    token = None
    if payload and payload.refresh_token:
        token = payload.refresh_token
    elif "refresh_token" in request.cookies:
        token = request.cookies["refresh_token"]

    if token:
        await AuthService.revoke_session(db=db, raw_refresh_token=token)

    response.delete_cookie(key="access_token", samesite="lax")
    response.delete_cookie(key="refresh_token", samesite="lax")
    return {"message": "Sessão encerrada com sucesso."}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(require_user)):
    """Retorna os dados do usuário autenticado e seu perfil (ADMIN / MEMBER)."""
    return current_user
