from fastapi import APIRouter, HTTPException, Response, status

from app.auth import CurrentUser
from app.node_previews import (
    PREVIEW_ERRORS,
    axis_ranges,
    channel_values,
    node_preview,
    observe,
    sliced,
)
from app.observation_npz import observation_npz
from app.schemas import (
    NodePreviewRequest,
    SlicedNodePreview,
    binary_response,
)

router = APIRouter(prefix="/previews", tags=["previews"])


def invalid(exc: Exception) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc))


@router.post("/nodes")
def preview_node(body: NodePreviewRequest, user: CurrentUser) -> SlicedNodePreview:
    try:
        observation = observe(body)
        shown = sliced(observation, body.view)
        preview = node_preview(shown, channel_values(shown))
        return SlicedNodePreview(
            **preview.model_dump(), domain=axis_ranges(observation)
        )
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
