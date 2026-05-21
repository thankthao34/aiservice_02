from __future__ import annotations

import os
import re
from typing import Dict, List

import unicodedata

import requests

from ai_core.behavior_store import get_all_sequences, get_user_sequence
from ai_core.graph_recommender import graph_scores
from ai_core.lstm_sequence import markov_scores, predict_next_scores, train_sequence_model
from ai_core.vector_retriever import ProductVectorIndex

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://user-service:3001")
PRODUCT_SERVICE_URL = os.getenv("PRODUCT_SERVICE_URL", "http://product-service:3002")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5273")

W1 = float(os.getenv("HYBRID_W_LSTM", "0.45"))
W2 = float(os.getenv("HYBRID_W_GRAPH", "0.30"))
W3 = float(os.getenv("HYBRID_W_RAG", "0.25"))

_vector_index = ProductVectorIndex()

MAIN_CATEGORY_KEYWORDS = {
    'electronics': ['cong nghe', 'electronics', 'dien tu', 'do dien tu'],
    'fashion': ['thoi trang', 'fashion', 'ao', 'quan', 'giay dep'],
    'beauty': ['my pham', 'lam dep', 'beauty', 'son moi', 'kem nen', 'chong nang'],
    'home-living': ['nha cua', 'noi that', 'gia dung', 'home living'],
    'appliances': ['dien lanh', 'dieu hoa', 'tu lanh', 'may giat'],
    'mom-baby': ['me va be', 'me be', 'so sinh', 'ta bim'],
    'sports-outdoor': ['the thao', 'du lich', 'outdoor'],
    'books-stationery': ['sach', 'van phong pham'],
    'grocery': ['bach hoa', 'do uong', 'thuc pham'],
    'pet-care': ['thu cung', 'pet'],
    'automotive': ['o to', 'xe may', 'phu kien xe'],
    'office-supplies': ['van phong', 'office supply']
}

SUBCATEGORY_MAIN_MAP = {
    'laptop': 'electronics',
    'phone': 'electronics',
    'mobile': 'electronics',
    'tablet': 'electronics',
    'audio': 'electronics',
    'monitor': 'electronics',
    'camera': 'electronics',
    'storage': 'electronics',
    'networking': 'electronics',
    'accessory': 'electronics',
    'ao': 'fashion',
    'quan': 'fashion',
    'giay-dep': 'fashion',
    'tui-xach': 'fashion',
    'phu-kien-thoi-trang': 'fashion',
    'son-moi': 'beauty',
    'kem-nen': 'beauty',
    'cham-soc-da': 'beauty',
    'nuoc-hoa': 'beauty',
    'do-bep': 'home-living',
    'noi-that': 'home-living',
    'trang-tri-nha': 'home-living',
    'gia-dung': 'home-living',
    'dieu-hoa': 'appliances',
    'tu-lanh': 'appliances',
    'may-giat': 'appliances',
    'may-loc-khong-khi': 'appliances',
    'ta-bim': 'mom-baby',
    'do-so-sinh': 'mom-baby',
    'sua-bot': 'mom-baby',
    'gym-fitness': 'sports-outdoor',
    'the-thao-ngoai-troi': 'sports-outdoor',
    'phu-kien-du-lich': 'sports-outdoor',
    'sach': 'books-stationery',
    'van-phong-pham': 'books-stationery',
    'qua-luu-niem': 'books-stationery',
    'thuc-pham-kho': 'grocery',
    'do-uong': 'grocery',
    'do-an-vat': 'grocery',
    'thuc-an-thu-cung': 'pet-care',
    'phu-kien-thu-cung': 'pet-care',
    'phu-kien-xe': 'automotive',
    'cham-soc-xe': 'automotive',
    'office': 'office-supplies',
    'ban-phim': 'office-supplies',
    'chuot': 'office-supplies',
}


def _normalize(text: str) -> str:
    text = (text or '').strip().lower()
    text = text.replace('đ', 'd').replace('Đ', 'D')
    text = unicodedata.normalize('NFD', text)
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def _contains_keyword(query_norm: str, keyword: str) -> bool:
    k = _normalize(keyword)
    if not k:
        return False
    if ' ' in k:
        return k in query_norm
    if len(k) <= 3:
        return k in query_norm.split(' ')
    return k in query_norm


def _product_main_category(product: Dict) -> str:
    return _normalize(str(product.get('main_category') or '')).replace(' ', '-')


def _product_sub_category(product: Dict) -> str:
    return _normalize(str(product.get('sub_category') or product.get('category') or '')).replace(' ', '-')


