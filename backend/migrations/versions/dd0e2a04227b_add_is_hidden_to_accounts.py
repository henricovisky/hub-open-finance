"""add_is_hidden_to_accounts

Revision ID: dd0e2a04227b
Revises: 36be2c43f33b
Create Date: 2026-11-17 21:37:25.631210

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd0e2a04227b'
down_revision: Union[str, None] = '36be2c43f33b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('accounts', sa.Column('is_hidden', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('accounts', 'is_hidden')
