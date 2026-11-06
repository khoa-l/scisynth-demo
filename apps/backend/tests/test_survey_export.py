import io
import json
import zipfile

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlmodel import Session, select

from app.models import SurveyChart
from tests.helpers import sign_up
from tests.surveys import TWO_CHANNELS, create_dataset, create_survey, publish
from tests.test_survey_labeling import labeling, submit


@pytest.fixture
def dataset_id(client: TestClient, project_url: str) -> str:
    return create_dataset(client, project_url, TWO_CHANNELS)


@pytest.fixture
def survey_url(client: TestClient, project_url: str, dataset_id: str) -> str:
    source = {"dataset_id": dataset_id, "node_id": "grid", "channels": [0]}
    return create_survey(client, project_url, labeling(source))


def export(client: TestClient, survey_url: str, **params: str) -> zipfile.ZipFile:
    response = client.get(f"{survey_url}/responses/export", params=params)
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/zip"
    return zipfile.ZipFile(io.BytesIO(response.content))


def listing(archive: zipfile.ZipFile) -> dict:
    return json.loads(archive.read("responses.json"))


def test_export_holds_answers_and_the_full_generated_data(
    client: TestClient, survey_url: str
) -> None:
    submit(client, publish(client, survey_url), {"l1": {"defect": [0, 17]}})

    archive = export(client, survey_url)

    assert set(archive.namelist()) == {
        "responses.json",
        "v1/l1.npz",
        "v1/l1.scisynth.json",
    }
    data = listing(archive)
    assert data["survey"] == "Intake"
    assert [r["answers"] for r in data["responses"]] == [{"l1": {"defect": [0, 17]}}]
    assert data["versions"][0]["charts"]["l1"] == {
        "data": "v1/l1.npz",
        "dataset": "v1/l1.scisynth.json",
        "layout": "grid",
        "axes": ["x", "y"],
        "regenerated": False,
    }
    arrays = np.load(io.BytesIO(archive.read("v1/l1.npz")))
    assert arrays["values"].shape == (16, 16, 2)
    assert arrays["truth"].shape == (16, 16, 2)
    assert arrays["mask"].all()
    assert arrays["coord_x"].shape == arrays["coord_y"].shape == (16,)
    assert json.loads(str(arrays["meta"]))
    dataset = json.loads(archive.read("v1/l1.scisynth.json"))
    assert [n["id"] for n in dataset["graph"]["nodes"]] == ["a", "b", "field", "grid"]
    assert set(dataset["generator"]) == {"scisynth", "numpy"}


def test_editing_a_channel_the_chart_hides_makes_a_new_version(
    client: TestClient, project_url: str, survey_url: str, dataset_id: str
) -> None:
    publish(client, survey_url)
    nodes = [
        {**node, "params": {**node["params"], "seed": 9}} if node["id"] == "b" else node
        for node in TWO_CHANNELS["nodes"]
    ]
    client.patch(
        f"{project_url}/datasets/{dataset_id}",
        json={"content": {**TWO_CHANNELS, "nodes": nodes}},
    )

    assert client.post(f"{survey_url}/publish").json()["published_version"] == 2


def test_exports_a_single_response(client: TestClient, survey_url: str) -> None:
    version_url = publish(client, survey_url)
    submit(client, version_url, {"l1": {"defect": [0]}})
    submit(client, version_url, {"l1": {"clean": [1]}})
    first = client.get(f"{survey_url}/responses").json()[-1]

    data = listing(export(client, survey_url, response_id=first["id"]))

    assert [r["id"] for r in data["responses"]] == [first["id"]]
    missing = client.get(
        f"{survey_url}/responses/export", params={"response_id": "nope"}
    )
    assert missing.status_code == 404


def test_regenerates_charts_published_before_data_was_kept(
    client: TestClient, engine: Engine, survey_url: str
) -> None:
    submit(client, publish(client, survey_url), {})
    with Session(engine) as db:
        chart = db.exec(select(SurveyChart)).one()
        chart.observation = None
        db.add(chart)
        db.commit()

    archive = export(client, survey_url)

    assert listing(archive)["versions"][0]["charts"]["l1"]["regenerated"] is True
    assert np.load(io.BytesIO(archive.read("v1/l1.npz")))["values"].shape == (16, 16, 2)


def test_export_is_private_to_the_owner(client: TestClient, survey_url: str) -> None:
    sign_up(client, "eve@example.com")

    assert client.get(f"{survey_url}/responses/export").status_code == 404
