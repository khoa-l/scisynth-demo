"""drop group size

Revision ID: f18a0b4de562
Revises: 0fbdc63d9a8b
Create Date: 2026-11-08 23:42:09.654896

"""

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f18a0b4de562"
down_revision: str | Sequence[str] | None = "0fbdc63d9a8b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    for table in ("dataset", "saved_group"):
        rows = connection.execute(sa.text(f"SELECT id, content FROM {table}"))
        for row_id, raw in rows.all():
            content = json.loads(raw)
            groups = content.get("groups", [])
            if not any("width" in group or "height" in group for group in groups):
                continue
            for group in groups:
                group.pop("width", None)
                group.pop("height", None)
            connection.execute(
                sa.text(f"UPDATE {table} SET content = :content WHERE id = :id"),
                {"content": json.dumps(content), "id": row_id},
            )


def downgrade() -> None:
    """Downgrade schema."""
