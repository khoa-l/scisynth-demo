import pytest
from fastapi.testclient import TestClient

from tests.helpers import sign_up

URL = "/api/previews/stages"


@pytest.fixture
def signed_in(client: TestClient) -> TestClient:
    sign_up(client, "ada@example.com")
    return client


def test_previews_a_stage_as_a_before_and_after_figure(signed_in: TestClient) -> None:
    response = signed_in.post(
        URL, json={"kind": "GaussianNoise", "params": {"sigma": 0.5}}
    )

    assert response.status_code == 200
    figure = response.json()
    assert [trace["type"] for trace in figure["data"]] == ["scatter", "scatter"]
    titles = [note["text"] for note in figure["layout"]["annotations"]]
    assert titles == ["before", "after GaussianNoise"]


def test_uses_the_given_parameters(signed_in: TestClient) -> None:
    def after(params: dict) -> list:
        body = {"kind": "Gain", "params": params}
        return signed_in.post(URL, json=body).json()["data"][1]["marker"]

    assert after({"factor": 1}) != after({"factor": 3})


def test_accepts_blank_optional_parameters(signed_in: TestClient) -> None:
    body = {"kind": "Quantize", "params": {"levels": 4, "vmin": None, "vmax": None}}
    assert signed_in.post(URL, json=body).status_code == 200


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ({"kind": "NoSuchStage", "params": {}}, "Unknown component"),
        ({"kind": "GaussianField", "params": {}}, "is not a Stage"),
        ({"kind": "GaussianNoise", "params": {"strength": 1}}, "strength"),
        ({"kind": "GaussianNoise", "params": {"sigma": -1}}, "non-negative"),
    ],
)
def test_rejects_what_it_cannot_preview(
    signed_in: TestClient, body: dict, message: str
) -> None:
    response = signed_in.post(URL, json=body)

    assert response.status_code == 422
    assert message in response.json()["detail"]


def test_requires_a_session(client: TestClient) -> None:
    response = client.post(URL, json={"kind": "Gain", "params": {}})
    assert response.status_code == 401
