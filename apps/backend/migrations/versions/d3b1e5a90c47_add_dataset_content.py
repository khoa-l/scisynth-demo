"""add dataset content

Revision ID: d3b1e5a90c47
Revises: c698fba2c150
Create Date: 2026-11-02 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d3b1e5a90c47"
down_revision: str | Sequence[str] | None = "c698fba2c150"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "dataset",
        sa.Column("content", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("dataset", "content")
