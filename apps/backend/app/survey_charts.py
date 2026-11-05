import base64
from typing import Annotated, Any, Literal, Self

import numpy as np
from fastapi import HTTPException, status
from pydantic import BaseModel, Field, TypeAdapter, model_validator
from sqlmodel import Session, select

from app.dataset_graph import DatasetGraph, Ref
from app.models import Dataset, SurveyChart, SurveyVersion
from app.routers.previews import channel_values, node_preview, observe, typed_array
from app.schemas import NodePreview, NodePreviewRequest


class ChartSource(BaseModel):
    dataset_id: Ref
    node_id: Ref
    channels: list[Annotated[int, Field(ge=0)]] = Field(min_length=1, max_length=50)


class ChartedBlock(BaseModel):
    id: Ref
    text: str = ""
    appearance: Literal["shown", "blank"] = "shown"
    source: ChartSource | None = None


class ChartBlock(ChartedBlock):
    type: Literal["chart"]


class SurveyLabel(BaseModel):
    id: Ref
    name: Annotated[str, Field(min_length=1, max_length=100)]
    color: Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")]


class LabelBlock(ChartedBlock):
    type: Literal["label"]
    labels: list[SurveyLabel] = Field(min_length=1, max_length=20)
    tools: list[Literal["point", "lasso", "brush"]] = Field(min_length=1)

    @model_validator(mode="after")
    def check_label_ids(self) -> Self:
        if len({label.id for label in self.labels}) != len(self.labels):
            raise ValueError("Label ids must be unique")
        return self


charted_block = TypeAdapter[ChartBlock | LabelBlock](
    Annotated[ChartBlock | LabelBlock, Field(discriminator="type")]
)


def charted_blocks(content: dict[str, Any]) -> list[ChartBlock | LabelBlock]:
    blocks = content.get("blocks")
    if not isinstance(blocks, list):
        return []
    return [
        charted_block.validate_python(block)
        for block in blocks
        if isinstance(block, dict) and block.get("type") in ("chart", "label")
    ]


def freeze_chart(source: ChartSource, project_id: str, db: Session) -> NodePreview:
    dataset = db.get(Dataset, source.dataset_id)
    if dataset is None or dataset.project_id != project_id:
        raise ValueError("The chart's dataset isn't in this project")
    graph = DatasetGraph.model_validate(dataset.content)
    observation = observe(
        NodePreviewRequest(node=source.node_id, nodes=[*graph.nodes], edges=graph.edges)
    )
    channels = channel_values(observation)
    if max(source.channels) >= len(channels):
        raise ValueError(f"The chart's data has no channel {max(source.channels) + 1}")
    return node_preview(observation, [channels[i] for i in source.channels])


def freeze_charts(
    content: dict[str, Any], project_id: str, db: Session
) -> dict[str, NodePreview]:
    charts = {}
    for block in charted_blocks(content):
        if block.source:
            charts[block.id] = freeze_chart(block.source, project_id, db)
    return charts


def labelable(preview: dict[str, Any]) -> np.ndarray:
    channels = [
        np.frombuffer(base64.b64decode(channel["bdata"]), np.float32)
        for channel in preview["channels"]
    ]
    return np.isfinite(np.stack(channels)).any(axis=0)


def blank(preview: dict[str, Any]) -> NodePreview:
    shape = [int(n) for n in preview["channels"][0]["shape"].split(", ")]
    values = np.where(labelable(preview).reshape(shape), 0.0, np.nan)
    return NodePreview.model_validate({**preview, "channels": [typed_array(values)]})


def frozen_charts(version_id: str, db: Session) -> dict[str, dict[str, Any]]:
    charts = db.exec(select(SurveyChart).where(SurveyChart.version_id == version_id))
    return {chart.block_id: chart.preview for chart in charts}


def find_chart(
    survey_id: str, version_id: str, block_id: str, db: Session
) -> tuple[SurveyChart, SurveyVersion]:
    found = db.exec(
        select(SurveyChart, SurveyVersion)
        .join(SurveyVersion)
        .where(
            SurveyChart.version_id == version_id,
            SurveyChart.block_id == block_id,
            SurveyVersion.survey_id == survey_id,
        )
    ).first()
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chart not found")
    return found


def get_chart(
    survey_id: str, version_id: str, block_id: str, db: Session
) -> NodePreview:
    chart, _ = find_chart(survey_id, version_id, block_id, db)
    return NodePreview.model_validate(chart.preview)


def get_respondent_chart(
    survey_id: str, version_id: str, block_id: str, db: Session
) -> NodePreview:
    chart, version = find_chart(survey_id, version_id, block_id, db)
    blanked = any(
        block.id == block_id and block.appearance == "blank"
        for block in charted_blocks(version.content)
    )
    return (
        blank(chart.preview) if blanked else NodePreview.model_validate(chart.preview)
    )


def respondent_content(content: dict[str, Any]) -> dict[str, Any]:
    blocks = content.get("blocks")
    if not isinstance(blocks, list):
        return content
    return {
        **content,
        "blocks": [
            {**block, "source": None, "has_chart": True}
            if isinstance(block, dict) and block.get("source")
            else block
            for block in blocks
        ],
    }
