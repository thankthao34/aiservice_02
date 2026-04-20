from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ai_core.behavior_store import get_events, init_behavior_db, log_event
from ai_core.graph_recommender import get_user_behavior_graph_neo4j, sync_behavior_to_neo4j
from ai_core.hybrid_recommender import chatbot_hybrid, recommend_hybrid, train_lstm_from_behavior

router = APIRouter()


class BehaviorEventBody(BaseModel):
    user_id: int
    product_id: int
    action: str
    timestamp: str | None = None


class ChatbotBody(BaseModel):
    user_id: int
    query: str
    limit: int = 3


@router.on_event("startup")
def _bootstrap_behavior_db():
    init_behavior_db()


@router.post("/behavior/event")
def create_behavior_event(body: BehaviorEventBody):
    row = log_event(
        user_id=body.user_id,
        product_id=body.product_id,
        action=body.action,
        timestamp=body.timestamp,
    )
    return {"ok": True, "event": row}


@router.get("/behavior/events")
def list_behavior_events(user_id: int | None = Query(default=None), limit: int = Query(default=200, ge=1, le=2000)):
    return {"events": get_events(user_id=user_id, limit=limit)}


@router.post("/graph/sync-behavior")
def sync_behavior_graph(
    user_id: int | None = Query(default=None),
    limit: int = Query(default=5000, ge=1, le=50000),
    clear_existing: bool = Query(default=False),
):
    return sync_behavior_to_neo4j(limit=limit, user_id=user_id, clear_existing=clear_existing)


@router.get("/graph/user/{user_id}")
def get_user_behavior_graph(user_id: int, limit: int = Query(default=200, ge=1, le=2000)):
    return get_user_behavior_graph_neo4j(user_id=user_id, limit=limit)


@router.post("/ai/train-lstm")
def train_lstm(epochs: int = Query(default=5, ge=1, le=50)):
    return train_lstm_from_behavior(epochs=epochs)


@router.get("/recommend")
def recommend(user_id: int = Query(...), query: str = Query(default=""), limit: int = Query(default=10, ge=1, le=30)):
    result = recommend_hybrid(user_id=user_id, query=query, limit=limit)
    return {
        "user_id": user_id,
        "query": query,
        "items": [p.get("id") for p in result.get("products", [])],
        "products": result.get("products", []),
        "hybrid": {
            "weights": result.get("weights", {}),
            "scores": result.get("scores", {}),
        },
    }


@router.post("/chatbot")
def chatbot(body: ChatbotBody):
    result = chatbot_hybrid(user_id=body.user_id, query=body.query, limit=body.limit)
    return {
        "answer": result.get("answer", ""),
        "product_links": result.get("product_links", []),
        "hybrid": result.get("hybrid", {}),
    }
