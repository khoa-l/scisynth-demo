"""drop collapsed from groups

Revision ID: 0fbdc63d9a8b
Revises: f8b664e08662
Create Date: 2026-11-08 22:04:50.424974

"""

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0fbdc63d9a8b"
down_revision: str | Sequence[str] | None = "f8b664e08662"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    datasets = connection.execute(sa.text("SELECT id, content FROM dataset"))
    for dataset_id, raw in datasets.all():
        content = json.loads(raw)
        groups = content.get("groups", [])
        if not any("collapsed" in group for group in groups):
            continue
        for group in groups:
            group.pop("collapsed", None)
        connection.execute(
            sa.text("UPDATE dataset SET content = :content WHERE id = :id"),
            {"content": json.dumps(content), "id": dataset_id},
        )


def downgrade() -> None:
    """Downgrade schema."""
