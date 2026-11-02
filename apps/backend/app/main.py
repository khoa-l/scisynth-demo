from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.routers import health


def generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


app = FastAPI(title="SciSynth API", generate_unique_id_function=generate_unique_id)

app.include_router(health.router, prefix="/api")
