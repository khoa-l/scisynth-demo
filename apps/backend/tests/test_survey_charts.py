import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlmodel import Session, select

from app.models import SurveyChart
from tests.helpers import sign_in, sign_up
from tests.previews import decode, field, grid, sampler
from tests.surveys import (
    DROPPED,
    SAMPLED,
    TWO_CHANNELS,
    create_dataset,
    create_survey,
    live,
    placed,
    publish,
)


def chart(source: dict | None, appearance: str = "shown") -> dict:
    return {
        "id": "c1",
        "type": "chart",
        "text": "",
        "appearance": appearance,
        "source": source,
    }


def test_publishing_freezes_a_chart_of_the_chosen_node(
    client: TestClient, project_url: str
) -> None:
    dataset_id = create_dataset(client, project_url, SAMPLED)
    survey_url = create_survey(
        client,
        project_url,
        chart({"dataset_id": dataset_id, "node_id": "grid", "channels": [0]}),
    )

    version_url = publish(client, survey_url)
    client.cookies.clear()
    frozen = client.get(f"{version_url}/charts/c1")

    assert frozen.status_code == 200
    sign_in(client, "ada@example.com")
    assert frozen.json() == live(client, SAMPLED)
    assert grid(frozen.json()).shape == (16, 16)


def test_a_published_chart_keeps_its_data_when_the_dataset_changes(
    client: TestClient, project_url: str
) -> None:
    dataset_id = create_dataset(client, project_url, SAMPLED)
    survey_url = create_survey(
        client,
        project_url,
        chart({"dataset_id": dataset_id, "node_id": "grid", "channels": [0]}),
    )
    version_url = publish(client, survey_url)
    before = client.get(f"{version_url}/charts/c1").json()

    smaller = placed(field("field"), sampler("grid", "GridSampler", shape=8))
    client.patch(
        f"{project_url}/datasets/{dataset_id}",
        json={"content": {**SAMPLED, "nodes": smaller}},
    )

    assert client.get(f"{version_url}/charts/c1").json() == before


def test_republishing_after_the_dataset_changes_freezes_the_new_data(
    client: TestClient, project_url: str
) -> None:
    dataset_id = create_dataset(client, project_url, SAMPLED)
    survey_url = create_survey(
        client,
        project_url,
        chart({"dataset_id": dataset_id, "node_id": "grid", "channels": [0]}),
    )
    first_url = publish(client, survey_url)
    smaller = placed(field("field"), sampler("grid", "GridSampler", shape=8))
    client.patch(
        f"{project_url}/datasets/{dataset_id}",
        json={"content": {**SAMPLED, "nodes": smaller}},
    )

    second_url = publish(client, survey_url)

    assert second_url != first_url
    assert client.get(survey_url).json()["published_version"] == 2
    assert grid(client.get(f"{second_url}/charts/c1").json()).shape == (8, 8)
    assert grid(client.get(f"{first_url}/charts/c1").json()).shape == (16, 16)


def test_republishing_unchanged_content_and_data_reuses_the_version(
    client: TestClient, project_url: str
) -> None:
    dataset_id = create_dataset(client, project_url, SAMPLED)
    survey_url = create_survey(
        client,
        project_url,
        chart({"dataset_id": dataset_id, "node_id": "grid", "channels": [0]}),
    )

    assert publish(client, survey_url) == publish(client, survey_url)
    assert len(client.get(f"{survey_url}/versions").json()) == 1


def test_a_chart_keeps_only_its_chosen_channels(
    client: TestClient, project_url: str
) -> None:
    dataset_id = create_dataset(client, project_url, TWO_CHANNELS)
    survey_url = create_survey(
        client,
        project_url,
        chart({"dataset_id": dataset_id, "node_id": "grid", "channels": [1]}),
    )

    frozen = client.get(f"{publish(client, survey_url)}/charts/c1").json()

    assert len(frozen["channels"]) == 1
    assert np.array_equal(grid(frozen), grid(live(client, TWO_CHANNELS), 1))


def test_a_blank_chart_keeps_where_the_data_is_but_not_its_values(
    client: TestClient, project_url: str
) -> None:
    dataset_id = create_dataset(client, project_url, DROPPED)
    survey_url = create_survey(
        client,
        project_url,
        chart(
            {"dataset_id": dataset_id, "node_id": "drop", "channels": [0, 1]},
            appearance="blank",
        ),
    )

    frozen = client.get(f"{publish(client, survey_url)}/charts/c1").json()

    shown = live(client, DROPPED, "drop")
    assert len(frozen["channels"]) == 1
    mask = grid(frozen)
    present = np.isfinite(grid(shown, 0)) | np.isfinite(grid(shown, 1))
    assert 0 < present.sum() < present.size
    assert np.array_equal(np.isfinite(mask), present)
    assert set(mask[present]) == {0}
    assert decode(frozen["x"]).tolist() == decode(shown["x"]).tolist()


