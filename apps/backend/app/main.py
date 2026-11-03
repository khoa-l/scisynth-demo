import os

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.routing import APIRoute

from app.frontend import SinglePageApp
from app.routers import auth, datasets, health, previews, projects, public, surveys


def generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


app = FastAPI(title="SciSynth API", generate_unique_id_function=generate_unique_id)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(datasets.router, prefix="/api")
app.include_router(surveys.router, prefix="/api")
app.include_router(public.router, prefix="/api")
app.include_router(previews.router, prefix="/api")

frontend_dir = os.environ.get("FRONTEND_DIR")
if frontend_dir:
    app.mount("/", SinglePageApp(directory=frontend_dir, html=True), name="frontend")
