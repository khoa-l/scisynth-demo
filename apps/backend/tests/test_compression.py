from fastapi.testclient import TestClient

from tests.previews import NODES, field

GZIP = {"Accept-Encoding": "gzip"}


def test_compresses_large_responses(signed_in: TestClient) -> None:
    body = {"node": "a", "nodes": [field("a")]}

    response = signed_in.post(NODES, json=body, headers=GZIP)

    assert response.headers["content-encoding"] == "gzip"
    assert len(response.json()["channels"]) == 1


def test_leaves_small_responses_alone(client: TestClient) -> None:
    response = client.get("/api/health", headers=GZIP)

    assert "content-encoding" not in response.headers
