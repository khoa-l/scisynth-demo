from datetime import UTC, datetime

from nanoid import generate
from sqlmodel import Field, SQLModel

ID_LENGTH = 21


def utcnow() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return generate(size=ID_LENGTH)


class User(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True, max_length=ID_LENGTH)
    email: str = Field(unique=True, index=True, max_length=320)
    password_hash: str
    created_at: datetime = Field(default_factory=utcnow)


class Project(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True, max_length=ID_LENGTH)
    name: str = Field(max_length=200)
    owner_id: str = Field(
        foreign_key="user.id", index=True, ondelete="CASCADE", max_length=ID_LENGTH
    )
    created_at: datetime = Field(default_factory=utcnow)


class Dataset(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True, max_length=ID_LENGTH)
    name: str = Field(max_length=200)
    project_id: str = Field(
        foreign_key="project.id", index=True, ondelete="CASCADE", max_length=ID_LENGTH
    )
    created_at: datetime = Field(default_factory=utcnow)


class Survey(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True, max_length=ID_LENGTH)
    name: str = Field(max_length=200)
    project_id: str = Field(
        foreign_key="project.id", index=True, ondelete="CASCADE", max_length=ID_LENGTH
    )
    created_at: datetime = Field(default_factory=utcnow)


class UserSession(SQLModel, table=True):
    __tablename__ = "user_session"

    token_hash: str = Field(primary_key=True)
    user_id: str = Field(
        foreign_key="user.id", index=True, ondelete="CASCADE", max_length=ID_LENGTH
    )
    expires_at: datetime
