from __future__ import annotations

import os
from typing import Dict, List

import requests

from ai_core.behavior_store import get_all_sequences, get_user_sequence
from ai_core.graph_recommender import graph_scores
from ai_core.lstm_sequence import markov_scores, predict_next_scores, train_sequence_model
from ai_core.vector_retriever import ProductVectorIndex

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://localhost:3001")
PRODUCT_SERVICE_URL = os.getenv("PRODUCT_SERVICE_URL", "http://localhost:3002")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5273")

W1 = float(os.getenv("HYBRID_W_LSTM", "0.45"))
W2 = float(os.getenv("HYBRID_W_GRAPH", "0.30"))
W3 = float(os.getenv("HYBRID_W_RAG", "0.25"))

_vector_index = ProductVectorIndex()


def _fetch_products() -> List[Dict]:
    try:
        rows = requests.get(f"{PRODUCT_SERVICE_URL}/", timeout=6).json()
        if isinstance(rows, list):
            return rows
        return []
    except Exception:
        return []


def _fetch_profile(user_id: int) -> Dict:
    try:
        profile = requests.get(f"{USER_SERVICE_URL}/profile/{int(user_id)}", timeout=6).json()
        if isinstance(profile, dict):
            return profile
    except Exception:
        pass
    return {}


def train_lstm_from_behavior(epochs: int = 5) -> Dict:
    products = _fetch_products()
    product_ids = [int(p["id"]) for p in products if p.get("id") is not None]
    sequences = get_all_sequences()
    return train_sequence_model(sequences=sequences, product_ids=product_ids, epochs=epochs)


def recommend_hybrid(user_id: int, query: str, limit: int = 10) -> Dict:
    products = _fetch_products()
    if not products:
        return {"products": [], "scores": {}, "weights": {"w1": W1, "w2": W2, "w3": W3}}

    by_id = {int(p["id"]): p for p in products if p.get("id") is not None}
    all_ids = list(by_id.keys())

    profile = _fetch_profile(user_id)
    behavior_seq = get_user_sequence(user_id)
    all_sequences = get_all_sequences()

    _vector_index.build(products)
    rag_map = _vector_index.search(query=query, top_k=100)

    lstm_map = predict_next_scores(behavior_seq, top_k=80)
    if not lstm_map:
        lstm_map = markov_scores(behavior_seq, all_sequences, top_k=80)

    graph_map = graph_scores(user_id=user_id, products=products, limit=100)

    final: Dict[int, float] = {}
    details: Dict[int, Dict] = {}
    for pid in all_ids:
        s_lstm = float(lstm_map.get(pid, 0.0))
        s_graph = float(graph_map.get(pid, 0.0))
        s_rag = float(rag_map.get(pid, 0.0))

        score = (W1 * s_lstm) + (W2 * s_graph) + (W3 * s_rag)

        # Segment/profile lightweight boost.
        seg = str(profile.get("segment") or "")
        price = float(by_id[pid].get("price") or 0)
        if seg == "cheap_hunter" and 0 < price <= 500:
            score += 0.04
        elif seg == "premium_user" and price >= 900:
            score += 0.05

        if score > 0:
            final[pid] = score
            details[pid] = {
                "lstm": round(s_lstm, 4),
                "graph": round(s_graph, 4),
                "rag": round(s_rag, 4),
                "final": round(score, 4),
            }

    ranked_ids = sorted(final.keys(), key=lambda pid: final[pid], reverse=True)[: max(1, int(limit))]
    ranked_products = [by_id[pid] for pid in ranked_ids]

    return {
        "products": ranked_products,
        "scores": {str(pid): details[pid] for pid in ranked_ids},
        "weights": {"w1": W1, "w2": W2, "w3": W3},
    }


def chatbot_hybrid(user_id: int, query: str, limit: int = 3) -> Dict:
    rec = recommend_hybrid(user_id=user_id, query=query, limit=limit)
    products = rec.get("products") or []

    if not products:
        answer = (
            "Minh chua tim duoc san pham phu hop. Ban thu mo ta ro hon ngan sach,"
            " muc dich su dung va uu tien (camera/pin/hieu nang) nhe."
        )
        return {
            "answer": answer,
            "product_links": [],
            "hybrid": rec,
        }

    picks = products[: max(1, int(limit))]
    links = [
        {
            "id": p.get("id"),
            "name": p.get("name"),
            "price": p.get("price"),
            "url": f"{FRONTEND_BASE_URL}/product/{p.get('id')}",
        }
        for p in picks
    ]

    names = ", ".join(str(p.get("name")) for p in picks if p.get("name"))
    answer = (
        f"Theo hanh vi va truy van cua ban, minh de xuat: {names}. "
        "Ban co the mo link de xem chi tiet, neu can minh se loc tiep theo ngan sach cu the."
    )

    return {
        "answer": answer,
        "product_links": links,
        "hybrid": rec,
    }
