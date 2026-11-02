from sqlmodel import Session, delete

from app.auth import password_hash
from app.db import engine
from app.models import User, UserSession

SEED_ACCOUNTS = [
    ("user@email.com", "password"),
    ("admin@email.com", "password"),
]


def seed() -> None:
    with Session(engine) as db:
        db.exec(delete(UserSession))
        db.exec(delete(User))
        for email, password in SEED_ACCOUNTS:
            db.add(User(email=email, password_hash=password_hash.hash(password)))
        db.commit()


if __name__ == "__main__":
    seed()
    for email, _ in SEED_ACCOUNTS:
        print(f"Seeded {email}")
