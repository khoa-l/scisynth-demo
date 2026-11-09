import io
import json
import zipfile
from collections.abc import Sequence
from typing import Any

from sqlmodel import Session

from app.dataset_graph import GENERATOR, DatasetGraph
from app.models import Dataset, Survey, SurveyResponse, SurveyVersion
from app.node_previews import PREVIEW_ERRORS, observe
from app.observation_npz import observation_npz
from app.schemas import DatasetFile, NodePreviewRequest
from app.survey_charts import (
    FrozenChart,
    charted_blocks,
    freeze_chart,
    frozen_charts,
)

INDEX = (
    "A label's indices count through its chart's locations. For a grid with nx x "
    "values, index i is values[i % nx, i // nx]; for points, index i is values[i]."
)


def zipped(files: dict[str, bytes | str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, contents in files.items():
            archive.writestr(path, contents)
    return buffer.getvalue()


def as_json(value: Any) -> str:
    return json.dumps(value, indent=2, default=str)


def version_charts(
    version: SurveyVersion, project_id: str, db: Session
) -> list[tuple[str, FrozenChart | None, bool]]:
    saved = frozen_charts(version.id, db)
    charts = []
    for block in charted_blocks(version.content):
        if not block.source:
            continue
        chart = saved.get(block.id)
        if chart is not None and chart.observation is not None:
            frozen = FrozenChart(chart.preview, chart.dataset_file, chart.observation)
            charts.append((block.id, frozen, False))
            continue
        try:
            charts.append((block.id, freeze_chart(block.source, project_id, db), True))
        except PREVIEW_ERRORS:
            charts.append((block.id, None, True))
    return charts


# The zip layout is ours for now. When scisynth has an export format, write its
# files in place of the .npz and .scisynth.json files here.
def export_responses(
    survey: Survey,
    rows: Sequence[tuple[SurveyResponse, SurveyVersion]],
    db: Session,
) -> bytes:
    versions = sorted(
        {version.id: version for _, version in rows}.values(), key=lambda v: v.number
    )
    files: dict[str, bytes | str] = {}
    listed = []
    for version in versions:
        charts = {}
        for block_id, chart, regenerated in version_charts(
            version, survey.project_id, db
        ):
            if chart is None:
                charts[block_id] = {"data": None, "dataset": None, "regenerated": True}
                continue
            data, dataset = (
                f"v{version.number}/{block_id}.npz",
                f"v{version.number}/{block_id}.scisynth.json",
            )
            files[data] = chart.observation
            files[dataset] = as_json(chart.dataset_file)
            charts[block_id] = {
                "data": data,
                "dataset": dataset,
                "layout": chart.preview["layout"],
                "axes": chart.preview["axes"],
                "regenerated": regenerated,
            }
        listed.append(
            {
                "number": version.number,
                "published_at": version.published_at,
                "content": version.content,
                "charts": charts,
            }
        )
    files["responses.json"] = as_json(
        {
            "survey": survey.name,
            "index": INDEX,
            "versions": listed,
            "responses": [
                {
                    "id": response.id,
                    "version": version.number,
                    "submitted_at": response.submitted_at,
                    "answers": response.data,
                }
                for response, version in rows
            ],
        }
    )
    return zipped(files)


# Generated at preview size. Switch to scisynth's own export and full-size
# generation here once they exist.
def export_dataset_data(dataset: Dataset) -> bytes:
    graph = DatasetGraph.model_validate(dataset.content)
    files: dict[str, bytes | str] = {
        f"{dataset.name}.scisynth.json": DatasetFile(
            name=dataset.name, generator=GENERATOR, graph=graph
        ).model_dump_json(indent=2)
    }
    skipped = {}
    for node in graph.nodes:
        request = NodePreviewRequest(
            node=node.id, nodes=[*graph.nodes], edges=graph.edges
        )
        try:
            files[f"data/{node.kind}-{node.id}.npz"] = observation_npz(observe(request))
        except PREVIEW_ERRORS as exc:
            skipped[node.id] = str(exc)
    if skipped:
        files["skipped.json"] = as_json(skipped)
    return zipped(files)
