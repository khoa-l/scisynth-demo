import os

from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.frontend import SinglePageApp
from app.routers import auth, datasets, health, projects, surveys


def generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


app = FastAPI(title="SciSynth API", generate_unique_id_function=generate_unique_id)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(datasets.router, prefix="/api")
app.include_router(surveys.router, prefix="/api")

frontend_dir = os.environ.get("FRONTEND_DIR")
if frontend_dir:
    app.mount("/", SinglePageApp(directory=frontend_dir, html=True), name="frontend")
