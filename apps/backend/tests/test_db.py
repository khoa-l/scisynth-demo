from pathlib import Path

from sqlalchemy import text
from sqlmodel import create_engine


def test_connections_use_wal_and_wait_for_locks(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'scisynth.db'}")

    with engine.connect() as connection:
        assert connection.execute(text("PRAGMA journal_mode")).scalar() == "wal"
        assert connection.execute(text("PRAGMA busy_timeout")).scalar() == 5000
        assert connection.execute(text("PRAGMA foreign_keys")).scalar() == 1
