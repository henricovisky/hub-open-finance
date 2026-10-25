import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.user import AuditLog, User, UserSession


class AuthService:
    """Serviço de autenticação, rotação segura de sessões e auditoria."""

    @staticmethod
    async def authenticate_user(
        db: AsyncSession,
        email: str,
        password: str,
    ) -> Optional[User]:
        """Verifica credenciais e retorna o usuário ativo autenticado."""
        stmt = select(User).where(User.email == email.lower().strip())
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            return None

        if not verify_password(password, user.password_hash):
            return None

        # Atualiza data do último login
        user.last_login_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def create_session(
        db: AsyncSession,
        user: User,
        device_label: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Cria uma nova sessão com par Access Token (15 min) + Refresh Token rotativo (14 dias).
        O refresh token é armazenado no banco exclusivamente como hash SHA-256.
        """
        now = datetime.now(timezone.utc)
        raw_refresh_token = generate_refresh_token()
        token_hash = hash_refresh_token(raw_refresh_token)
        expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        session = UserSession(
            user_id=user.id,
            refresh_token_hash=token_hash,
            expires_at=expires_at,
            device_label=device_label,
            created_at=now,
        )
        db.add(session)

        # Registro de auditoria
        audit = AuditLog(
            actor_user_id=user.id,
            action="LOGIN_SUCCESS",
            entity_type="USER_SESSION",
            entity_id=str(session.id),
            metadata_safe={"device_label": device_label},
            created_at=now,
        )
        db.add(audit)
        await db.commit()

        # JWT curto com claims essenciais
        claims = {
            "role": user.role.value,
            "email": user.email,
            "name": user.name,
        }
        access_token = create_access_token(subject=str(user.id), claims=claims)
        return access_token, raw_refresh_token

    @staticmethod
    async def rotate_refresh_token(
        db: AsyncSession,
        raw_refresh_token: str,
        device_label: Optional[str] = None,
    ) -> Tuple[str, str, User]:
        """
        Rotaciona o refresh token: revoga o token anterior e emite um novo par de tokens.
        Garante que um refresh token só pode ser utilizado uma única vez.
        """
        token_hash = hash_refresh_token(raw_refresh_token)
        now = datetime.now(timezone.utc)

        stmt = (
            select(UserSession, User)
            .join(User, UserSession.user_id == User.id)
            .where(
                UserSession.refresh_token_hash == token_hash,
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > now,
                User.is_active.is_(True),
            )
        )
        result = await db.execute(stmt)
        row = result.first()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sessão inválida, revogada ou expirada.",
            )

        old_session, user = row

        # Revoga a sessão antiga imediatamente
        old_session.revoked_at = now

        # Cria nova sessão rotacionada
        new_raw_refresh = generate_refresh_token()
        new_token_hash = hash_refresh_token(new_raw_refresh)
        new_session = UserSession(
            user_id=user.id,
            refresh_token_hash=new_token_hash,
            expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            device_label=device_label or old_session.device_label,
            created_at=now,
        )
        db.add(new_session)
        await db.commit()

        claims = {
            "role": user.role.value,
            "email": user.email,
            "name": user.name,
        }
        new_access_token = create_access_token(subject=str(user.id), claims=claims)
        return new_access_token, new_raw_refresh, user

    @staticmethod
    async def revoke_session(
        db: AsyncSession,
        raw_refresh_token: str,
        actor_id: Optional[uuid.UUID] = None,
    ) -> None:
        """Encerra a sessão revogando o refresh token."""
        token_hash = hash_refresh_token(raw_refresh_token)
        now = datetime.now(timezone.utc)

        stmt = select(UserSession).where(
            UserSession.refresh_token_hash == token_hash,
            UserSession.revoked_at.is_(None),
        )
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()

        if session:
            session.revoked_at = now
            audit = AuditLog(
                actor_user_id=actor_id or session.user_id,
                action="LOGOUT",
                entity_type="USER_SESSION",
                entity_id=str(session.id),
                created_at=now,
            )
            db.add(audit)
            await db.commit()
