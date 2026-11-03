import json

import scisynth.stages
from fastapi import APIRouter, HTTPException, status

from app.auth import CurrentUser
from app.schemas import PlotFigure, StagePreviewRequest

router = APIRouter(prefix="/previews", tags=["previews"])


@router.post("/stages")
def preview_stage(body: StagePreviewRequest, user: CurrentUser) -> PlotFigure:
    try:
        stage = scisynth.stages.Stage.from_dict(
            {"type": body.kind, "params": body.params}
        )
        figure = stage.preview()
    except (KeyError, TypeError, ValueError, NotImplementedError) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    return PlotFigure.model_validate(json.loads(figure.to_json()))
