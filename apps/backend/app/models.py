import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(UTC)


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=320)
    password_hash: str
    created_at: datetime = Field(default_factory=utcnow)


class Project(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=200)
    owner_id: int = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    created_at: datetime = Field(default_factory=utcnow)


class Dataset(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=200)
    project_id: uuid.UUID = Field(
        foreign_key="project.id", index=True, ondelete="CASCADE"
    )
    created_at: datetime = Field(default_factory=utcnow)


class Survey(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=200)
    project_id: uuid.UUID = Field(
        foreign_key="project.id", index=True, ondelete="CASCADE"
    )
    created_at: datetime = Field(default_factory=utcnow)


class UserSession(SQLModel, table=True):
    __tablename__ = "user_session"

    token_hash: str = Field(primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    expires_at: datetime
