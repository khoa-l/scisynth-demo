from fastapi.testclient import TestClient

from tests.previews import composite, field, link, preview, sampled, sampler, stage


def placed(*nodes: dict) -> list[dict]:
    return [{**node, "position": {"x": 0, "y": 0}} for node in nodes]


SAMPLED = {
    "version": 1,
    "nodes": placed(field("field"), sampler("grid", "GridSampler", shape=16)),
    "edges": [sampled("grid")],
}
TWO_CHANNELS = {
    "version": 1,
    "nodes": placed(
        field("a", seed=1),
        field("b", seed=2),
        composite("field", "Multichannel"),
        sampler("grid", "GridSampler", shape=16),
    ),
    "edges": [
        link("a", "field", "channels"),
        link("b", "field", "channels"),
        sampled("grid"),
    ],
}
DROPPED = {
    **TWO_CHANNELS,
    "nodes": [
        *TWO_CHANNELS["nodes"],
        *placed(stage("drop", "RandomDropout", "grid", p=0.5)[0]),
    ],
    "edges": [*TWO_CHANNELS["edges"], stage("drop", "RandomDropout", "grid")[1]],
}


def create_dataset(client: TestClient, project_url: str, content: dict) -> str:
    url = f"{project_url}/datasets"
    dataset_id = client.post(url, json={"name": "Fields"}).json()["id"]
    assert client.patch(f"{url}/{dataset_id}", json={"content": content}).is_success
    return dataset_id


def create_survey(client: TestClient, project_url: str, *blocks: dict) -> str:
    url = f"{project_url}/surveys"
    survey_id = client.post(url, json={"name": "Intake"}).json()["id"]
    client.patch(f"{url}/{survey_id}", json={"content": {"blocks": list(blocks)}})
    return f"{url}/{survey_id}"


def publish(client: TestClient, survey_url: str) -> str:
    response = client.post(f"{survey_url}/publish")
    assert response.status_code == 200, response.json()
    public_url = f"/api/public/surveys/{response.json()['public_id']}"
    return f"{public_url}/versions/{client.get(public_url).json()['version_id']}"


def live(client: TestClient, content: dict, node: str = "grid") -> dict:
    nodes = [{k: v for k, v in n.items() if k != "position"} for n in content["nodes"]]
    return preview(client, node, nodes, content["edges"])
