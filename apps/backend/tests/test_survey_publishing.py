import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlmodel import Session, select

from app.models import SurveyResponse, SurveyVersion
from tests.helpers import is_nanoid, sign_up

QUESTIONS = {"questions": [{"id": "q1", "text": "How was it?"}]}


@pytest.fixture
def survey_url(client: TestClient) -> str:
    sign_up(client, "ada@example.com")
    project_id = client.post("/api/projects", json={"name": "Project"}).json()["id"]
    url = f"/api/projects/{project_id}/surveys"
    survey_id = client.post(url, json={"name": "Intake"}).json()["id"]
    return f"{url}/{survey_id}"


def publish(client: TestClient, survey_url: str) -> dict:
    response = client.post(f"{survey_url}/publish")
    assert response.status_code == 200
    return response.json()


def public_url(survey: dict) -> str:
    return f"/api/public/surveys/{survey['public_id']}"


def test_new_survey_is_an_unpublished_empty_draft(
    client: TestClient, survey_url: str
) -> None:
    survey = client.get(survey_url).json()
    assert survey["content"] == {}
    assert survey["public_id"] is None
    assert survey["published_version"] is None


def test_update_survey_content_keeps_name(client: TestClient, survey_url: str) -> None:
    response = client.patch(survey_url, json={"content": QUESTIONS})
    assert response.status_code == 200
    assert response.json()["content"] == QUESTIONS
    assert response.json()["name"] == "Intake"


def test_publish_creates_version_and_public_link(
    client: TestClient, survey_url: str
) -> None:
    client.patch(survey_url, json={"content": QUESTIONS})
    survey = publish(client, survey_url)

    assert survey["published_version"] == 1
    assert is_nanoid(survey["public_id"])
    assert survey["public_id"] != survey["id"]
    versions = client.get(f"{survey_url}/versions").json()
    assert [(v["number"], v["content"]) for v in versions] == [(1, QUESTIONS)]


def test_republishing_unchanged_content_reuses_version(
    client: TestClient, survey_url: str
) -> None:
    first = publish(client, survey_url)
    second = publish(client, survey_url)

    assert second["published_version"] == 1
    assert second["public_id"] == first["public_id"]
    assert len(client.get(f"{survey_url}/versions").json()) == 1


def test_publishing_changes_adds_version_and_keeps_link(
    client: TestClient, survey_url: str
) -> None:
    first = publish(client, survey_url)
    client.patch(survey_url, json={"content": QUESTIONS})
    second = publish(client, survey_url)

    assert second["published_version"] == 2
    assert second["public_id"] == first["public_id"]
    versions = client.get(f"{survey_url}/versions").json()
    assert [(v["number"], v["content"]) for v in versions] == [
        (2, QUESTIONS),
        (1, {}),
    ]


def test_public_survey_shows_published_version_not_draft(
    client: TestClient, survey_url: str
) -> None:
    client.patch(survey_url, json={"content": QUESTIONS})
    survey = publish(client, survey_url)
    client.patch(survey_url, json={"content": {"draft": True}})
    client.cookies.clear()

    response = client.get(public_url(survey))
    assert response.status_code == 200
    published = response.json()
    assert published["name"] == "Intake"
    assert published["content"] == QUESTIONS
    assert is_nanoid(published["version_id"])
    assert set(published) == {"name", "version_id", "content"}


def test_unpublished_survey_is_not_public(client: TestClient, survey_url: str) -> None:
    survey = publish(client, survey_url)
    version_id = client.get(public_url(survey)).json()["version_id"]

    unpublished = client.delete(f"{survey_url}/publish")
    assert unpublished.status_code == 200
    assert unpublished.json()["published_version"] is None
    assert unpublished.json()["public_id"] == survey["public_id"]
    assert client.get(public_url(survey)).status_code == 404
    assert (
        client.post(
            f"{public_url(survey)}/responses",
            json={"version_id": version_id, "data": {}},
        ).status_code
        == 404
    )

    assert publish(client, survey_url)["public_id"] == survey["public_id"]
    assert client.get(public_url(survey)).status_code == 200