def _guess_query_category(query: str):
    q = _normalize(query)
    detected_sub = None
    for sub_key, keywords in {
        'laptop': ['laptop', 'macbook', 'notebook'],
        'phone': ['dien thoai', 'phone', 'iphone', 'samsung', 'pixel', 'realme', 'xiaomi'],
        'mobile': ['mobile'],
        'tablet': ['tablet', 'ipad'],
        'audio': ['tai nghe', 'headphone', 'earbuds', 'loa', 'speaker'],
        'monitor': ['monitor', 'man hinh'],
        'camera': ['camera', 'may anh'],
        'storage': ['ssd', 'nvme', 'hdd', 'o cung', 'luu tru'],
        'networking': ['router', 'wifi', 'mesh'],
        'accessory': ['phu kien', 'chuot', 'mouse', 'ban phim', 'keyboard', 'charger', 'sac', 'webcam', 'hub', 'cable'],
        'ao': ['ao thun', 'ao so mi', 'ao khoac', 'ao'],
        'quan': ['quan jeans', 'quan tay', 'quan short', 'quan'],
        'giay-dep': ['giay', 'dep', 'sneaker'],
        'tui-xach': ['tui xach', 'tui deo', 'balo', 'vi'],
        'phu-kien-thoi-trang': ['that lung', 'mu non', 'kinh mat', 'phu kien thoi trang'],
        'son-moi': ['son', 'son moi', 'lipstick', 'lip tint'],
        'kem-nen': ['kem nen', 'foundation', 'cushion'],
        'cham-soc-da': ['serum', 'sua rua mat', 'duong am', 'cham soc da', 'skincare', 'chong nang'],
        'nuoc-hoa': ['nuoc hoa', 'perfume', 'mui huong'],
        'do-bep': ['do bep', 'noi', 'chao', 'dao', 'thot'],
        'noi-that': ['noi that', 'ban ghe', 'tu ke'],
        'trang-tri-nha': ['trang tri nha', 'decor', 'den trang tri'],
        'gia-dung': ['gia dung', 'am sieu toc', 'ban ui', 'may hut bui'],
        'dieu-hoa': ['dieu hoa', 'may lanh'],
        'tu-lanh': ['tu lanh'],
        'may-giat': ['may giat'],
        'may-loc-khong-khi': ['may loc khong khi', 'air purifier'],
        'ta-bim': ['ta bim', 'bim', 'ta'],
        'do-so-sinh': ['do so sinh', 'quan ao so sinh'],
        'sua-bot': ['sua bot', 'sua cong thuc'],
        'gym-fitness': ['gym', 'fitness', 'tap ta', 'yoga'],
        'the-thao-ngoai-troi': ['the thao ngoai troi', 'bong da', 'cau long', 'chay bo'],
        'phu-kien-du-lich': ['vali', 'balo du lich', 'phu kien du lich'],
        'sach': ['sach', 'truyen'],
        'van-phong-pham': ['vo', 'but', 'so tay', 'van phong pham'],
        'qua-luu-niem': ['qua luu niem', 'gift'],
        'thuc-pham-kho': ['gao', 'mi', 'thuc pham kho'],
        'do-uong': ['nuoc ngot', 'tra', 'ca phe', 'do uong'],
        'do-an-vat': ['banh snack', 'do an vat'],
        'thuc-an-thu-cung': ['thuc an thu cung', 'hat cho', 'pate meo'],
        'phu-kien-thu-cung': ['vong co', 'day dat', 'cat ve sinh', 'phu kien thu cung'],
        'phu-kien-xe': ['phu kien xe', 'dash cam', 'gia do dien thoai xe'],
        'cham-soc-xe': ['cham soc xe', 'rua xe', 'bao duong xe'],
        'office': ['van phong', 'office'],
        'ban-phim': ['ban phim', 'keyboard'],
        'chuot': ['chuot', 'mouse'],
    }.items():
        if any(_contains_keyword(q, k) for k in keywords):
            detected_sub = sub_key
            break

    detected_main = SUBCATEGORY_MAIN_MAP.get(detected_sub) if detected_sub else None
    if not detected_main:
        for main_key, keywords in MAIN_CATEGORY_KEYWORDS.items():
            if any(_contains_keyword(q, k) for k in keywords):
                detected_main = main_key
                break

    if not detected_main and not detected_sub:
        return None

    return {
        'main_category': detected_main,
        'sub_category': detected_sub,
    }


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

    query_intent = _guess_query_category(query)
    if query_intent:
        intent_main = query_intent.get('main_category')
        intent_sub = query_intent.get('sub_category')
        intent_products = []
        for product in products:
            if intent_sub and _product_sub_category(product) == intent_sub:
                intent_products.append(product)
                continue
            if intent_main and _product_main_category(product) == intent_main:
                intent_products.append(product)

        if intent_products:
            intent_ids = {int(p.get('id')) for p in intent_products if p.get('id') is not None}
            matched_ranked = [p for p in ranked_products if int(p.get('id') or 0) in intent_ids]
            matched_ids = {int(p.get('id') or 0) for p in matched_ranked}
            missing_intent = [p for p in intent_products if int(p.get('id') or 0) not in matched_ids]
            ranked_products = (
                matched_ranked
                + missing_intent
                + [p for p in ranked_products if int(p.get('id') or 0) not in intent_ids]
            )[: max(1, int(limit))]

    ranked_ids = [int(p['id']) for p in ranked_products if p.get('id') is not None]
    for pid in ranked_ids:
        details.setdefault(pid, {"lstm": 0.0, "graph": 0.0, "rag": 0.0, "final": 0.0})

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