def test_a_chart_without_data_is_left_out(
    client: TestClient, project_url: str, engine: Engine
) -> None:
    survey_url = create_survey(client, project_url, chart(None))

    version_url = publish(client, survey_url)

    assert client.get(f"{version_url}/charts/c1").status_code == 404
    with Session(engine) as session:
        assert session.exec(select(SurveyChart)).all() == []


@pytest.mark.parametrize(
    ("source", "message"),
    [
        ({"node_id": "missing", "channels": [0]}, "isn't part of the preview"),
        ({"node_id": "grid", "channels": [1]}, "has no channel 2"),
        ({"node_id": "grid", "channels": []}, "at least 1 item"),
    ],
)
def test_publishing_rejects_a_chart_it_cannot_show(
    client: TestClient, project_url: str, source: dict, message: str
) -> None:
    dataset_id = create_dataset(client, project_url, SAMPLED)
    survey_url = create_survey(
        client, project_url, chart({"dataset_id": dataset_id, **source})
    )

    response = client.post(f"{survey_url}/publish")

    assert response.status_code == 422
    assert response.json()["detail"].startswith("A chart can't be shown: ")
    assert message in response.json()["detail"]
    assert client.get(survey_url).json()["published_version"] is None
    assert client.get(f"{survey_url}/versions").json() == []


def test_publishing_rejects_a_malformed_chart(
    client: TestClient, project_url: str
) -> None:
    survey_url = create_survey(client, project_url, chart(None, appearance="bold"))

    response = client.post(f"{survey_url}/publish")

    assert response.status_code == 422
    assert "'shown' or 'blank'" in response.json()["detail"]


def test_a_chart_can_only_use_data_from_its_own_project(
    client: TestClient, project_url: str
) -> None:
    other_project = client.post("/api/projects", json={"name": "Other"}).json()["id"]
    dataset_id = create_dataset(client, f"/api/projects/{other_project}", SAMPLED)
    survey_url = create_survey(
        client,
        project_url,
        chart({"dataset_id": dataset_id, "node_id": "grid", "channels": [0]}),
    )

    response = client.post(f"{survey_url}/publish")

    assert response.status_code == 422
    assert "isn't in this project" in response.json()["detail"]


def test_charts_are_only_served_for_their_own_survey_and_while_published(
    client: TestClient, project_url: str
) -> None:
    dataset_id = create_dataset(client, project_url, SAMPLED)
    source = {"dataset_id": dataset_id, "node_id": "grid", "channels": [0]}
    survey_url = create_survey(client, project_url, chart(source))
    other_url = create_survey(client, project_url, chart(source))
    version_url = publish(client, survey_url)
    other_version_url = publish(client, other_url)
    other_version_id = other_version_url.rsplit("/", 1)[1]

    assert client.get(f"{version_url}/charts/missing").status_code == 404
    public_url = version_url.rsplit("/versions/", 1)[0]
    mixed = f"{public_url}/versions/{other_version_id}/charts/c1"
    assert client.get(mixed).status_code == 404

    client.delete(f"{survey_url}/publish")
    assert client.get(f"{version_url}/charts/c1").status_code == 404


def test_the_owner_sees_a_versions_chart_even_when_unpublished(
    client: TestClient, project_url: str
) -> None:
    dataset_id = create_dataset(client, project_url, SAMPLED)
    survey_url = create_survey(
        client,
        project_url,
        chart({"dataset_id": dataset_id, "node_id": "grid", "channels": [0]}),
    )
    version_id = publish(client, survey_url).rsplit("/", 1)[1]
    client.delete(f"{survey_url}/publish")
    owner_url = f"{survey_url}/versions/{version_id}/charts/c1"

    assert client.get(owner_url).json() == live(client, SAMPLED)

    client.cookies.clear()
    assert client.get(owner_url).status_code == 401
    sign_up(client, "grace@example.com")
    assert client.get(owner_url).status_code == 404


def test_deleting_a_survey_deletes_its_charts(
    client: TestClient, project_url: str, engine: Engine
) -> None:
    dataset_id = create_dataset(client, project_url, SAMPLED)
    survey_url = create_survey(
        client,
        project_url,
        chart({"dataset_id": dataset_id, "node_id": "grid", "channels": [0]}),
    )
    publish(client, survey_url)

    assert client.delete(survey_url).status_code == 204
    with Session(engine) as session:
        assert session.exec(select(SurveyChart)).all() == []
