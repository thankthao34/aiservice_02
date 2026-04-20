import json
import pickle

from sentence_transformers import SentenceTransformer


with open("kb_documents.json", "r", encoding="utf-8") as f:
    documents = json.load(f)

embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")


def _doc_to_text(doc: dict) -> str:
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


texts = [_doc_to_text(d) for d in documents]
embeddings = embedder.encode(texts, show_progress_bar=True)

with open("kb_vectors.pkl", "wb") as f:
    pickle.dump({"documents": documents, "embeddings": embeddings}, f)

print(f"Built index for {len(documents)} documents")
