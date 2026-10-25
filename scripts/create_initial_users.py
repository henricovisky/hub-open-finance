#!/usr/bin/env python3
"""
Script utilitário para criação/seed seguro de usuários iniciais (ADMIN e MEMBER).
Senhas são hashadas com Argon2id antes de qualquer inserção.
"""

import asyncio
import os
import sys
from pathlib import Path

# Ajusta path para importar módulos do backend
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings
from app.core.security import hash_password
from app.models.base import UserRole
from app.models.user import User


async def create_user_if_not_exists(
    session: AsyncSession,
    name: str,
    email: str,
    password: str,
    role: UserRole,
):
    stmt = select(User).where(User.email == email.lower().strip())
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        print(f"[*] Usuário já existe: {email} ({existing.role.value})")
        return existing

    hashed = hash_password(password)
    user = User(
        name=name,
        email=email.lower().strip(),
        password_hash=hashed,
        role=role,
        is_active=True,
    )
    session.add(user)
    await session.commit()
    print(f"[+] Usuário criado com sucesso: {email} (Papel: {role.value})")
    return user


async def main():
    admin_email = os.getenv("ADMIN_EMAIL", "admin@hubfinanceiro.local")
    admin_password = os.getenv("ADMIN_PASSWORD", "AdminPass123!Secure")
    admin_name = os.getenv("ADMIN_NAME", "Administrador Titular")

    member_email = os.getenv("MEMBER_EMAIL", "membro@hubfinanceiro.local")
    member_password = os.getenv("MEMBER_PASSWORD", "MemberPass123!Secure")
    member_name = os.getenv("MEMBER_NAME", "Usuário Membro")

    engine = create_async_engine(settings.DATABASE_URL)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        print("--- Criando Usuário ADMIN ---")
        await create_user_if_not_exists(session, admin_name, admin_email, admin_password, UserRole.ADMIN)

        print("\n--- Criando Usuário MEMBER ---")
        await create_user_if_not_exists(session, member_name, member_email, member_password, UserRole.MEMBER)

    await engine.dispose()
    print("\n[OK] Seed de usuários concluído com sucesso!")


if __name__ == "__main__":
    asyncio.run(main())
