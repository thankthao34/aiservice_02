import requests
import json

URL = 'http://localhost:8000/chat'
PROMPTS = [
    "Xin chào — bạn là ai và có thể giúp mình gì?",
    "Mình cần tư vấn laptop khoảng 20 triệu, ưu tiên hiệu năng cho học và làm văn phòng",
    "Cửa hàng có bán kem chống nắng không? Nếu có, tư vấn loại cho da dầu.",
    "So sánh Samsung S24 và iPhone 15 — nếu ưu tiên chụp ảnh, chọn cái nào?",
    "Gợi ý 3 tai nghe giá rẻ dưới 500k, có link sản phẩm và giá.",
    "Cho mình danh sách 5 sản phẩm bán chạy nhất mục audio kèm giá.",
]

results = []
for p in PROMPTS:
    try:
        r = requests.post(URL, json={"user_id": 1, "message": p}, timeout=15)
        try:
            data = r.json()
        except Exception:
            data = {"status_text": r.text}
        results.append({"prompt": p, "status_code": r.status_code, "response": data})
    except Exception as e:
        results.append({"prompt": p, "error": str(e)})

with open('scripts/chat_test_results.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print('Done. Results saved to scripts/chat_test_results.json')
print('\nSummary:')
for r in results:
    if 'status_code' in r:
        print(r['prompt'][:60].replace('\n',' '), '->', r['status_code'])
    else:
        print(r['prompt'][:60].replace('\n',' '), '-> error')
