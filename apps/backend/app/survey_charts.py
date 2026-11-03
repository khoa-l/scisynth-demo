from typing import Annotated, Any, Literal

import numpy as np
from fastapi import HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.dataset_graph import DatasetGraph, Ref
from app.models import Dataset, SurveyChart, SurveyVersion
from app.routers.previews import channel_values, node_preview, observe
from app.schemas import NodePreview, NodePreviewRequest


class ChartSource(BaseModel):
    dataset_id: Ref
    node_id: Ref
    channels: list[Annotated[int, Field(ge=0)]] = Field(min_length=1, max_length=50)


class ChartBlock(BaseModel):
    id: Ref
    type: Literal["chart"]
    text: str = ""
    appearance: Literal["shown", "blank"] = "shown"
    source: ChartSource | None = None


def chart_blocks(content: dict[str, Any]) -> list[ChartBlock]:
    blocks = content.get("blocks")
    if not isinstance(blocks, list):
        return []
    return [
        ChartBlock.model_validate(block)
        for block in blocks
        if isinstance(block, dict) and block.get("type") == "chart"
    ]


def freeze_chart(
    source: ChartSource, appearance: str, project_id: str, db: Session
) -> NodePreview:
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
    picked = [channels[i] for i in source.channels]
    if appearance == "blank":
        picked = [np.where(np.isfinite(np.stack(picked)).any(axis=0), 0.0, np.nan)]
    return node_preview(observation, picked)


def freeze_charts(
    content: dict[str, Any], project_id: str, db: Session
) -> dict[str, NodePreview]:
    charts = {}
    for block in chart_blocks(content):
        if block.source:
            charts[block.id] = freeze_chart(
                block.source, block.appearance, project_id, db
            )
    return charts


def get_chart(
    survey_id: str, version_id: str, block_id: str, db: Session
) -> NodePreview:
    chart = db.exec(
        select(SurveyChart)
        .join(SurveyVersion)
        .where(
            SurveyChart.version_id == version_id,
            SurveyChart.block_id == block_id,
            SurveyVersion.survey_id == survey_id,
        )
    ).first()
    if chart is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chart not found")
    return NodePreview.model_validate(chart.preview)
