"""use uuid for dataset and survey id

Revision ID: f44f3e237b82
Revises: fb065f92a668
Create Date: 2026-11-01 23:19:12.554030

"""

import uuid
from collections.abc import Callable, Sequence
from typing import Any

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f44f3e237b82"
down_revision: str | Sequence[str] | None = "fb065f92a668"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


TABLES = ("dataset", "survey")


def rebuild(id_type: sa.types.TypeEngine[Any], new_id: Callable[[int], object]) -> None:
    bind = op.get_bind()
    for name in TABLES:
        rows = [
            dict(row)
            for row in bind.execute(
                sa.text(
                    f"SELECT id, name, project_id, created_at FROM {name}"
                    " ORDER BY created_at, id"
                )
            ).mappings()
        ]

        op.drop_index(op.f(f"ix_{name}_project_id"), table_name=name)
        op.drop_table(name)
        op.create_table(
            name,
            sa.Column("id", id_type, nullable=False),
            sa.Column(
                "name", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False
            ),
            sa.Column("project_id", sa.Uuid(), nullable=False),
            sa.Column(
                "created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False
            ),
            sa.ForeignKeyConstraint(["project_id"], ["project.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f(f"ix_{name}_project_id"), name, ["project_id"], unique=False
        )

        if rows:
            table = sa.table(
                name,
                sa.column("id", id_type),
                sa.column("name", sa.String()),
                sa.column("project_id", sa.String()),
                sa.column("created_at", sa.String()),
            )
            op.bulk_insert(
                table,
                [{**row, "id": new_id(n)} for n, row in enumerate(rows, start=1)],
            )


def upgrade() -> None:
    """Upgrade schema."""
    rebuild(sa.Uuid(), lambda _: uuid.uuid4())


def downgrade() -> None:
    """Downgrade schema."""
    rebuild(sa.Integer(), lambda n: n)
