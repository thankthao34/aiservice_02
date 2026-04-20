from __future__ import annotations

from typing import Dict, List

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class ProductVectorIndex:
    def __init__(self):
        self._vec = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
        self._product_ids: List[int] = []
        self._matrix = None

    def build(self, products: List[Dict]):
        docs = []
        ids = []
        for p in products:
            pid = p.get("id")
            if pid is None:
                continue
            text = " ".join(
                [
                    str(p.get("name") or ""),
                    str(p.get("description") or ""),
                    str(p.get("brand") or ""),
                    str(p.get("main_category") or ""),
                    str(p.get("sub_category") or p.get("category") or ""),
                ]
            )
            docs.append(text)
            ids.append(int(pid))

        self._product_ids = ids
        if docs:
            self._matrix = self._vec.fit_transform(docs)
        else:
            self._matrix = None

    def search(self, query: str, top_k: int = 50) -> Dict[int, float]:
        if self._matrix is None or not self._product_ids:
            return {}

        q = self._vec.transform([str(query or "")])
        sims = cosine_similarity(q, self._matrix)[0]

        order = sims.argsort()[::-1][: max(1, int(top_k))]
        out: Dict[int, float] = {}
        for idx in order:
            score = float(sims[idx])
            if score <= 0:
                continue
            out[self._product_ids[int(idx)]] = score

        if not out:
            return {}

        max_score = max(out.values()) or 1.0
        return {pid: s / max_score for pid, s in out.items()}