def test_unknown_public_link_is_not_found(client: TestClient) -> None:
    assert client.get("/api/public/surveys/missing-public-id-00000").status_code == 404


def test_anyone_can_submit_a_response(client: TestClient, survey_url: str) -> None:
    survey = publish(client, survey_url)
    client.cookies.clear()
    version_id = client.get(public_url(survey)).json()["version_id"]

    response = client.post(
        f"{public_url(survey)}/responses",
        json={"version_id": version_id, "data": {"q1": "Great"}},
    )
    assert response.status_code == 201
    assert is_nanoid(response.json()["id"])
    assert set(response.json()) == {"id", "submitted_at"}


def test_response_must_use_a_version_of_this_survey(
    client: TestClient, survey_url: str
) -> None:
    survey = publish(client, survey_url)
    other_url = survey_url.rsplit("/", 1)[0]
    other_id = client.post(other_url, json={"name": "Other"}).json()["id"]
    other = publish(client, f"{other_url}/{other_id}")
    other_version_id = client.get(public_url(other)).json()["version_id"]

    for version_id in [other_version_id, "missing-version-id-000"]:
        response = client.post(
            f"{public_url(survey)}/responses",
            json={"version_id": version_id, "data": {}},
        )
        assert response.status_code == 422


def test_responses_to_an_older_version_are_kept(
    client: TestClient, survey_url: str
) -> None:
    survey = publish(client, survey_url)
    old_version_id = client.get(public_url(survey)).json()["version_id"]
    client.patch(survey_url, json={"content": QUESTIONS})
    publish(client, survey_url)

    response = client.post(
        f"{public_url(survey)}/responses",
        json={"version_id": old_version_id, "data": {"late": True}},
    )
    assert response.status_code == 201
    assert client.get(f"{survey_url}/responses").json()[0]["version"] == 1


def test_owner_lists_responses_with_version_filter(
    client: TestClient, survey_url: str
) -> None:
    survey = publish(client, survey_url)
    first = client.get(public_url(survey)).json()["version_id"]
    client.post(
        f"{public_url(survey)}/responses", json={"version_id": first, "data": {"n": 1}}
    )
    client.patch(survey_url, json={"content": QUESTIONS})
    publish(client, survey_url)
    second = client.get(public_url(survey)).json()["version_id"]
    client.post(
        f"{public_url(survey)}/responses", json={"version_id": second, "data": {"n": 2}}
    )

    responses = client.get(f"{survey_url}/responses").json()
    assert [(r["version"], r["data"]) for r in responses] == [
        (2, {"n": 2}),
        (1, {"n": 1}),
    ]
    assert all(is_nanoid(r["id"]) for r in responses)
    filtered = client.get(f"{survey_url}/responses", params={"version": 1}).json()
    assert [r["data"] for r in filtered] == [{"n": 1}]


def test_publishing_endpoints_are_private_to_owner(
    client: TestClient, survey_url: str
) -> None:
    client.cookies.clear()
    for method, path in [
        ("post", "/publish"),
        ("delete", "/publish"),
        ("get", "/versions"),
        ("get", "/responses"),
    ]:
        assert client.request(method, f"{survey_url}{path}").status_code == 401

    sign_up(client, "grace@example.com")
    for method, path in [
        ("post", "/publish"),
        ("delete", "/publish"),
        ("get", "/versions"),
        ("get", "/responses"),
    ]:
        assert client.request(method, f"{survey_url}{path}").status_code == 404


def test_deleting_survey_deletes_versions_and_responses(
    client: TestClient, engine: Engine, survey_url: str
) -> None:
    survey = publish(client, survey_url)
    version_id = client.get(public_url(survey)).json()["version_id"]
    client.post(
        f"{public_url(survey)}/responses", json={"version_id": version_id, "data": {}}
    )

    assert client.delete(survey_url).status_code == 204
    with Session(engine) as session:
        assert session.exec(select(SurveyVersion)).all() == []
        assert session.exec(select(SurveyResponse)).all() == []
