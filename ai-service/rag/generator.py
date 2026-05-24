import os
import re
from typing import List, Dict

import google.generativeai as genai


genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.0-flash"))
MAX_DOC_CHARS = 320

SEG_DESC = {
    "cheap_hunter": "khách hàng ưa thích sản phẩm giá rẻ, tiết kiệm",
    "normal_user": "khách hàng thông thường, cân bằng giá và chất lượng",
    "premium_user": "khách hàng cao cấp, ưu tiên flagship",
}


def _extract_text(resp) -> str:
    # Gemini SDK may return content in different shapes depending on model/safety.
    text = getattr(resp, "text", None)
    if text and text.strip():
        return text.strip()

    candidates = getattr(resp, "candidates", None) or []
    for cand in candidates:
        content = getattr(cand, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            ptext = getattr(part, "text", None)
            if ptext and ptext.strip():
                return ptext.strip()
    return ""


def _compact_doc(doc: Dict) -> str:
    title = str(doc.get("title") or "").strip()
    content = re.sub(r"\s+", " ", str(doc.get("content") or "").strip())
    if len(content) > MAX_DOC_CHARS:
        content = content[:MAX_DOC_CHARS].rsplit(" ", 1)[0].strip()
        if content:
            content += "..."
    return f"[{title}]\n{content}" if content else f"[{title}]"


def _fallback_answer(query: str, context_docs: List[Dict], segment: str) -> str:
    titles = [d.get("title", "") for d in context_docs[:3] if d.get("title")]
    top_title = titles[0] if titles else "gợi ý phù hợp"

    budget_hint = ""
    q = query.lower()
    m_vnd = re.search(r"(\d+[\.,]?\d*)\s*(trieu|triệu|nghin|nghìn|dong|đồng)", q)
    if m_vnd:
        budget_hint = f" Với ngân sách quanh {m_vnd.group(1)} {m_vnd.group(2)}, bạn nên ưu tiên sản phẩm có tỷ lệ giá/giá trị tốt."
    else:
        m_usd = re.search(r"(\d+[\.,]?\d*)\s*(usd|\$)", q)
        if m_usd:
            amount = float(m_usd.group(1).replace(',', '.'))
            vnd = amount * 25000
            if vnd >= 1_000_000:
                budget_hint = f" Với ngân sách khoảng {vnd / 1_000_000:.1f} triệu đồng, bạn nên ưu tiên sản phẩm có tỷ lệ giá/giá trị tốt."
            else:
                budget_hint = f" Với ngân sách khoảng {vnd / 1_000:.0f} nghìn đồng, bạn nên ưu tiên sản phẩm có tỷ lệ giá/giá trị tốt."

    segment_hint = {
        "cheap_hunter": "Bạn thuộc nhóm tiết kiệm, nên ưu tiên deal tốt và phụ kiện cần thiết trước.",
        "normal_user": "Bạn thuộc nhóm cân bằng, nên chọn sản phẩm ổn định, dễ sử dụng lâu dài.",
        "premium_user": "Bạn thuộc nhóm cao cấp, nên ưu tiên flagship và trải nghiệm tổng thể.",
    }.get(segment, "")

    suggest_line = ""
    if titles:
        suggest_line = f" Bạn có thể cân nhắc: {', '.join(titles)}."

    # Include short summaries from the context documents to make fallback richer
    doc_summaries = []
    for d in context_docs[:3]:
        title = d.get('title')
        content = (d.get('content') or '').strip()
        if not title or not content:
            continue
        # Take first 1-2 sentence-like fragments as a concise point
        s = re.split(r'[\.\!\?]\s+', content)
        first = s[0].strip() if s else ''
        second = s[1].strip() if len(s) > 1 else ''
        snippet = first
        if second:
            snippet = f"{first}. {second}"
        doc_summaries.append(f"- {title}: {snippet}")

    sources_line = f"\nTóm tắt tham khảo:\n{chr(10).join(doc_summaries)}" if doc_summaries else ""
    return (
        f"Theo câu hỏi của bạn, mình đề xuất bắt đầu với {top_title}."
        f" {segment_hint}{budget_hint}{suggest_line}"
        f" Nếu bạn muốn, mình sẽ lọc tiếp theo mức giá, nhu cầu (học tập/giải trí/công việc) và thương hiệu bạn thích."
        f"{sources_line}"
    ).strip()


def generate(query: str, context_docs: list, segment: str) -> str:
    compact_docs = [_compact_doc(d) for d in (context_docs or [])[:2]]
    context = "\n\n".join(compact_docs)
    prompt = f"""Bạn là trợ lý tư vấn mua sắm điện tử của NEXUS Store.

KHÁCH HÀNG: {segment} - {SEG_DESC.get(segment, '')}

TÀI LIỆU TƯ VẤN:
{context}

CÂU HỎI: {query}

Trả lời ngắn gọn 3-5 câu, thân thiện, bằng tiếng Việt có dấu.
Chỉ dùng nghìn đồng hoặc triệu đồng khi nhắc giá, không dùng USD hoặc ký hiệu $.
Ưu tiên ngữ cảnh cập nhật theo năm 2026, không nhắc năm 2024 nếu không được yêu cầu.
Nêu rõ 1-3 gợi ý sản phẩm phù hợp với phân loại khách hàng."""
    try:
        resp = gemini.generate_content(
            prompt,
            generation_config={
                "temperature": 0.35,
                "top_p": 0.9,
                "max_output_tokens": 220,
            },
        )
        text = _extract_text(resp)
        if text:
            return text
        print("[WARN] Gemini returned empty text, using fallback")
        return _fallback_answer(query, context_docs, segment)
    except Exception as exc:
        print(f"[WARN] Gemini generate failed: {exc}")
        return _fallback_answer(query, context_docs, segment)
