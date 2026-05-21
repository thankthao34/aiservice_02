import json
import pickle
import re
import unicodedata
from pathlib import Path

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity


BASE_DIR = Path(__file__).resolve().parents[1]
VEC_PATH = BASE_DIR / "knowledge_base" / "kb_vectors.pkl"
DOC_PATH = BASE_DIR / "knowledge_base" / "kb_documents.json"

embedder = None
index = None

try:
    from sentence_transformers import SentenceTransformer

    embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    if VEC_PATH.exists():
        with open(VEC_PATH, "rb") as f:
            index = pickle.load(f)

    # Prevent stale vector usage when kb_documents.json has been updated.
    if index is not None and DOC_PATH.exists() and VEC_PATH.exists():
        if DOC_PATH.stat().st_mtime > VEC_PATH.stat().st_mtime:
            index = None
except Exception:
    embedder = None
    index = None


def _normalize(text: str) -> str:
    text = (text or "").strip().lower()
    text = text.replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _tokenize(text: str):
    return [w for w in _normalize(text).split(" ") if len(w) >= 2]


def _doc_text(doc: dict) -> str:
    tags = " ".join(doc.get("keywords") or [])
    return " ".join(
        [
            str(doc.get("title") or ""),
            str(doc.get("content") or ""),
            str(doc.get("segment") or ""),
            str(doc.get("main_category") or ""),
            str(doc.get("sub_category") or ""),
            str(doc.get("intent") or ""),
            tags,
        ]
    ).strip()


def _extract_focus_terms(query: str):
    q = _normalize(query)
    focus = []
    key_terms = [
        "macbook", "m3", "xps", "dell", "iphone", "s24", "samsung", "pixel",
        "ssd", "nvme", "sata", "laptop", "dien thoai", "phone", "tai nghe",
        "headphone", "earbuds", "monitor", "webcam", "gaming", "camera", "pin",
    ]
    for term in key_terms:
        if term in q:
            focus.append(term)
    return focus


TOPIC_KEYWORDS = {
    "laptop": ["laptop", "macbook", "xps", "dell", "vivobook", "ideapad", "pavilion", "gram"],
    "phone": ["dien thoai", "phone", "iphone", "s24", "samsung", "pixel", "xiaomi", "realme"],
    "audio": ["tai nghe", "headphone", "earbuds", "airpods", "sony", "mic", "am thanh"],
    "storage": ["ssd", "nvme", "sata", "hdd", "o cung", "luu tru", "4k"],
    "display": ["monitor", "man hinh", "webcam", "ultrawide"],
    "power": ["charger", "sac", "gan", "power bank"],
}


BRAND_FOCUS_TERMS = {
    "macbook", "m3", "xps", "dell", "iphone", "s24", "samsung", "pixel", "sony", "airpods"
}


def _infer_topics(text: str):
    t = _normalize(text)
    topics = set()
    for topic, keys in TOPIC_KEYWORDS.items():
        if any(k in t for k in keys):
            topics.add(topic)
    return topics


def _focus_match_count(doc: dict, focus_terms: list):
    if not focus_terms:
        return 0
    doc_text = _normalize(_doc_text(doc))
    return sum(1 for t in focus_terms if t in doc_text)


def _topic_score(query: str, doc: dict):
    q_topics = _infer_topics(query)
    if not q_topics:
        return 0.0
    doc_topics = _infer_topics(_doc_text(doc))
    if q_topics.intersection(doc_topics):
        return 0.14
    if doc_topics:
        return -0.36
    return -0.08


def _lexical_score(query: str, doc: dict):
    q_tokens = _tokenize(query)
    text = _normalize(_doc_text(doc))
    if not q_tokens:
        return 0.0

    token_hits = sum(1 for t in q_tokens if t in text)
    token_score = token_hits / max(1, len(set(q_tokens)))

    focus_terms = _extract_focus_terms(query)
    focus_hits = sum(1 for t in focus_terms if t in text)
    focus_score = (focus_hits / max(1, len(focus_terms))) if focus_terms else 0.0

    return 0.55 * token_score + 0.45 * focus_score


def _segment_bonus(doc: dict, segment: str = None):
    if not segment:
        return 0.0
    return 0.08 if doc.get("segment") == segment else 0.0


