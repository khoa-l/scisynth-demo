import os
from collections.abc import Generator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import Engine, event
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.pool import ConnectionPoolEntry
from sqlmodel import Session, create_engine

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///scisynth.db")


@event.listens_for(Engine, "connect")
def enable_foreign_keys(
    dbapi_connection: DBAPIConnection, _record: ConnectionPoolEntry
) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()


engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def get_session() -> Generator[Session]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
