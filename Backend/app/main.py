import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.content.loader import get_store
from app.db import init_db
from app.routers import auth, content, exercises, graphs, progress

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    if settings.jwt_secret == "dev-secret-change-me":
        log.warning("JWT_SECRET is not set – using an insecure development secret!")
    get_store()  # load + validate content at startup (fail fast)
    init_db()
    yield


app = FastAPI(
    title="TGD1 – studijní portál",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, content.router, progress.router, exercises.router, graphs.router):
    app.include_router(r)


@app.get("/api/health")
def health() -> dict:
    store = get_store()
    return {"status": "ok", "chapters": len(store.chapters), "items": len(store.items)}
