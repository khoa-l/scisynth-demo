from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlmodel import Session, select

from app.db import SessionDep
from app.models import Survey, SurveyResponse, SurveyVersion
from app.schemas import PublishedSurvey, SurveyResponseCreate, SurveyResponseReceipt

router = APIRouter(prefix="/public/surveys/{public_id}", tags=["public"])


def get_published_survey(public_id: str, db: Session) -> Survey:
    survey = db.exec(select(Survey).where(Survey.public_id == public_id)).first()
    if survey is None or survey.published_version is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Survey not found")
    return survey


def scale_questions(content: dict[str, Any]) -> set[str]:
    blocks = content.get("blocks")
    if not isinstance(blocks, list):
        return set()
    return {
        block["id"]
        for block in blocks
        if isinstance(block, dict)
        and block.get("type") == "scale"
        and isinstance(block.get("id"), str)
    }


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
    unknown = body.data.keys() - scale_questions(version.content)
    if unknown:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Not a question in this survey: {', '.join(sorted(unknown))}",
        )
    response = SurveyResponse(
        survey_id=survey.id, version_id=version.id, data=body.data
    )
    db.add(response)
    db.commit()
    db.refresh(response)
    return SurveyResponseReceipt.model_validate(response)
