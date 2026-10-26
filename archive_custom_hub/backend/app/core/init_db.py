import logging
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from app.core.database import engine, async_session_factory
from app.core.security import hash_password
from app.models.base import Base, UserRole
import app.models  # Garante registro de todas as tabelas
from app.models.user import User
from app.models.investment import AssetClass

logger = logging.getLogger(__name__)

DEFAULT_ASSET_CLASSES = [
    {"code": "RENDA_FIXA", "name": "Renda Fixa (CDB, LCI, LCA, Tesouro Direto, Debêntures)"},
    {"code": "RENDA_VARIAVEL", "name": "Ações e ETFs Nacionais"},
    {"code": "FII", "name": "Fundos Imobiliários (FIIs)"},
    {"code": "FUNDO", "name": "Fundos de Investimento (Multimercado, Renda Fixa, Ações)"},
    {"code": "INTERNACIONAL", "name": "Internacional (BDRs, Ativos Globais)"},
    {"code": "CRIPTO", "name": "Criptoativos"},
    {"code": "PREVIDENCIA", "name": "Previdência Privada (PGBL / VGBL)"},
    {"code": "OUTROS", "name": "Outros Ativos / Alternativos"},
]


async def init_db() -> None:
    """
    Inicializa o esquema do banco de dados e popula exclusivamente
    as tabelas estruturais essenciais (tabelas, usuários admin e classes de ativos).
    Nenhum dado financeiro simulado ou falso é inserido.
    """
    # 1. Cria todas as tabelas se não existirem
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2. Inicializa dados estruturais
    async with async_session_factory() as session:
        # Usuário Admin
        admin_stmt = select(User).where(User.role == UserRole.ADMIN)
        admin_result = await session.execute(admin_stmt)
        if not admin_result.scalars().first():
            admin_user = User(
                name="Administrador Titular",
                email="admin@exemplo.com",
                password_hash=hash_password("AdminPass123!Secure"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            session.add(admin_user)
            logger.info("Usuário inicial ADMIN criado: admin@exemplo.com")

        # Usuário Member
        member_stmt = select(User).where(User.role == UserRole.MEMBER)
        member_result = await session.execute(member_stmt)
        if not member_result.scalars().first():
            member_user = User(
                name="Usuário Membro",
                email="membro@exemplo.com",
                password_hash=hash_password("MemberPass123!Secure"),
                role=UserRole.MEMBER,
                is_active=True,
            )
            session.add(member_user)
            logger.info("Usuário inicial MEMBER criado: membro@exemplo.com")

        # Classes de Ativos Padrão
        ac_stmt = select(AssetClass)
        ac_result = await session.execute(ac_stmt)
        if not ac_result.scalars().first():
            for ac in DEFAULT_ASSET_CLASSES:
                asset_class = AssetClass(
                    id=uuid.uuid4(),
                    code=ac["code"],
                    name=ac["name"],
                    created_at=datetime.now(timezone.utc),
                )
                session.add(asset_class)
            logger.info("Classes de ativos padrão inicializadas.")

        await session.commit()
