from typing import Any

from sqlmodel import Session

from app.models import SurveyChart
from app.survey_charts import LabelBlock, charted_blocks, labellable


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


def check_labels(
    block: LabelBlock, answer: dict[str, list[int]], version_id: str, db: Session
) -> dict[str, list[int]]:
    chart = db.get(SurveyChart, (version_id, block.id))
    if chart is None:
        raise ValueError(f"{block.id} has no chart to label")
    points = labellable(chart.preview)
    label_ids = {label.id for label in block.labels}
    checked = {}
    seen: set[int] = set()
    for label_id, indices in answer.items():
        if label_id not in label_ids:
            raise ValueError(f"{label_id} isn't a label of {block.id}")
        unique = sorted(set(indices))
        if unique and (unique[-1] >= len(points) or not points[unique].all()):
            raise ValueError(f"{block.id} labels points that aren't on its chart")
        if seen.intersection(unique):
            raise ValueError(f"{block.id} gives a point more than one label")
        seen.update(unique)
        if unique:
            checked[label_id] = unique
    return checked


def check_answers(
    data: dict[str, int | dict[str, list[int]]],
    content: dict[str, Any],
    version_id: str,
    db: Session,
) -> dict[str, Any]:
    scales = scale_questions(content)
    labelling = {
        block.id: block
        for block in charted_blocks(content)
        if isinstance(block, LabelBlock) and block.source
    }
    unknown = data.keys() - scales - labelling.keys()
    if unknown:
        raise ValueError(f"Not a question in this survey: {', '.join(sorted(unknown))}")
    checked: dict[str, Any] = {}
    for block_id, answer in data.items():
        if block_id in scales:
            if not isinstance(answer, int):
                raise ValueError(f"{block_id} is answered with a number from 1 to 5")
            checked[block_id] = answer
        elif isinstance(answer, int):
            raise ValueError(f"{block_id} is answered by labelling points")
        else:
            labels = check_labels(labelling[block_id], answer, version_id, db)
            if labels:
                checked[block_id] = labels
    return checked
