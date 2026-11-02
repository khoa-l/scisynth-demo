from fastapi import APIRouter, HTTPException, status
from sqlmodel import Session, col, select

from app.auth import CurrentUser
from app.db import SessionDep
from app.models import Survey, User
from app.routers.projects import get_owned_project
from app.schemas import SurveyCreate, SurveyPublic, SurveyUpdate

router = APIRouter(prefix="/projects/{project_id}/surveys", tags=["surveys"])


def get_owned_survey(
    project_id: str, survey_id: str, user: User, db: Session
) -> Survey:
    get_owned_project(project_id, user, db)
    survey = db.get(Survey, survey_id)
    if survey is None or survey.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Survey not found")
    return survey


@router.get("")
def get_surveys(
    project_id: str, user: CurrentUser, db: SessionDep
) -> list[SurveyPublic]:
    get_owned_project(project_id, user, db)
    surveys = db.exec(
        select(Survey)
        .where(Survey.project_id == project_id)
        .order_by(col(Survey.created_at).desc(), col(Survey.id).desc())
    ).all()
    return [SurveyPublic.model_validate(survey) for survey in surveys]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_survey(
    project_id: str, body: SurveyCreate, user: CurrentUser, db: SessionDep
) -> SurveyPublic:
    get_owned_project(project_id, user, db)
    survey = Survey(name=body.name, project_id=project_id)
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return SurveyPublic.model_validate(survey)


@router.patch("/{survey_id}")
def update_survey(
    project_id: str,
    survey_id: str,
    body: SurveyUpdate,
    user: CurrentUser,
    db: SessionDep,
) -> SurveyPublic:
    survey = get_owned_survey(project_id, survey_id, user, db)
    survey.name = body.name
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return SurveyPublic.model_validate(survey)


@router.delete("/{survey_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_survey(
    project_id: str, survey_id: str, user: CurrentUser, db: SessionDep
) -> None:
    survey = get_owned_survey(project_id, survey_id, user, db)
    db.delete(survey)
    db.commit()