def _keyword_retrieve(query: str, segment: str = None, top_k: int = 3):
    with open(DOC_PATH, "r", encoding="utf-8") as f:
        docs = json.load(f)
    scored = []
    focus_terms = _extract_focus_terms(query)
    has_brand_focus = any(t in BRAND_FOCUS_TERMS for t in focus_terms)
    for d in docs:
        focus_hits = _focus_match_count(d, focus_terms)
        score = _lexical_score(query, d) + _segment_bonus(d, segment) + _topic_score(query, d)
        if has_brand_focus and focus_hits == 0:
            score -= 0.30
        scored.append({"doc": d, "score": score, "focus_hits": focus_hits})

    scored.sort(key=lambda x: x["score"], reverse=True)
    q_topics = _infer_topics(query)

    picked = []
    if has_brand_focus:
        focus_first = [r for r in scored if r["focus_hits"] > 0]
        for r in focus_first:
            picked.append(r["doc"])
            if len(picked) >= top_k:
                return picked

    if q_topics:
        topic_first = []
        neutral = []
        for r in scored:
            doc = r["doc"]
            d_topics = _infer_topics(_doc_text(doc))
            if d_topics.intersection(q_topics):
                topic_first.append(r)
            elif not d_topics:
                neutral.append(r)

        for r in topic_first + neutral:
            d = r["doc"]
            if d in picked:
                continue
            picked.append(d)
            if len(picked) >= top_k:
                break
        if picked:
            return picked[:top_k]

    for r in scored:
        d = r["doc"]
        if d in picked:
            continue
        picked.append(d)
        if len(picked) >= top_k:
            break
    return picked


def retrieve(query: str, segment: str = None, top_k: int = 3):
    # Ensure index is loaded if available (supports lazy creation of kb_vectors.pkl)
    try:
        global index
        if embedder is not None and index is None and VEC_PATH.exists():
            try:
                with open(VEC_PATH, "rb") as f:
                    loaded = pickle.load(f)
                # If documents changed after vectors were built we still prefer using the vectors
                index = loaded
                # small debug print to surface loading
                print(f"[RAG LOAD] Loaded index with {len(index.get('documents', []))} docs from {VEC_PATH}")
            except Exception:
                index = None
    except Exception:
        pass

    if embedder is None or index is None:
        return _keyword_retrieve(query, segment=segment, top_k=top_k)

    query_vec = embedder.encode([query])
    sims = cosine_similarity(query_vec, index["embeddings"])[0]
    ranked = np.argsort(sims)[::-1]
    results = []
    focus_terms = _extract_focus_terms(query)
    has_brand_focus = any(t in BRAND_FOCUS_TERMS for t in focus_terms)
    for idx in ranked:
        doc = index["documents"][idx]
        semantic_score = float(sims[idx])
        lexical_score = _lexical_score(query, doc)
        focus_hits = _focus_match_count(doc, focus_terms)

        score = 0.64 * semantic_score + 0.30 * lexical_score + _segment_bonus(doc, segment) + _topic_score(query, doc)

        if has_brand_focus and focus_hits == 0:
            score -= 0.28

        results.append({"doc": doc, "score": score, "focus_hits": focus_hits})

    results.sort(key=lambda x: x["score"], reverse=True)
    q_topics = _infer_topics(query)

    picked = []
    if has_brand_focus:
        focus_first = [r for r in results if r["focus_hits"] > 0]
        for r in focus_first:
            picked.append(r["doc"])
            if len(picked) >= top_k:
                return picked

    if q_topics:
        topic_first = []
        neutral = []
        for r in results:
            doc = r["doc"]
            d_topics = _infer_topics(_doc_text(doc))
            if d_topics.intersection(q_topics):
                topic_first.append(r)
            elif not d_topics:
                neutral.append(r)

        for r in topic_first + neutral:
            d = r["doc"]
            if d in picked:
                continue
            picked.append(d)
            if len(picked) >= top_k:
                break
        if picked:
            return picked[:top_k]

    for r in results:
        d = r["doc"]
        if d in picked:
            continue
        picked.append(d)
        if len(picked) >= top_k:
            break
    return picked
