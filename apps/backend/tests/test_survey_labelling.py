import numpy as np
import pytest
from fastapi.testclient import TestClient

from tests.previews import grid
from tests.surveys import DROPPED, SAMPLED, create_dataset, create_survey, publish

DEFECT = {"id": "defect", "name": "Defect", "color": "#e11d48"}
CLEAN = {"id": "clean", "name": "Clean", "color": "#2563eb"}


def labelling(source: dict | None, **changes: object) -> dict:
    return {
        "id": "l1",
        "type": "label",
        "text": "Paint the defects",
        "appearance": "blank",
        "source": source,
        "labels": [DEFECT, CLEAN],
        "tools": ["point", "lasso", "brush"],
        **changes,
    }


SCALE = {"id": "q1", "type": "scale", "text": "How sure are you?"}


@pytest.fixture
def source(client: TestClient, project_url: str) -> dict:
    dataset_id = create_dataset(client, project_url, SAMPLED)
    return {"dataset_id": dataset_id, "node_id": "grid", "channels": [0]}


def submit(client: TestClient, version_url: str, data: dict):
    public_url, version_id = version_url.split("/versions/")
    return client.post(
        f"{public_url}/responses", json={"version_id": version_id, "data": data}
    )


def test_publishing_freezes_a_labelling_blocks_chart(
    client: TestClient, project_url: str, source: dict
) -> None:
    survey_url = create_survey(client, project_url, labelling(source))

    frozen = client.get(f"{publish(client, survey_url)}/charts/l1").json()

    assert grid(frozen).shape == (16, 16)
    assert set(np.unique(grid(frozen))) == {0}


@pytest.mark.parametrize(
    ("changes", "message"),
    [
        ({"labels": []}, "at least 1 item"),
        ({"labels": [DEFECT, {**CLEAN, "id": "defect"}]}, "Label ids must be unique"),
        ({"labels": [{**DEFECT, "name": ""}]}, "at least 1 character"),
        ({"labels": [{**DEFECT, "color": "red"}]}, "should match pattern"),
        ({"tools": []}, "at least 1 item"),
        ({"tools": ["spray"]}, "'point', 'lasso' or 'brush'"),
    ],
)
def test_publishing_rejects_an_unfinished_labelling_block(
    client: TestClient, project_url: str, source: dict, changes: dict, message: str
) -> None:
    survey_url = create_survey(client, project_url, labelling(source, **changes))

    response = client.post(f"{survey_url}/publish")

    assert response.status_code == 422
    assert message in response.json()["detail"]


def test_accepts_points_with_several_labels_and_tidies_them(
    client: TestClient, project_url: str, source: dict
) -> None:
    survey_url = create_survey(client, project_url, labelling(source), SCALE)
    version_url = publish(client, survey_url)

    response = submit(
        client,
        version_url,
        {"l1": {"defect": [5, 3, 3, 0], "clean": [3, 255]}, "q1": 4},
    )

    assert response.status_code == 201, response.json()
    [stored] = client.get(f"{survey_url}/responses").json()
    assert stored["data"] == {"l1": {"defect": [0, 3, 5], "clean": [3, 255]}, "q1": 4}


def test_leaves_out_a_labelling_answer_with_nothing_labelled(
    client: TestClient, project_url: str, source: dict
) -> None:
    survey_url = create_survey(client, project_url, labelling(source))
    version_url = publish(client, survey_url)

    response = submit(client, version_url, {"l1": {"defect": [], "clean": []}})

    assert response.status_code == 201
    assert client.get(f"{survey_url}/responses").json()[0]["data"] == {}


@pytest.mark.parametrize(
    ("data", "message"),
    [
        ({"l1": {"wrong": [0]}}, "wrong isn't a label of l1"),
        ({"l1": {"defect": [256]}}, "l1 labels points that aren't on its chart"),
        ({"l1": {"defect": [-1]}}, "greater than or equal to 0"),
        ({"l1": {"defect": [True]}}, "valid integer"),
        ({"l1": 3}, "l1 is answered by labelling points"),
        ({"q1": {"defect": [0]}}, "q1 is answered with a number from 1 to 5"),
    ],
)
def test_rejects_labels_that_dont_fit_the_block(
    client: TestClient, project_url: str, source: dict, data: dict, message: str
) -> None:
    survey_url = create_survey(client, project_url, labelling(source), SCALE)
    version_url = publish(client, survey_url)

    response = submit(client, version_url, data)

    assert response.status_code == 422
    assert message in str(response.json()["detail"])
    assert client.get(f"{survey_url}/responses").json() == []


def test_rejects_labels_on_points_that_were_dropped(
    client: TestClient, project_url: str
) -> None:
    dataset_id = create_dataset(client, project_url, DROPPED)
    source = {"dataset_id": dataset_id, "node_id": "drop", "channels": [0, 1]}
    survey_url = create_survey(client, project_url, labelling(source))
    version_url = publish(client, survey_url)
    mask = grid(client.get(f"{version_url}/charts/l1").json()).ravel()
    dropped = int(np.flatnonzero(np.isnan(mask))[0])
    kept = int(np.flatnonzero(np.isfinite(mask))[0])

    assert submit(client, version_url, {"l1": {"defect": [kept]}}).status_code == 201
    response = submit(client, version_url, {"l1": {"defect": [kept, dropped]}})

    assert response.status_code == 422
    assert "aren't on its chart" in response.json()["detail"]


def test_a_labelling_block_without_data_takes_no_answer(
    client: TestClient, project_url: str
) -> None:
    survey_url = create_survey(client, project_url, labelling(None))
    version_url = publish(client, survey_url)

    response = submit(client, version_url, {"l1": {"defect": [0]}})

    assert response.status_code == 422
    assert "Not a question in this survey: l1" in response.json()["detail"]
