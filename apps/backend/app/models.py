from datetime import UTC, datetime
from typing import Any

from nanoid import generate
from sqlalchemy import JSON, Column, UniqueConstraint, text
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


def json_column() -> Any:
    return Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, server_default=text("'{}'")),
    )


class Survey(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True, max_length=ID_LENGTH)
    name: str = Field(max_length=200)
    project_id: str = Field(
        foreign_key="project.id", index=True, ondelete="CASCADE", max_length=ID_LENGTH
    )
    created_at: datetime = Field(default_factory=utcnow)
    content: dict[str, Any] = json_column()
    public_id: str | None = Field(
        default=None, unique=True, index=True, max_length=ID_LENGTH
    )
    published_version: int | None = None


class SurveyVersion(SQLModel, table=True):
    __tablename__ = "survey_version"
    __table_args__ = (UniqueConstraint("survey_id", "number"),)

    id: str = Field(default_factory=new_id, primary_key=True, max_length=ID_LENGTH)
    survey_id: str = Field(
        foreign_key="survey.id", index=True, ondelete="CASCADE", max_length=ID_LENGTH
    )
    number: int
    content: dict[str, Any] = json_column()
    published_at: datetime = Field(default_factory=utcnow)


class SurveyResponse(SQLModel, table=True):
    __tablename__ = "survey_response"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=ID_LENGTH)
    survey_id: str = Field(
        foreign_key="survey.id", index=True, ondelete="CASCADE", max_length=ID_LENGTH
    )
    version_id: str = Field(
        foreign_key="survey_version.id",
        index=True,
        ondelete="CASCADE",
        max_length=ID_LENGTH,
    )
    submitted_at: datetime = Field(default_factory=utcnow)
    data: dict[str, Any] = json_column()


class UserSession(SQLModel, table=True):
    __tablename__ = "user_session"

    token_hash: str = Field(primary_key=True)
    user_id: str = Field(
        foreign_key="user.id", index=True, ondelete="CASCADE", max_length=ID_LENGTH
    )
    expires_at: datetime
