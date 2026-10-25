"""create_bills_and_investments_tables

Revision ID: 36be2c43f33b
Revises: 
Create Date: 2026-10-25 18:52:21.523162

"""
from typing import Sequence, Union
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa
from app.models.base import Base
import app.models  # Registra todas as entidades no Base.metadata


# revision identifiers, used by Alembic.
revision: str = '36be2c43f33b'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

    # Popula classes de ativos padrão caso a tabela asset_classes esteja vazia
    asset_classes_table = sa.table(
        "asset_classes",
        sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )

    now = datetime.now(timezone.utc)
    for ac in DEFAULT_ASSET_CLASSES:
        # Insere se não existir
        bind.execute(
            sa.text(
                "INSERT INTO asset_classes (id, code, name, created_at) "
                "VALUES (:id, :code, :name, :created_at) "
                "ON CONFLICT (code) DO NOTHING"
            ),
            {
                "id": str(uuid.uuid4()),
                "code": ac["code"],
                "name": ac["name"],
                "created_at": now,
            },
        )


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
