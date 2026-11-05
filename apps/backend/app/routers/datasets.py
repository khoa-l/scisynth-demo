import json
from importlib.metadata import distribution, version

from fastapi import APIRouter, HTTPException, status
from sqlmodel import Session, col, select

from app.auth import CurrentUser
from app.dataset_graph import DatasetGraph
from app.db import SessionDep
from app.models import Dataset, User
from app.routers.projects import get_owned_project
from app.schemas import DatasetCreate, DatasetFile, DatasetPublic, DatasetUpdate

router = APIRouter(prefix="/projects/{project_id}/datasets", tags=["datasets"])


def scisynth_version() -> str:
    source = json.loads(distribution("scisynth").read_text("direct_url.json") or "{}")
    return source.get("vcs_info", {}).get("commit_id") or version("scisynth")


GENERATOR = {"scisynth": scisynth_version(), "numpy": version("numpy")}


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


@router.get("/{dataset_id}")
def get_dataset(
    project_id: str, dataset_id: str, user: CurrentUser, db: SessionDep
) -> DatasetPublic:
    return DatasetPublic.model_validate(
        get_owned_dataset(project_id, dataset_id, user, db)
    )


@router.get("/{dataset_id}/export")
def export_dataset(
    project_id: str, dataset_id: str, user: CurrentUser, db: SessionDep
) -> DatasetFile:
    dataset = get_owned_dataset(project_id, dataset_id, user, db)
    return DatasetFile(
        name=dataset.name, generator=GENERATOR, graph=DatasetGraph(**dataset.content)
    )


@router.patch("/{dataset_id}")
def update_dataset(
    project_id: str,
    dataset_id: str,
    body: DatasetUpdate,
    user: CurrentUser,
    db: SessionDep,
) -> DatasetPublic:
    dataset = get_owned_dataset(project_id, dataset_id, user, db)
    if body.name is not None:
        dataset.name = body.name
    if body.content is not None:
        dataset.content = body.content.model_dump()
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
