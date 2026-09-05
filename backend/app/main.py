from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.db import Base, engine, SessionLocal
from app.core.config import settings
from app.services.seed import seed_all
from app.routes import auth, entities, network, cases, alerts_reports, imports, ai, firs, intelligence, timeline, locations, admin, evidence
from app.routes import settings as settings_route

app = FastAPI(title="DRISHYAM API", version="1.0.0",
              description="AI-Powered Criminal Network Intelligence System — SIH26189")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(entities.router)
app.include_router(network.router)
app.include_router(cases.router)
app.include_router(alerts_reports.router)
app.include_router(imports.router)
app.include_router(ai.router)
app.include_router(firs.router)
app.include_router(intelligence.router)
app.include_router(timeline.router)
app.include_router(locations.router)
app.include_router(admin.router)
app.include_router(settings_route.router)
app.include_router(evidence.router)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    if settings.AUTO_SEED:
        db = SessionLocal()
        try:
            result = seed_all(db)
            print(f"[DRISHYAM] Seed status: {result}")
        finally:
            db.close()


@app.get("/")
def root():
    return {
        "app": "DRISHYAM",
        "status": "online",
        "using_supabase": settings.USING_SUPABASE,
        "ai_provider": settings.AI_PROVIDER,
        "docs": "/docs",
    }


@app.get("/api/v2/health")
def health():
    return {"status": "ok"}
