from collections.abc import Sequence
from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Response, status
from sqlmodel import Session, col, select

from app.auth import CurrentUser
from app.db import SessionDep
from app.exports import export_responses
from app.models import (
    Survey,
    SurveyChart,
    SurveyResponse,
    SurveyVersion,
    User,
    new_id,
)
from app.node_previews import PREVIEW_ERRORS
from app.routers.projects import get_owned_project
from app.schemas import (
    NodePreview,
    SurveyCreate,
    SurveyPublic,
    SurveyResponsePublic,
    SurveyUpdate,
    SurveyVersionPublic,
    binary_response,
)
from app.survey_charts import chart_versions, freeze_charts, frozen_charts, get_chart

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


@router.get("/{survey_id}")
def get_survey(
    project_id: str, survey_id: str, user: CurrentUser, db: SessionDep
) -> SurveyPublic:
    return SurveyPublic.model_validate(
        get_owned_survey(project_id, survey_id, user, db)
    )


@router.patch("/{survey_id}")
def update_survey(
    project_id: str,
    survey_id: str,
    body: SurveyUpdate,
    user: CurrentUser,
    db: SessionDep,
) -> SurveyPublic:
    survey = get_owned_survey(project_id, survey_id, user, db)
    survey.sqlmodel_update(body.model_dump(exclude_none=True))
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


@router.post("/{survey_id}/publish")
def publish_survey(
    project_id: str, survey_id: str, user: CurrentUser, db: SessionDep
) -> SurveyPublic:
    survey = get_owned_survey(project_id, survey_id, user, db)
    latest = db.exec(
        select(SurveyVersion)
        .where(SurveyVersion.survey_id == survey.id)
        .order_by(col(SurveyVersion.number).desc())
    ).first()
    try:
        charts = freeze_charts(survey.content, project_id, db)
    except PREVIEW_ERRORS as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"A chart can't be shown: {exc}"
        ) from exc
    if (
        latest is None
        or latest.content != survey.content
        or chart_versions(frozen_charts(latest.id, db)) != chart_versions(charts)
    ):
        latest = SurveyVersion(
            survey_id=survey.id,
            number=latest.number + 1 if latest else 1,
            content=survey.content,
        )
        db.add(latest)
        db.flush()
        db.add_all(
            SurveyChart(version_id=latest.id, block_id=block_id, **asdict(chart))
            for block_id, chart in charts.items()
        )
    survey.published_version = latest.number
    survey.public_id = survey.public_id or new_id()
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return SurveyPublic.model_validate(survey)


@router.delete("/{survey_id}/publish")
def unpublish_survey(
    project_id: str, survey_id: str, user: CurrentUser, db: SessionDep
) -> SurveyPublic:
    survey = get_owned_survey(project_id, survey_id, user, db)
    survey.published_version = None
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return SurveyPublic.model_validate(survey)


@router.get("/{survey_id}/versions")
def get_survey_versions(
    project_id: str, survey_id: str, user: CurrentUser, db: SessionDep
) -> list[SurveyVersionPublic]:
    survey = get_owned_survey(project_id, survey_id, user, db)
    versions = db.exec(
        select(SurveyVersion)
        .where(SurveyVersion.survey_id == survey.id)
        .order_by(col(SurveyVersion.number).desc())
    ).all()
    return [SurveyVersionPublic.model_validate(version) for version in versions]


@router.get("/{survey_id}/versions/{version_id}/charts/{block_id}")
def get_survey_chart(
    project_id: str,
    survey_id: str,
    version_id: str,
    block_id: str,
    user: CurrentUser,
    db: SessionDep,
) -> NodePreview:
    survey = get_owned_survey(project_id, survey_id, user, db)
    return get_chart(survey.id, version_id, block_id, db)


def survey_responses(
    survey_id: str,
    db: Session,
    version: int | None = None,
    response_id: str | None = None,
) -> Sequence[tuple[SurveyResponse, SurveyVersion]]:
    query = (
        select(SurveyResponse, SurveyVersion)
        .join(SurveyVersion)
        .where(SurveyResponse.survey_id == survey_id)
        .order_by(
            col(SurveyVersion.number).desc(),
            col(SurveyResponse.submitted_at).desc(),
            col(SurveyResponse.id),
        )
    )
    if version is not None:
        query = query.where(SurveyVersion.number == version)
    if response_id is not None:
        query = query.where(SurveyResponse.id == response_id)
    return db.exec(query).all()


@router.get("/{survey_id}/responses")
def get_survey_responses(
    project_id: str,
    survey_id: str,
    user: CurrentUser,
    db: SessionDep,
    version: int | None = None,
) -> list[SurveyResponsePublic]:
    survey = get_owned_survey(project_id, survey_id, user, db)
    return [
        SurveyResponsePublic(
            id=response.id,
            version=version.number,
            submitted_at=response.submitted_at,
            data=response.data,
        )
        for response, version in survey_responses(survey.id, db, version)
    ]


@router.get(
    "/{survey_id}/responses/export",
    response_class=Response,
    responses=binary_response("application/zip"),
)
def export_survey_responses(
    project_id: str,
    survey_id: str,
    user: CurrentUser,
    db: SessionDep,
    response_id: str | None = None,
) -> Response:
    survey = get_owned_survey(project_id, survey_id, user, db)
    rows = survey_responses(survey.id, db, response_id=response_id)
    if response_id is not None and not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Response not found")
    return Response(export_responses(survey, rows, db), media_type="application/zip")
