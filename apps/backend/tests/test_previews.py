import base64

import numpy as np
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


LATENTS = "/api/previews/latents"
FIELD = {"length_scale": 0.1, "amplitude": 1, "mean": 0, "resolution": 128, "order": 1}


def grid(preview: dict) -> np.ndarray:
    z = preview["z"]
    assert z["dtype"] == "f4"
    shape = tuple(int(n) for n in z["shape"].split(","))
    return np.frombuffer(base64.b64decode(z["bdata"]), np.float32).reshape(shape)


def test_previews_a_latent_as_a_heatmap_grid(signed_in: TestClient) -> None:
    response = signed_in.post(LATENTS, json={"kind": "GaussianField", "params": FIELD})

    assert response.status_code == 200
    preview = response.json()
    assert grid(preview).shape == (64, 64)
    assert len(preview["x"]) == len(preview["y"]) == 64
    assert [preview["x"][0], preview["x"][-1]] == [0, 1]
    assert [preview["y"][0], preview["y"][-1]] == [0, 1]


def test_latent_preview_follows_the_parameters_and_is_repeatable(
    signed_in: TestClient,
) -> None:
    def values(params: dict) -> np.ndarray:
        body = {"kind": "GaussianField", "params": params}
        return grid(signed_in.post(LATENTS, json=body).json())

    assert np.array_equal(values(FIELD), values(FIELD))
    assert np.allclose(values({**FIELD, "amplitude": 2}), 2 * values(FIELD))


def test_latent_preview_realizes_the_given_seed(signed_in: TestClient) -> None:
    def values(seed: int) -> np.ndarray:
        body = {"kind": "GaussianField", "params": FIELD, "seed": seed}
        return grid(signed_in.post(LATENTS, json=body).json())

    assert np.array_equal(values(3), values(3))
    assert not np.array_equal(values(3), values(4))


def test_latent_preview_rejects_a_negative_seed(signed_in: TestClient) -> None:
    body = {"kind": "GaussianField", "params": FIELD, "seed": -1}
    assert signed_in.post(LATENTS, json=body).status_code == 422


def test_latent_preview_caps_the_resolution(signed_in: TestClient) -> None:
    params = {**FIELD, "resolution": 4096, "max_cells": 10**12}

    response = signed_in.post(LATENTS, json={"kind": "GaussianField", "params": params})

    assert response.status_code == 422
    assert "over the limit of 262,144" in response.json()["detail"]


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ({"kind": "NoSuchLatent", "params": {}}, "Unknown component"),
        ({"kind": "GaussianNoise", "params": {}}, "is not a LatentGenerator"),
        ({"kind": "GaussianField", "params": {"length_scale": 0}}, "length_scale"),
    ],
)
def test_rejects_latents_it_cannot_preview(
    signed_in: TestClient, body: dict, message: str
) -> None:
    response = signed_in.post(LATENTS, json=body)

    assert response.status_code == 422
    assert message in response.json()["detail"]


def test_latent_preview_requires_a_session(client: TestClient) -> None:
    response = client.post(LATENTS, json={"kind": "GaussianField", "params": {}})
    assert response.status_code == 401
