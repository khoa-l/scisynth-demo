from fastapi import APIRouter, HTTPException, status
from sqlmodel import Session, col, select

from app.auth import CurrentUser
from app.db import SessionDep
from app.models import Dataset, User
from app.routers.projects import get_owned_project
from app.schemas import DatasetCreate, DatasetPublic, DatasetUpdate

router = APIRouter(prefix="/projects/{project_id}/datasets", tags=["datasets"])


def get_owned_dataset(
    project_id: str, dataset_id: str, user: User, db: Session
) -> Dataset:
    get_owned_project(project_id, user, db)
    dataset = db.get(Dataset, dataset_id)
    if dataset is None or dataset.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dataset not found")
    return dataset


@router.get("")
def get_datasets(
    project_id: str, user: CurrentUser, db: SessionDep
) -> list[DatasetPublic]:
    get_owned_project(project_id, user, db)
    datasets = db.exec(
        select(Dataset)
        .where(Dataset.project_id == project_id)
        .order_by(col(Dataset.created_at).desc(), col(Dataset.id).desc())
    ).all()
    return [DatasetPublic.model_validate(dataset) for dataset in datasets]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_dataset(
    project_id: str, body: DatasetCreate, user: CurrentUser, db: SessionDep
) -> DatasetPublic:
    get_owned_project(project_id, user, db)
    dataset = Dataset(name=body.name, project_id=project_id)
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return DatasetPublic.model_validate(dataset)


@router.patch("/{dataset_id}")
def update_dataset(
    project_id: str,
    dataset_id: str,
    body: DatasetUpdate,
    user: CurrentUser,
    db: SessionDep,
) -> DatasetPublic:
    dataset = get_owned_dataset(project_id, dataset_id, user, db)
    dataset.name = body.name
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return DatasetPublic.model_validate(dataset)


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(
    project_id: str, dataset_id: str, user: CurrentUser, db: SessionDep
) -> None:
    dataset = get_owned_dataset(project_id, dataset_id, user, db)
    db.delete(dataset)
    db.commit()
