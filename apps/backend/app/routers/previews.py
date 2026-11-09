from fastapi import APIRouter, HTTPException, Response, status

from app.auth import CurrentUser
from app.node_previews import (
    PREVIEW_ERRORS,
    channel_values,
    node_preview,
    observe,
)
from app.observation_npz import observation_npz
from app.schemas import (
    NodePreview,
    NodePreviewRequest,
    binary_response,
)

router = APIRouter(prefix="/previews", tags=["previews"])


def invalid(exc: Exception) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc))


@router.post("/nodes")
def preview_node(body: NodePreviewRequest, user: CurrentUser) -> NodePreview:
    try:
        observation = observe(body)
        return node_preview(observation, channel_values(observation))
    except PREVIEW_ERRORS as exc:
        raise invalid(exc) from exc


@router.post(
    "/nodes/data",
    response_class=Response,
    responses=binary_response("application/octet-stream"),
)
def download_node_data(body: NodePreviewRequest, user: CurrentUser) -> Response:
    try:
        data = observation_npz(observe(body))
    except PREVIEW_ERRORS as exc:
        raise invalid(exc) from exc
    return Response(data, media_type="application/octet-stream")
