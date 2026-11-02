"""use uuid for project id

Revision ID: fb065f92a668
Revises: 14a7f02cdc36
Create Date: 2026-11-01 22:53:45.152894

"""

import uuid
from collections.abc import Callable, Sequence
from typing import Any

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "fb065f92a668"
down_revision: str | Sequence[str] | None = "14a7f02cdc36"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CHILDREN = ("dataset", "survey")


def create_tables(id_type: sa.types.TypeEngine[Any]) -> None:
    op.create_table(
        "project",
        sa.Column("id", id_type, nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_owner_id"), "project", ["owner_id"], unique=False)
    for name in CHILDREN:
        op.create_table(
            name,
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column(
                "name", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False
            ),
            sa.Column("project_id", id_type, nullable=False),
            sa.Column(
                "created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False
            ),
            sa.ForeignKeyConstraint(["project_id"], ["project.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f(f"ix_{name}_project_id"), name, ["project_id"], unique=False
        )


def drop_tables() -> None:
    for name in CHILDREN:
        op.drop_index(op.f(f"ix_{name}_project_id"), table_name=name)
        op.drop_table(name)
    op.drop_index(op.f("ix_project_owner_id"), table_name="project")
    op.drop_table("project")


def rebuild(id_type: sa.types.TypeEngine[Any], new_id: Callable[[int], object]) -> None:
    bind = op.get_bind()
    projects = [
        dict(row)
        for row in bind.execute(
            sa.text(
                "SELECT id, name, owner_id, created_at FROM project"
                " ORDER BY created_at, id"
            )
        ).mappings()
    ]
    children = {
        name: [
            dict(row)
            for row in bind.execute(
                sa.text(f"SELECT id, name, project_id, created_at FROM {name}")
            ).mappings()
        ]
        for name in CHILDREN
    }

    drop_tables()
    create_tables(id_type)

    ids = {project["id"]: new_id(n) for n, project in enumerate(projects, start=1)}
    project_table = sa.table(
        "project",
        sa.column("id", id_type),
        sa.column("name", sa.String()),
        sa.column("owner_id", sa.Integer()),
        sa.column("created_at", sa.String()),
    )
    if projects:
        op.bulk_insert(
            project_table,
            [{**project, "id": ids[project["id"]]} for project in projects],
        )
    for name, rows in children.items():
        child_table = sa.table(
            name,
            sa.column("id", sa.Integer()),
            sa.column("name", sa.String()),
            sa.column("project_id", id_type),
            sa.column("created_at", sa.String()),
        )
        if rows:
            op.bulk_insert(
                child_table,
                [{**row, "project_id": ids[row["project_id"]]} for row in rows],
            )


def upgrade() -> None:
    """Upgrade schema."""
    rebuild(sa.Uuid(), lambda _: uuid.uuid4())


def downgrade() -> None:
    """Downgrade schema."""
    rebuild(sa.Integer(), lambda n: n)
