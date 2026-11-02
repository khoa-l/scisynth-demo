import hashlib
import secrets
from datetime import timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Response, status
from fastapi.security import APIKeyCookie
from pwdlib import PasswordHash
from sqlmodel import Session, select

from app.db import SessionDep
from app.models import User, UserSession, utcnow

SESSION_COOKIE = "session"
SESSION_TTL = timedelta(days=14)
COOKIE_SECURE = False

password_hash = PasswordHash.recommended()
DUMMY_HASH = password_hash.hash("dummypassword")

session_cookie = APIKeyCookie(name=SESSION_COOKIE, auto_error=False)
SessionToken = Annotated[str | None, Depends(session_cookie)]


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.exec(select(User).where(User.email == email)).first()


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if user is None:
        password_hash.verify(password, DUMMY_HASH)
        return None
    if not password_hash.verify(password, user.password_hash):
        return None
    return user


def start_session(db: Session, response: Response, user: User) -> None:
    token = secrets.token_urlsafe(32)
    db.add(
        UserSession(
            token_hash=hash_token(token),
            user_id=user.id,
            expires_at=utcnow() + SESSION_TTL,
        )
    )
    db.commit()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )


def end_session(db: Session, response: Response, token: str | None) -> None:
    if token:
        user_session = db.get(UserSession, hash_token(token))
        if user_session:
            db.delete(user_session)
            db.commit()
    response.delete_cookie(
        SESSION_COOKIE, httponly=True, secure=COOKIE_SECURE, samesite="lax"
    )


def get_current_user(db: SessionDep, token: SessionToken) -> User:
    if token:
        user = db.exec(
            select(User)
            .join(UserSession)
            .where(
                UserSession.token_hash == hash_token(token),
                UserSession.expires_at > utcnow(),
            )
        ).first()
        if user:
            return user
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")


CurrentUser = Annotated[User, Depends(get_current_user)]
