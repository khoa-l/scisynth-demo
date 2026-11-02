"""use nanoid for ids

Revision ID: a7a18ac8b8c3
Revises: f44f3e237b82
Create Date: 2026-11-01 23:22:56.400469

"""

import uuid
from collections.abc import Callable, Sequence
from typing import Any

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op
from nanoid import generate

# revision identifiers, used by Alembic.
revision: str = "a7a18ac8b8c3"
down_revision: str | Sequence[str] | None = "f44f3e237b82"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


IdType = sa.types.TypeEngine[Any]
NewId = Callable[[int], object]
ITEMS = ("dataset", "survey")


def nanoid_type() -> IdType:
    return sqlmodel.sql.sqltypes.AutoString(length=21)


def read(table: str, columns: str) -> list[dict[str, Any]]:
    rows = op.get_bind().execute(
        sa.text(f'SELECT {columns} FROM "{table}" ORDER BY rowid')
    )
    return [dict(row) for row in rows.mappings()]


def drop_tables() -> None:
    for name in ITEMS:
        op.drop_index(op.f(f"ix_{name}_project_id"), table_name=name)
        op.drop_table(name)
    op.drop_index(op.f("ix_project_owner_id"), table_name="project")
    op.drop_table("project")
    op.drop_index(op.f("ix_user_session_user_id"), table_name="user_session")
    op.drop_table("user_session")
    op.drop_index(op.f("ix_user_email"), table_name="user")
    op.drop_table("user")


def create_tables(user_id: IdType, project_id: IdType, item_id: IdType) -> None:
    op.create_table(
        "user",
        sa.Column("id", user_id, nullable=False),
        sa.Column(
            "email", sqlmodel.sql.sqltypes.AutoString(length=320), nullable=False
        ),
        sa.Column("password_hash", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_email"), "user", ["email"], unique=True)
    op.create_table(
        "user_session",
        sa.Column("token_hash", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("user_id", user_id, nullable=False),
        sa.Column("expires_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_user_session_user_id"), "user_session", ["user_id"], unique=False
    )
    op.create_table(
        "project",
        sa.Column("id", project_id, nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
        sa.Column("owner_id", user_id, nullable=False),
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_owner_id"), "project", ["owner_id"], unique=False)
    for name in ITEMS:
        op.create_table(
            name,
            sa.Column("id", item_id, nullable=False),
            sa.Column(
                "name", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False
            ),
            sa.Column("project_id", project_id, nullable=False),
            sa.Column(
                "created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False
            ),
            sa.ForeignKeyConstraint(["project_id"], ["project.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f(f"ix_{name}_project_id"), name, ["project_id"], unique=False
        )


def insert(table: str, types: dict[str, IdType], rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    columns = [sa.column(key, types.get(key, sa.String())) for key in rows[0]]
    op.bulk_insert(sa.table(table, *columns), rows)


def rebuild(
    user_id: IdType,
    project_id: IdType,
    item_id: IdType,
    new_user_id: NewId,
    new_id: NewId,
) -> None:
    users = read("user", "id, email, password_hash, created_at")
    sessions = read("user_session", "token_hash, user_id, expires_at")
    projects = read("project", "id, name, owner_id, created_at")
    items = {name: read(name, "id, name, project_id, created_at") for name in ITEMS}

    drop_tables()
    create_tables(user_id, project_id, item_id)

    user_ids = {row["id"]: new_user_id(n) for n, row in enumerate(users, start=1)}
    project_ids = {row["id"]: new_id(n) for n, row in enumerate(projects, start=1)}

    insert(
        "user", {"id": user_id}, [{**row, "id": user_ids[row["id"]]} for row in users]
    )
    insert(
        "user_session",
        {"user_id": user_id},
        [{**row, "user_id": user_ids[row["user_id"]]} for row in sessions],
    )
    insert(
        "project",
        {"id": project_id, "owner_id": user_id},
        [
            {**row, "id": project_ids[row["id"]], "owner_id": user_ids[row["owner_id"]]}
            for row in projects
        ],
    )
    for name, rows in items.items():
        insert(
            name,
            {"id": item_id, "project_id": project_id},
            [
                {
                    **row,
                    "id": new_id(n),
                    "project_id": project_ids[row["project_id"]],
                }
                for n, row in enumerate(rows, start=1)
            ],
        )


def upgrade() -> None:
    """Upgrade schema."""
    rebuild(
        nanoid_type(),
        nanoid_type(),
        nanoid_type(),
        lambda _: generate(size=21),
        lambda _: generate(size=21),
    )


def downgrade() -> None:
    """Downgrade schema."""
    rebuild(sa.Integer(), sa.Uuid(), sa.Uuid(), lambda n: n, lambda _: uuid.uuid4())
