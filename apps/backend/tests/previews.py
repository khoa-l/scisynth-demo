import base64

import numpy as np
from fastapi.testclient import TestClient

NODES = "/api/previews/nodes"
FIELD = {"length_scale": 0.1, "amplitude": 1, "mean": 0, "resolution": 128, "order": 1}


def field(node_id: str, **params: object) -> dict:
    return {
        "id": node_id,
        "kind": "GaussianField",
        "params": {**FIELD, "seed": 0, **params},
    }


def composite(node_id: str, kind: str) -> dict:
    return {"id": node_id, "kind": kind, "params": {}}


def link(source: str, target: str, port: str = "terms") -> dict:
    return {
        "id": f"{source}-{target}",
        "source": source,
        "source_port": "field",
        "target": target,
        "target_port": port,
    }


def decode(array: dict) -> np.ndarray:
    assert array["dtype"] == "f4"
    shape = tuple(int(n) for n in array["shape"].split(","))
    return np.frombuffer(base64.b64decode(array["bdata"]), np.float32).reshape(shape)


def grid(preview: dict, channel: int = 0) -> np.ndarray:
    return decode(preview["channels"][channel])


def preview(
    client: TestClient, node: str, nodes: list, edges: list | None = None
) -> dict:
    body = {"node": node, "nodes": nodes, "edges": edges or []}
    response = client.post(NODES, json=body)
    assert response.status_code == 200, response.json()
    return response.json()


def sampler(node_id: str, kind: str, **params: object) -> dict:
    return {"id": node_id, "kind": kind, "params": params}


def sampled(node_id: str) -> dict:
    return {
        "id": f"field-{node_id}",
        "source": "field",
        "source_port": "field",
        "target": node_id,
        "target_port": "latent",
    }


def stage(node_id: str, kind: str, source: str, **params: object) -> tuple[dict, dict]:
    node = {"id": node_id, "kind": kind, "params": params}
    edge = {
        "id": f"{source}-{node_id}",
        "source": source,
        "source_port": "observation",
        "target": node_id,
        "target_port": "observation",
    }
    return node, edge


def grid_sampled() -> tuple[list, list]:
    return [field("field"), sampler("grid", "GridSampler", shape=16)], [sampled("grid")]
