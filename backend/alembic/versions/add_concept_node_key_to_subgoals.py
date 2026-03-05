"""add concept_node_key to subgoals

Revision ID: 53bd4d298f00
Revises: 5213cb028722
Create Date: 2026-03-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '53bd4d298f00'
down_revision: Union[str, Sequence[str]] = '5213cb028722'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add concept_node_key column to subgoals table."""
    op.add_column('subgoals', sa.Column('concept_node_key', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Remove concept_node_key column from subgoals table."""
    op.drop_column('subgoals', 'concept_node_key')
