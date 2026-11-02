from fastapi import APIRouter, HTTPException, Response, status

from app.auth import (
    CurrentUser,
    SessionToken,
    authenticate,
    end_session,
    get_user_by_email,
    password_hash,
    start_session,
)
from app.db import SessionDep
from app.models import User
from app.schemas import LoginRequest, RegisterRequest, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: SessionDep, response: Response) -> UserPublic:
    if get_user_by_email(db, body.email):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this email already exists"
        )
    user = User(email=body.email, password_hash=password_hash.hash(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    start_session(db, response, user)
    return UserPublic.model_validate(user)


@router.post("/login")
def login(body: LoginRequest, db: SessionDep, response: Response) -> UserPublic:
    user = authenticate(db, body.email, body.password)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    start_session(db, response, user)
    return UserPublic.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(db: SessionDep, response: Response, token: SessionToken) -> None:
    end_session(db, response, token)


@router.get("/me")
def me(user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(user)
