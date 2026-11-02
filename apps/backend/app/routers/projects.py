from fastapi import APIRouter, status
from sqlmodel import col, select

from app.auth import CurrentUser
from app.db import SessionDep
from app.models import Project
from app.schemas import ProjectPublic

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
def get_projects(user: CurrentUser, db: SessionDep) -> list[ProjectPublic]:
    projects = db.exec(
        select(Project)
        .where(Project.owner_id == user.id)
        .order_by(col(Project.created_at).desc(), col(Project.id).desc())
    ).all()
    return [ProjectPublic.model_validate(project) for project in projects]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(user: CurrentUser, db: SessionDep) -> ProjectPublic:
    assert user.id is not None
    project = Project(name="Untitled project", owner_id=user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectPublic.model_validate(project)
