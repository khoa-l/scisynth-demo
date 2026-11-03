from fastapi import APIRouter, HTTPException, status
from sqlmodel import Session, select

from app.db import SessionDep
from app.models import Survey, SurveyResponse, SurveyVersion
from app.schemas import (
    NodePreview,
    PublishedSurvey,
    SurveyResponseCreate,
    SurveyResponseReceipt,
)
from app.survey_answers import check_answers
from app.survey_charts import get_chart

router = APIRouter(prefix="/public/surveys/{public_id}", tags=["public"])


def get_published_survey(public_id: str, db: Session) -> Survey:
    survey = db.exec(select(Survey).where(Survey.public_id == public_id)).first()
    if survey is None or survey.published_version is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Survey not found")
    return survey


@router.get("")
def get_published(public_id: str, db: SessionDep) -> PublishedSurvey:
    survey = get_published_survey(public_id, db)
    version = db.exec(
        select(SurveyVersion).where(
            SurveyVersion.survey_id == survey.id,
            SurveyVersion.number == survey.published_version,
        )
    ).one()
    return PublishedSurvey(
        name=survey.name, version_id=version.id, content=version.content
    )


@router.get("/versions/{version_id}/charts/{block_id}")
def get_published_chart(
    public_id: str, version_id: str, block_id: str, db: SessionDep
) -> NodePreview:
    survey = get_published_survey(public_id, db)
    return get_chart(survey.id, version_id, block_id, db)


@router.post("/responses", status_code=status.HTTP_201_CREATED)
def submit_response(
    public_id: str, body: SurveyResponseCreate, db: SessionDep
) -> SurveyResponseReceipt:
    survey = get_published_survey(public_id, db)
    version = db.get(SurveyVersion, body.version_id)
    if version is None or version.survey_id != survey.id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown survey version"
        )
    try:
        data = check_answers(body.data, version.content, version.id, db)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    response = SurveyResponse(survey_id=survey.id, version_id=version.id, data=data)
    db.add(response)
    db.commit()
    db.refresh(response)
    return SurveyResponseReceipt.model_validate(response)
