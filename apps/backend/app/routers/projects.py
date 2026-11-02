from fastapi import APIRouter, HTTPException, status
from sqlmodel import col, select

from app.auth import CurrentUser
from app.db import SessionDep
from app.models import Project
from app.schemas import ProjectCreate, ProjectPublic, ProjectUpdate

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
def create_project(
    body: ProjectCreate, user: CurrentUser, db: SessionDep
) -> ProjectPublic:
    assert user.id is not None
    project = Project(name=body.name, owner_id=user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectPublic.model_validate(project)


@router.get("/{project_id}")
def get_project(project_id: int, user: CurrentUser, db: SessionDep) -> ProjectPublic:
    project = db.get(Project, project_id)
    if project is None or project.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return ProjectPublic.model_validate(project)


@router.patch("/{project_id}")
def update_project(
    project_id: int, body: ProjectUpdate, user: CurrentUser, db: SessionDep
) -> ProjectPublic:
    project = db.get(Project, project_id)
    if project is None or project.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    project.name = body.name
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectPublic.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, user: CurrentUser, db: SessionDep) -> None:
    project = db.get(Project, project_id)
    if project is None or project.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    db.delete(project)
    db.commit()
