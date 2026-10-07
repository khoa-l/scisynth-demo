"""The SciSynth API: the app, and the routers that make it up."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

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
