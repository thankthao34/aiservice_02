from functools import lru_cache

from rag.generator import generate
from rag.retriever import retrieve


@lru_cache(maxsize=256)
def _rag_chat_cached(query: str, segment: str) -> tuple[str, tuple[str, ...], tuple[int, ...]]:
    relevant_docs = retrieve(query, segment=segment, top_k=2)
    answer = generate(query, relevant_docs, segment)
    sources = tuple(d.get("title", "") for d in relevant_docs)
    doc_ids = tuple(int(d.get("id")) for d in relevant_docs if d.get("id") is not None)
    return answer, sources, doc_ids


def rag_chat(query: str, segment: str) -> dict:
    normalized_query = (query or "").strip()
    normalized_segment = (segment or "").strip()
    answer, sources, doc_ids = _rag_chat_cached(normalized_query, normalized_segment)
    return {
        "answer": answer,
        "segment": normalized_segment,
        "sources": list(sources),
        "doc_ids": list(doc_ids),
    }
