from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from morphing.config import settings
from morphing.database import init_db
from morphing.api.routes import (
    ai_extraction,
    collections,
    comments,
    composer,
    creators,
    dependencies,
    elements,
    graph,
    morphing_route,
    relations,
    settings as settings_route,
    storyboard_route,
    versions,
    visual_route,
    votes,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Morphing API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(versions.router, prefix=settings.api_prefix)
app.include_router(elements.router, prefix=settings.api_prefix)
app.include_router(comments.router, prefix=settings.api_prefix)
app.include_router(votes.router, prefix=settings.api_prefix)
app.include_router(relations.router, prefix=settings.api_prefix)
app.include_router(graph.router, prefix=settings.api_prefix)
app.include_router(composer.router, prefix=settings.api_prefix)
app.include_router(storyboard_route.router, prefix=settings.api_prefix)
app.include_router(dependencies.router, prefix=settings.api_prefix)
app.include_router(ai_extraction.router, prefix=settings.api_prefix)
app.include_router(collections.router, prefix=settings.api_prefix)
app.include_router(morphing_route.router, prefix=settings.api_prefix)
app.include_router(visual_route.router, prefix=settings.api_prefix)
app.include_router(creators.router, prefix=settings.api_prefix)
app.include_router(settings_route.router, prefix=settings.api_prefix)

_media = Path(settings.media_root)
_media.mkdir(parents=True, exist_ok=True)
app.mount(f"{settings.api_prefix}/media", StaticFiles(directory=str(_media)), name="media")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
