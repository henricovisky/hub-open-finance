import logging
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import select
from app.core.database import engine, async_session_factory
from app.core.security import hash_password
from app.models.base import Base, UserRole, FinancialContext
import app.models  # Garante registro de todas as tabelas
from app.models.user import User
from app.models.investment import AssetClass
from app.models.finance import Category

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

DEFAULT_SPREADSHEET_CATEGORIES = [
    # Despesas Essenciais (Planilha Orçamento 2026)
    {
        "name": "🏠 Moradia",
        "icon": "home",
        "color": "#3B82F6",
        "is_essential": True,
        "budget_amount": Decimal("1812.00"),
        "included_items": "Aluguel/Financ., Condomínio, IPTU",
    },
    {
        "name": "⚡ Contas Fixas",
        "icon": "zap",
        "color": "#F59E0B",
        "is_essential": True,
        "budget_amount": Decimal("240.00"),
        "included_items": "Luz, Água, Gás",
    },
    {
        "name": "🛒 Alimentação",
        "icon": "shopping-cart",
        "color": "#10B981",
        "is_essential": True,
        "budget_amount": Decimal("500.00"),
        "included_items": "Supermercado, Padaria/Feira",
    },
    {
        "name": "🚗 Transporte",
        "icon": "car",
        "color": "#6366F1",
        "is_essential": True,
        "budget_amount": Decimal("200.00"),
        "included_items": "Combustível, Gastos c/ Veículo, IPVA",
    },
    {
        "name": "🌐 Conectividade",
        "icon": "wifi",
        "color": "#06B6D4",
        "is_essential": True,
        "budget_amount": Decimal("90.00"),
        "included_items": "Internet, Telefonia/Celular",
    },
    {
        "name": "🩺 Saúde & Cuidados",
        "icon": "heart-pulse",
        "color": "#EC4899",
        "is_essential": True,
        "budget_amount": Decimal("300.00"),
        "included_items": "Farmácia, Natação/Academia",
    },
    {
        "name": "🎓 Educação",
        "icon": "graduation-cap",
        "color": "#8B5CF6",
        "is_essential": True,
        "budget_amount": Decimal("0.00"),
        "included_items": "Cursos, e outros",
    },
    # Despesas Não Essenciais
    {
        "name": "🍿 Lazer & Assinaturas",
        "icon": "film",
        "color": "#F43F5E",
        "is_essential": False,
        "budget_amount": Decimal("200.00"),
        "included_items": "Saídas/Cinema, Netflix/Amazon",
    },
    {
        "name": "💳 Cartão de crédito",
        "icon": "credit-card",
        "color": "#84CC16",
        "is_essential": False,
        "budget_amount": Decimal("200.00"),
        "included_items": "Fatura do cartão de crédito",
    },
    {
        "name": "❓ Outros",
        "icon": "help-circle",
        "color": "#64748B",
        "is_essential": False,
        "budget_amount": Decimal("0.00"),
        "included_items": "Tarifas, Imprevistos, Animais",
    },
    # Renda / Entradas
    {
        "name": "💼 Salário",
        "icon": "briefcase",
        "color": "#10B981",
        "is_essential": False,
        "budget_amount": Decimal("0.00"),
        "included_items": "Salário Líquido",
    },
    {
        "name": "💵 Outras Entradas",
        "icon": "dollar-sign",
        "color": "#14B8A6",
        "is_essential": False,
        "budget_amount": Decimal("0.00"),
        "included_items": "Aluguel, Aulas, Rendimentos, Bônus",
    },
]


async def init_db() -> None:
    """
    Inicializa o esquema do banco de dados e popula exclusivamente
    as tabelas estruturais essenciais (tabelas, usuários admin, classes de ativos
    e categorias baseadas na planilha Google Sheets pessoal do usuário).
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
                name="Henrique Miranda",
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

        # Categorias da Planilha Orçamento 2026
        cat_stmt = select(Category)
        cat_result = await session.execute(cat_stmt)
        existing_cats = {c.name: c for c in cat_result.scalars().all()}

        for cat_def in DEFAULT_SPREADSHEET_CATEGORIES:
            cat_name = cat_def["name"]
            if cat_name not in existing_cats:
                category = Category(
                    id=uuid.uuid4(),
                    name=cat_name,
                    context=FinancialContext.HOUSEHOLD,
                    icon=cat_def["icon"],
                    color=cat_def["color"],
                    budget_amount=cat_def["budget_amount"],
                    is_essential=cat_def["is_essential"],
                    included_items=cat_def["included_items"],
                )
                session.add(category)
                logger.info(f"Categoria criada: {cat_name}")
            else:
                # Atualiza metadados de orçamento se necessário
                cat = existing_cats[cat_name]
                cat.budget_amount = cat_def["budget_amount"]
                cat.is_essential = cat_def["is_essential"]
                cat.included_items = cat_def["included_items"]

        await session.commit()
