from fastapi import APIRouter, HTTPException, status
from sqlmodel import Session, col, select

from app.auth import CurrentUser
from app.db import SessionDep
from app.models import SavedGroup, User
from app.schemas import SavedGroupCreate, SavedGroupPublic, SavedGroupUpdate

router = APIRouter(prefix="/saved-groups", tags=["saved-groups"])


def get_owned_group(group_id: str, user: User, db: Session) -> SavedGroup:
    group = db.get(SavedGroup, group_id)
    if group is None or group.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Saved group not found")
    return group


@router.get("")
def get_saved_groups(user: CurrentUser, db: SessionDep) -> list[SavedGroupPublic]:
    groups = db.exec(
        select(SavedGroup)
        .where(SavedGroup.owner_id == user.id)
        .order_by(col(SavedGroup.created_at).desc(), col(SavedGroup.id).desc())
    ).all()
    return [SavedGroupPublic.model_validate(group) for group in groups]


@router.post("", status_code=status.HTTP_201_CREATED)
def save_group(
    body: SavedGroupCreate, user: CurrentUser, db: SessionDep
) -> SavedGroupPublic:
    group = SavedGroup(
        name=body.name, owner_id=user.id, content=body.content.model_dump()
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return SavedGroupPublic.model_validate(group)


@router.patch("/{group_id}")
def update_saved_group(
    group_id: str, body: SavedGroupUpdate, user: CurrentUser, db: SessionDep
) -> SavedGroupPublic:
    group = get_owned_group(group_id, user, db)
    group.name = body.name
    db.add(group)
    db.commit()
    db.refresh(group)
    return SavedGroupPublic.model_validate(group)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_group(group_id: str, user: CurrentUser, db: SessionDep) -> None:
    group = get_owned_group(group_id, user, db)
    db.delete(group)
    db.commit()
