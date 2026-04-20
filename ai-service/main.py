from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ai_core.behavior_store import init_behavior_db
from routes.segment import router as segment_router
from routes.recommend import router as recommend_router
from routes.chat import router as chat_router
from routes.hybrid_ai import router as hybrid_ai_router

app = FastAPI(title="AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "service": "ai-service"}


@app.on_event("startup")
def startup_bootstrap():
    init_behavior_db()


app.include_router(segment_router)
app.include_router(recommend_router)
app.include_router(chat_router)
app.include_router(hybrid_ai_router)
