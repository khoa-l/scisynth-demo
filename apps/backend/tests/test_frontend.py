from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.frontend import SinglePageApp


def frontend_client(tmp_path: Path) -> TestClient:
    (tmp_path / "index.html").write_text("<div id=app></div>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "main.js").write_text("console.log('app')")

    app = FastAPI()

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.mount("/", SinglePageApp(directory=tmp_path, html=True))
    return TestClient(app)


def test_serves_index_at_root(tmp_path: Path) -> None:
    response = frontend_client(tmp_path).get("/")
    assert response.status_code == 200
    assert response.text == "<div id=app></div>"


def test_serves_built_assets(tmp_path: Path) -> None:
    response = frontend_client(tmp_path).get("/assets/main.js")
    assert response.status_code == 200
    assert response.text == "console.log('app')"


def test_serves_index_for_app_routes(tmp_path: Path) -> None:
    response = frontend_client(tmp_path).get("/project/abc/datasets")
    assert response.status_code == 200
    assert response.text == "<div id=app></div>"


def test_api_routes_take_priority(tmp_path: Path) -> None:
    assert frontend_client(tmp_path).get("/api/health").json() == {"status": "ok"}


def test_unknown_api_paths_are_not_found(tmp_path: Path) -> None:
    assert frontend_client(tmp_path).get("/api/missing").status_code == 404
