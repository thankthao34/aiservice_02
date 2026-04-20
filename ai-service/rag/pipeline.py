from rag.generator import generate
from rag.retriever import retrieve


def rag_chat(query: str, segment: str) -> dict:
    relevant_docs = retrieve(query, segment=segment, top_k=3)
    answer = generate(query, relevant_docs, segment)
    return {
        "answer": answer,
        "segment": segment,
        "sources": [d["title"] for d in relevant_docs],
        "doc_ids": [d["id"] for d in relevant_docs],
    }
