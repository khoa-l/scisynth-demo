"""The SciSynth API: the app, and the routers that make it up."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.types import Scope

from db import init_db
from routes import components, observe, studies, tasks


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="SciSynth API", lifespan=lifespan)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


for module in (studies, tasks, observe, components):
    app.include_router(module.router)


class SinglePage(StaticFiles):
    """The built frontend; a path with no file extension that is not found is a page the browser routes itself."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            response = await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
            response = Response(status_code=404)
        if response.status_code == 404 and not path.startswith("api/") and "." not in path:
            return await super().get_response("index.html", scope)
        return response


# set where the frontend is built (the Docker image); in development Nuxt serves it
FRONTEND = os.environ.get("FRONTEND_DIR")
if FRONTEND and Path(FRONTEND).is_dir():
    app.mount("/", SinglePage(directory=FRONTEND, html=True), name="frontend")
