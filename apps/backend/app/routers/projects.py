from fastapi import APIRouter, HTTPException, status
from sqlmodel import Session, col, select

from app.auth import CurrentUser
from app.db import SessionDep
from app.models import Project, User
from app.schemas import ProjectCreate, ProjectPublic, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def get_owned_project(project_id: str, user: User, db: Session) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


@router.get("")
def get_projects(user: CurrentUser, db: SessionDep) -> list[ProjectPublic]:
    projects = db.exec(
        select(Project)
        .where(Project.owner_id == user.id)
        .order_by(col(Project.created_at).desc(), col(Project.id).desc())
    ).all()
    return [ProjectPublic.model_validate(project) for project in projects]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreate, user: CurrentUser, db: SessionDep
) -> ProjectPublic:
    project = Project(name=body.name, owner_id=user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectPublic.model_validate(project)


@router.get("/{project_id}")
def get_project(project_id: str, user: CurrentUser, db: SessionDep) -> ProjectPublic:
    project = get_owned_project(project_id, user, db)
    return ProjectPublic.model_validate(project)


@router.patch("/{project_id}")
def update_project(
    project_id: str, body: ProjectUpdate, user: CurrentUser, db: SessionDep
) -> ProjectPublic:
    project = get_owned_project(project_id, user, db)
    project.name = body.name
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectPublic.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, user: CurrentUser, db: SessionDep) -> None:
    project = get_owned_project(project_id, user, db)
    db.delete(project)
    db.commit()
