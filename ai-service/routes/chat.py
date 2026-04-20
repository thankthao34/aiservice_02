import os
import re
import time
import unicodedata
from typing import List

import requests
from fastapi import APIRouter
from pydantic import BaseModel

try:
    from neo4j import GraphDatabase
except Exception:  # pragma: no cover
    GraphDatabase = None

router = APIRouter()
USER_SERVICE_URL = os.getenv('USER_SERVICE_URL', 'http://localhost:3001')
PRODUCT_SERVICE_URL = os.getenv('PRODUCT_SERVICE_URL', 'http://localhost:3002')
FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL', 'http://localhost:5273')
NEO4J_URI = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
NEO4J_USER = os.getenv('NEO4J_USER', 'neo4j')
NEO4J_PASSWORD = os.getenv('NEO4J_PASSWORD', 'neo4j12345')

SEGMENT_PRODUCT_MAP = {
    'cheap_hunter': [15, 16, 17, 18],
    'normal_user': [3, 8, 10, 11],
    'premium_user': [1, 2, 6, 7],
}

INTENT_KEYWORDS = {
    'workspace': ['goc lam viec', 'góc làm việc', 'home office', 'tai nha', 'tại nhà', 'setup', 'nang cap', 'nâng cấp'],
    'storage': ['ssd', 'nvme', 'o cung', 'ổ cứng', 'hard drive', 'luu tru', 'lưu trữ', '4k'],
    'audio': ['tai nghe', 'headphone', 'earbuds', 'loa', 'speaker', 'mic'],
    'display': ['monitor', 'man hinh', 'màn hình', 'ultrawide', 'webcam'],
    'power': ['sac', 'sạc', 'charger', 'gan', 'power bank'],
}

INTENT_PRODUCT_HINTS = {
    'workspace': ['monitor', 'keyboard', 'mouse', 'webcam', 'router', 'hub'],
    'storage': ['ssd', 'nvme', 'hdd', 'hard drive', 'portable'],
    'audio': ['tai nghe', 'headphone', 'earbuds', 'speaker', 'mic'],
    'display': ['monitor', 'ultrawide', 'webcam', 'camera'],
    'power': ['charger', 'gan', 'sac', 'sạc', 'power bank', 'cable'],
}

INTENT_SOURCES = {
    'workspace': 'Huong dan setup goc lam viec tai nha',
    'storage': 'Tu van SSD/HDD cho cong viec video',
    'audio': 'Danh gia tai nghe/loa cho lam viec va giai tri',
    'display': 'Tu van man hinh va webcam cho home office',
    'power': 'Tu van sac nhanh va phu kien nguon',
}

MAIN_CATEGORY_KEYWORDS = {
    'electronics': ['cong nghe', 'electronics', 'dien tu', 'do dien tu'],
    'fashion': ['thoi trang', 'fashion', 'ao', 'quan', 'giay dep'],
    'beauty': ['my pham', 'lam dep', 'beauty', 'son moi', 'kem nen'],
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

SUBCATEGORY_KEYWORDS = {
    'laptop': ['laptop', 'macbook', 'notebook'],
    'phone': ['dien thoai', 'phone', 'iphone', 'samsung', 'pixel', 'realme', 'xiaomi'],
    'mobile': ['mobile'],
    'tablet': ['tablet', 'ipad'],
    'audio': ['tai nghe', 'headphone', 'earbuds', 'loa', 'speaker'],
    'monitor': ['monitor', 'man hinh'],
    'camera': ['camera', 'may anh'],
    'storage': ['ssd', 'nvme', 'hdd', 'o cung', 'luu tru'],
    'networking': ['router', 'wifi', 'mesh'],
    'accessory': ['phu kien', 'cap', 'cable', 'op lung', 'webcam', 'chuot', 'mouse', 'ban phim', 'keyboard', 'charger', 'sac'],
    'ao': ['ao thun', 'ao so mi', 'ao khoac', 'ao'],
    'quan': ['quan jeans', 'quan tay', 'quan short', 'quan'],
    'giay-dep': ['giay', 'dep', 'sneaker'],
    'tui-xach': ['tui xach', 'tui deo', 'balo', 'vi'],
    'phu-kien-thoi-trang': ['that lung', 'mu non', 'kinh mat', 'phu kien thoi trang'],
    'son-moi': ['son', 'son moi', 'lipstick', 'lip tint'],
    'kem-nen': ['kem nen', 'foundation', 'cushion'],
    'cham-soc-da': ['serum', 'sua rua mat', 'duong am', 'cham soc da', 'skincare'],
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
    'chuot': ['chuot', 'mouse']
}

SUBCATEGORY_MAIN_MAP = {
    'phone': 'electronics',
    'mobile': 'electronics',
    'laptop': 'electronics',
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
    'chuot': 'office-supplies'
}

QUESTION_KEYWORDS = [
    '?', 'gi', 'nao', 'sao', 'the nao', 'co nen', 'nen', 'hay', 'hoac', 'hoặc',
    'tu van', 'tư vấn', 'goi y', 'gợi ý', 'de xuat', 'đề xuất', 'so sanh', 'so sánh',
]

ADVICE_KEYWORDS = [
    'tu van', 'tư vấn', 'nen mua', 'nên mua', 'nen chon', 'nên chọn',
    'phu hop', 'phù hợp', 'goi y', 'gợi ý', 'muon mua', 'muốn mua', 'phan van', 'phân vân',
]

FEATURE_HINTS = {
    'camera': ['camera', 'chup', 'chụp', 'quay video', 'video'],
    'battery': ['pin', 'thoi luong', 'thời lượng', 'sac', 'sạc'],
    'gaming': ['gaming', 'game', 'fps'],
    'performance': ['hieu nang', 'hiệu năng', 'chip', 'cpu', 'gpu'],
    'display': ['man hinh', 'màn hình', 'oled', 'amoled', 'hz'],
    'work': ['van phong', 'văn phòng', 'office', 'hoc tap', 'học tập', 'do hoa', 'đồ họa'],
}

FEATURE_LABELS = {
    'camera': 'camera',
    'battery': 'pin',
    'gaming': 'choi game',
    'performance': 'hieu nang',
    'display': 'man hinh',
    'work': 'cong viec/do hoa',
}

PRODUCT_CACHE_TTL_SEC = 20
_PRODUCT_CACHE = {
    'ts': 0.0,
    'items': [],
}


def _neo4j_driver():
    if not GraphDatabase or not NEO4J_URI:
        return None
    try:
        return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    except Exception:
        return None


def _try_rag_answer(query: str, segment: str):
    try:
        from rag.pipeline import rag_chat

        result = rag_chat(query, segment)
        if not isinstance(result, dict):
            return None
        answer = (result.get('answer') or '').strip()
        if not answer:
            return None
        return {
            'answer': answer,
            'sources': result.get('sources') or [],
            'doc_ids': result.get('doc_ids') or [],
        }
    except Exception:
        return None


def _merge_sources(primary: list, secondary: list, max_items: int = 4):
    merged = []
    seen = set()
    for src in (primary or []) + (secondary or []):
        s = (src or '').strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        merged.append(s)
        if len(merged) >= max_items:
            break
    return merged


def _detect_price_tier(query: str):
    q = _normalize(query)
    premium_keys = ['cao cap', 'cao cấp', 'premium', 'flagship', 'pro max', 'ultra']
    budget_keys = ['re tien', 'rẻ tiền', 'gia re', 'giá rẻ', 'tiet kiem', 'tiết kiệm', 'budget']

    if any(k in q for k in premium_keys):
        return 'premium'
    if any(k in q for k in budget_keys):
        return 'budget'
    return None


def _contains_keyword(query_norm: str, keyword: str) -> bool:
    k = _normalize(keyword)
    if not k:
        return False
    if ' ' in k:
        return k in query_norm

    # Avoid false positives such as "loai" matching "loa".
    if len(k) <= 3:
        return k in query_norm.split(' ')
    return k in query_norm


def _normalize_category_key(value: str) -> str:
    # Category keys in taxonomy use slug format with hyphens.
    return _normalize(value).replace(' ', '-')


def _resolve_product_categories(product: dict):
    sub_category = _normalize_category_key(product.get('sub_category') or product.get('category'))
    main_category = _normalize_category_key(product.get('main_category') or SUBCATEGORY_MAIN_MAP.get(sub_category) or '')
    return main_category, sub_category


def _product_main_category(product: dict):
    return _resolve_product_categories(product)[0]


def _product_sub_category(product: dict):
    return _resolve_product_categories(product)[1]


def _guess_category_intent(query: str):
    q = _normalize(query)
    detected_sub = None
    for sub_key, keywords in SUBCATEGORY_KEYWORDS.items():
        if any(_contains_keyword(q, k) for k in keywords):
            detected_sub = sub_key
            break

    detected_main = None
    if detected_sub:
        detected_main = SUBCATEGORY_MAIN_MAP.get(detected_sub)
    else:
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


def _is_greeting(query: str) -> bool:
    q = _normalize(query)
    if 'xin chao' in q:
        return True

    tokens = q.split(' ')
    short_greetings = {'chao', 'hello', 'hi', 'hey'}
    return any(t in short_greetings for t in tokens)


def _is_question_query(query: str) -> bool:
    q_raw = (query or '').lower()
    q = _normalize(query)
    if '?' in q_raw:
        return True
    return any(k in q for k in QUESTION_KEYWORDS)


def _is_advice_query(query: str) -> bool:
    q = _normalize(query)
    return any(k in q for k in ADVICE_KEYWORDS)


def _is_cart_query(query: str) -> bool:
    q = _normalize(query)
    cart_keys = ['gio hang', 'giỏ hàng', 'cart', 'theo gio hang', 'theo giỏ hàng']
    return any(k in q for k in cart_keys)


def _is_out_of_scope(query: str) -> bool:
    q = _normalize(query)
    product_keywords = [
        'dien thoai', 'phone', 'laptop', 'macbook', 'phu kien', 'tai nghe', 'monitor',
        'ssd', 'hdd', 'chuot', 'mouse', 'ban phim', 'keyboard', 'sac', 'charger',
        'so sanh', 'goi y', 'nen chon', 'combo', 'gia', 'ngan sach', 'budget', 'premium',
        'camera', 'pin', 'hieu nang', 'man hinh', 'choi game', 'do hoa', 'van phong',
        'son', 'son moi', 'kem nen', 'skincare', 'nuoc hoa', 'ao', 'quan', 'giay',
        'ta bim', 'sua bot', 'thuc an thu cung', 'phu kien xe'
    ]
    return not any(_contains_keyword(q, k) for k in product_keywords)


def _extract_priority_features(query: str):
    q = _normalize(query)
    picked = []
    for feature, keys in FEATURE_HINTS.items():
        if any(_contains_keyword(q, k) for k in keys):
            picked.append(feature)
    return picked


def _extract_target_count(query: str, default: int = 3, max_items: int = 5) -> int:
    q = _normalize(query)
    # Only treat numbers as desired count when the query explicitly asks for suggestions/list.
    asks_list = any(
        _contains_keyword(q, k)
        for k in ['goi y', 'de xuat', 'top', 'tot nhat', 'liet ke', 'chon giup']
    )
    if not asks_list:
        return default

    m = re.search(r'\b([1-7])\b', q)
    if not m:
        if 'năm' in q or '5 ' in q:
            return 5
        return default
    return max(1, min(max_items, int(m.group(1))))


def _extract_budget_usd(query: str):
    q = _normalize(query)

    # VND shorthand, e.g. "20 triệu"
    m_vnd = re.search(r'(\d+[\.,]?\d*)\s*(trieu|triệu)', q)
    if m_vnd:
        million = float(m_vnd.group(1).replace(',', '.'))
        return (million * 1_000_000) / 25_000

    # USD style, e.g. "$800" or "800 usd"
    m_usd = re.search(r'(\d+[\.,]?\d*)\s*(usd|\$)', q)
    if m_usd:
        return float(m_usd.group(1).replace(',', '.'))

    return None


def _is_compare_query(query: str) -> bool:
    q = _normalize(query)
    return _contains_keyword(q, 'so sanh') or ('compare' in q) or (' vs ' in f' {q} ')


def _is_decision_query(query: str) -> bool:
    q = _normalize(query)
    asks_choice = ('nen chon' in q) or ('nên chọn' in q)
    has_or = (' hay ' in q) or (' hoac ' in q) or (' hoặc ' in q)
    return asks_choice and has_or


def _fetch_products_cached():
    now = time.time()
    if _PRODUCT_CACHE['items'] and (now - _PRODUCT_CACHE['ts'] <= PRODUCT_CACHE_TTL_SEC):
        return _PRODUCT_CACHE['items']

    try:
        rows = requests.get(f"{PRODUCT_SERVICE_URL}/", timeout=4).json()
        if isinstance(rows, list):
            _PRODUCT_CACHE['items'] = rows
            _PRODUCT_CACHE['ts'] = now
            return rows
    except Exception:
        pass

    return _PRODUCT_CACHE['items'] or []


def _fetch_products_by_category(main_category: str = None, sub_category: str = None):
    if not main_category and not sub_category:
        return []
    try:
        params = {}
        if main_category:
            params['mainCategory'] = main_category
        if sub_category:
            params['subCategory'] = sub_category
        rows = requests.get(f"{PRODUCT_SERVICE_URL}/", params=params, timeout=6).json()
        if isinstance(rows, list):
            return rows
    except Exception:
        pass
    return []


def _quality_bias(product: dict, query: str) -> float:
    name = _normalize(product.get('name', ''))
    category = _product_sub_category(product)
    score = 0.0

    # Prefer curated/base catalog entries to avoid odd synthetic variants.
    pid = int(product.get('id') or 0)
    if 1 <= pid <= 40:
        score += 3.0

    # Penalize synthetic laptop/phone variants with noisy naming.
    if category in ('phone', 'laptop') and ' gen ' in f' {name} ':
        score -= 2.5

    q = _normalize(query)
    if 'iphone' in q and 'iphone' in name:
        score += 4
    if 's24' in q and 's24' in name:
        score += 4
    if 'macbook' in q and 'macbook' in name:
        score += 4
    if 'xps' in q and 'xps' in name:
        score += 4
    return score


class ChatBody(BaseModel):
    user_id: int
    message: str
    search_context: str | None = None
    cart_product_ids: List[int] | None = None


def _guess_category(query: str):
    intent = _guess_category_intent(query)
    if not intent:
        return None
    return intent.get('sub_category')


def _normalize(text: str) -> str:
    text = (text or '').strip().lower()
    text = text.replace('đ', 'd').replace('Đ', 'D')
    text = unicodedata.normalize('NFD', text)
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def _build_workspace_combo(all_products: list, budget_usd):
    accessories = [p for p in all_products if _product_sub_category(p) == 'accessory']
    monitors = [p for p in accessories if any(k in _normalize(p.get('name', '')) for k in ['monitor', 'man hinh'])]
    webcams = [p for p in accessories if 'webcam' in _normalize(p.get('name', ''))]
    keyboards = [p for p in accessories if any(k in _normalize(p.get('name', '')) for k in ['keyboard', 'ban phim'])]

    if not monitors or not webcams or not keyboards:
        return []

    picks = [monitors[0], webcams[0], keyboards[0]]
    if budget_usd:
        total = sum(float(p.get('price') or 0) for p in picks)
        if total > budget_usd:
            monitors = sorted(monitors, key=lambda p: float(p.get('price') or 0))
            webcams = sorted(webcams, key=lambda p: float(p.get('price') or 0))
            keyboards = sorted(keyboards, key=lambda p: float(p.get('price') or 0))
            picks = [monitors[0], webcams[0], keyboards[0]]
    return picks


def _is_travel_laptop_query(query: str) -> bool:
    q = _normalize(query)
    travel_signals = ['di cong tac', 'di chuyen', 'mang di', 'laptop nhe', 'duoi 1 4kg', '1 4kg']
    battery_signals = ['pin', 'thoi luong', 'lau']
    has_travel = any(_contains_keyword(q, s) for s in travel_signals)
    has_battery = any(_contains_keyword(q, s) for s in battery_signals)
    return has_travel and has_battery and _contains_keyword(q, 'laptop')


def _augment_laptop_mobility_choices(products: list, catalog: list, target_count: int):
    if target_count <= 0:
        return products

    existing_ids = {p.get('id') for p in products if p.get('id') is not None}
    laptops = [p for p in (catalog or []) if _product_sub_category(p) == 'laptop']
    if not laptops:
        return products

    def mobility_score(p: dict) -> float:
        text = _normalize(f"{p.get('name', '')} {p.get('description', '')}")
        score = float(p.get('rating') or 0)

        # Prefer lightweight/productivity families; avoid bulky gaming-first models.
        for k in ['gram', 'air', 'ultrabook', 'zenbook', 'vivobook', 'xps 13', 'xps']:
            if k in text:
                score += 2.0
        for k in ['gaming', 'tuf', 'rog']:
            if k in text:
                score -= 1.8

        # Slightly prefer mid/high battery-friendly tiers instead of ultra-low end.
        price = float(p.get('price') or 0)
        if 500 <= price <= 1800:
            score += 0.6

        return score

    ranked = sorted(laptops, key=mobility_score, reverse=True)
    for p in ranked:
        pid = p.get('id')
        if pid in existing_ids:
            continue
        products.append(p)
        existing_ids.add(pid)
        if len(products) >= target_count:
            break
    return products


def _detect_intents(query: str):
    q = _normalize(query)
    intents = []
    for intent, keys in INTENT_KEYWORDS.items():
        if any(_contains_keyword(q, k) for k in keys):
            intents.append(intent)
    return intents


def _score_product(product: dict, query: str, guessed_category: str, intents: list):
    text = _normalize(f"{product.get('name', '')} {product.get('description', '')}")
    score = 0
    price = float(product.get('price') or 0)
    price_tier = _detect_price_tier(query)
    features = _extract_priority_features(query)

    if guessed_category and _product_sub_category(product) == guessed_category:
        score += 4

    for w in _normalize(query).split(' '):
        if len(w) >= 3 and w in text:
            score += 1

    for intent in intents:
        for hint in INTENT_PRODUCT_HINTS.get(intent, []):
            if _contains_keyword(text, hint):
                score += 4

    # Prefer products that align with requested feature priorities.
    for feature in features:
        for key in FEATURE_HINTS.get(feature, []):
            if _contains_keyword(text, key):
                score += 2

    # For workspace/setup queries, strongly prefer accessories over phones.
    if 'workspace' in intents:
        if _product_sub_category(product) == 'accessory':
            score += 3
        if _product_sub_category(product) == 'phone':
            score -= 2

    rating = float(product.get('rating') or 0)
    score += min(2, rating / 2)
    score += _quality_bias(product, query)

    # Separate opposite asks such as "cao cap" vs "re tien".
    if price_tier == 'premium':
        if price >= 900:
            score += 8
        elif price <= 550:
            score -= 9
    elif price_tier == 'budget':
        if price <= 500:
            score += 8
        elif price >= 900:
            score -= 9

    return score


def _compute_match_confidence(products: list, query: str, guessed_category: str, intents: list):
    if not products:
        return 0.0

    top = products[0]
    top_score = _score_product(top, query, guessed_category, intents)
    normalized = max(0.0, min(1.0, top_score / 20.0))

    # Fallback confidence for link-shaped products that only include name/price.
    q = _normalize(query)
    name = _normalize(top.get('name', ''))
    lexical_hits = 0
    for token in q.split(' '):
        if len(token) >= 3 and token in name:
            lexical_hits += 1

    lexical_conf = min(0.6, lexical_hits / 6.0)
    if _is_question_query(query):
        lexical_conf += 0.08

    price = float(top.get('price') or 0)
    tier = _detect_price_tier(query)
    if tier == 'premium' and price >= 800:
        lexical_conf += 0.18
    if tier == 'budget' and 0 < price <= 600:
        lexical_conf += 0.18

    return max(normalized, min(1.0, lexical_conf))


def _clean_compare_phrase(text: str) -> str:
    t = _normalize(text)
    t = re.sub(r'^(so sanh|giua|nen chon|tu van|cho toi|toi|hay)\s+', '', t)
    t = re.sub(r'\s+(nao|la gi|tot hon)$', '', t)
    return t.strip()


def _extract_compare_targets(query: str):
    q = _normalize(query)
    patterns = [
        r'giua\s+(.+?)\s+va\s+(.+)',
        r'so sanh\s+(.+?)\s+va\s+(.+)',
        r'(.+?)\s+vs\s+(.+)',
    ]
    for pat in patterns:
        m = re.search(pat, q)
        if not m:
            continue
        left = _clean_compare_phrase(m.group(1))
        right = _clean_compare_phrase(m.group(2))
        if left and right:
            return [left, right]
    return []


def _name_overlap_score(name_norm: str, target_norm: str) -> float:
    if not name_norm or not target_norm:
        return 0.0

    if target_norm in name_norm:
        return 6.0

    stop = {'gen', 'the', 'ban', 'mau', 'series', 'model'}
    name_tokens = [t for t in name_norm.split(' ') if len(t) >= 2 and t not in stop]
    target_tokens = [t for t in target_norm.split(' ') if len(t) >= 2 and t not in stop]
    if not target_tokens:
        return 0.0

    overlap = sum(1 for t in target_tokens if t in name_tokens)
    numeric_overlap = sum(1 for t in target_tokens if t.isdigit() and t in name_tokens)
    return overlap + (numeric_overlap * 1.5)


def _find_compare_products(all_products: list, query: str):
    q = _normalize(query)

    targets = _extract_compare_targets(query)
    if len(targets) == 2:
        chosen = []
        used = set()
        for target in targets:
            scored = []
            for p in all_products:
                name = _normalize(p.get('name', ''))
                s = _name_overlap_score(name, target)
                if s > 0:
                    scored.append((s + (_quality_bias(p, query) * 0.1), p))
            scored.sort(key=lambda x: x[0], reverse=True)
            for _, p in scored:
                pid = p.get('id')
                if pid in used:
                    continue
                used.add(pid)
                chosen.append(p)
                break
        if len(chosen) >= 2:
            return chosen[:2]

    candidates = []
    for p in all_products:
        name = _normalize(p.get('name', ''))
        hit = 0
        if 'iphone 15 pro' in q and 'iphone 15 pro' in name:
            hit += 6
        if ('s24 ultra' in q or 'samsung s24 ultra' in q) and ('s24 ultra' in name):
            hit += 6
        if 'macbook pro m3' in q and 'macbook pro m3' in name:
            hit += 6
        if 'dell xps 15' in q and 'dell xps 15' in name:
            hit += 6
        if 'samsung a54' in q and ('samsung a54' in name or 'a54' in name):
            hit += 6
        if 'nothing phone 2a' in q and ('nothing phone 2a' in name or ('nothing' in name and 'phone' in name)):
            hit += 6

        # Generic overlap fallback.
        for token in [
            'iphone', 'samsung', 's24', 'ultra', 'macbook', 'xps', 'dell', 'pro',
            'a54', 'nothing', 'phone', 'belkin', 'fitness', 'band', 'smartwatch', 'watch'
        ]:
            if token in q and token in name:
                hit += 1

        if hit > 0:
            candidates.append((hit + _quality_bias(p, query), p))

    candidates.sort(key=lambda x: x[0], reverse=True)
    picked = []
    seen = set()
    for _, p in candidates:
        pid = p.get('id')
        if pid in seen:
            continue
        seen.add(pid)
        picked.append(p)
        if len(picked) >= 2:
            break
    return picked


def _build_gaming_combo(all_products: list, budget_usd):
    laptops = [p for p in all_products if _product_sub_category(p) == 'laptop']
    accessories = [p for p in all_products if _product_sub_category(p) == 'accessory']

    laptops = sorted(laptops, key=lambda p: float(p.get('rating') or 0), reverse=True)
    mouse_candidates = [p for p in accessories if 'mouse' in _normalize(p.get('name', ''))]
    audio_candidates = [
        p for p in accessories
        if any(k in _normalize(p.get('name', '')) for k in ['headphone', 'earbuds', 'tai nghe'])
    ]

    if not laptops or not mouse_candidates or not audio_candidates:
        return []

    # Choose reasonable defaults first.
    combo = [laptops[0], mouse_candidates[0], audio_candidates[0]]

    if budget_usd:
        under_budget = [
            p for p in laptops
            if float(p.get('price') or 0) <= budget_usd * 0.85
        ]
        if under_budget:
            combo[0] = under_budget[0]

    return combo


def _compose_short_answer(query: str, products: list):
    if _is_greeting(query):
        return 'Xin chao, minh la tro ly mua sam cua NEXUS Store. Ban co the noi nhu cau, ngan sach va uu tien de minh tu van nhanh hon.'

    if _is_out_of_scope(query):
        return (
            'Minh co the tu van nhieu nganh hang (dien tu, thoi trang, my pham, gia dung, me va be, thu cung...). '
            'Ban chi can noi mon ban dang can, muc ngan sach va uu tien chinh de minh loc de xuat sat hon.'
        )

    if not products:
        return 'Mình chưa tìm thấy sản phẩm thật sự phù hợp từ câu hỏi này. Bạn cho mình ngân sách và ưu tiên chính để mình lọc lại nhanh hơn.'

    names = [p.get('name') for p in products[:5] if p.get('name')]
    if not names:
        return 'Mình đã lọc được danh sách phù hợp. Bạn mở phần gợi ý sản phẩm bên dưới để xem chi tiết giá và link.'

    shown_count = len(names)

    q = _normalize(query)
    price_tier = _detect_price_tier(query)
    features = _extract_priority_features(query)
    is_question = _is_question_query(query)
    is_advice = _is_advice_query(query)
    is_cart = _is_cart_query(query)

    if is_cart and names:
        if len(names) == 1:
            return (
                f"Minh da loc 1 goi y phu hop tu gio hang hien tai cua ban: {names[0]}. "
                'Neu ban muon, minh se mo rong them cac lua chon cung tam gia de ban so sanh nhanh.'
            )
        return (
            f"Minh da loc danh sach dua tren gio hang hien tai, uu tien mon bo tro/mon thay the de de mua kem: {', '.join(names[:3])}. "
            'Ban muon minh chia tiep theo 2 nhom: tiet kiem nhat va dang mua nhat khong?'
        )

    if _is_compare_query(query) and len(names) >= 2:
        if any(t in q for t in ['smartwatch', 'watch', 'fitness band', 'band thong minh']):
            return (
                f"So sánh nhanh {names[0]} và {names[1]}: nếu bạn ưu tiên theo dõi sức khỏe/chỉ số luyện tập thì nghiêng về mẫu có cảm biến đầy đủ hơn; "
                'nếu ưu tiên thời lượng pin dài và đeo nhẹ tay thì nghiêng về mẫu fitness band. '
                'Bạn có thể chốt theo mục tiêu chính là theo dõi thể thao hay nhận thông báo hằng ngày.'
            )

        if ('iphone' in q and 's24' in q) or ('iphone' in q and 'samsung' in q):
            return (
                f"So sánh nhanh {names[0]} và {names[1]} theo nhu cầu thực tế: "
                'camera chụp đêm và zoom thường lợi thế hơn ở dòng Ultra; '
                'quay video ổn định và hệ sinh thái lâu dài thường lợi thế hơn ở iPhone. '
                'Hiệu năng đều rất mạnh cho 3 năm sử dụng, bạn chọn theo ưu tiên camera/zoom hay video/iOS.'
            )

        left = names[0]
        right = names[1]
        has_macbook_left = 'macbook' in left.lower()
        has_macbook_right = 'macbook' in right.lower()
        macbook_name = left if has_macbook_left else (right if has_macbook_right else None)
        windows_name = right if has_macbook_left else (left if has_macbook_right else None)

        if macbook_name and windows_name:
            return (
                f"So sánh nhanh {left} và {right}: nếu bạn ưu tiên thiết kế đồ họa, pin bền và hệ sinh thái Apple thì nghiêng về {macbook_name}; "
                f"nếu bạn cần Windows, nhiều cổng kết nối và linh hoạt phần mềm kỹ thuật thì nghiêng về {windows_name}."
            )

        return (
            f"So sánh nhanh {names[0]} và {names[1]}: mình đã lọc đúng 2 mẫu bám sát câu hỏi của bạn. "
            f"Nếu bạn ưu tiên ổn định lâu dài và hệ sinh thái, ưu tiên {names[0]}; "
            f"nếu bạn ưu tiên tính linh hoạt nâng cấp/cổng kết nối, ưu tiên {names[1]}."
        )

    if _is_decision_query(query) and len(names) >= 2:
        if 'ssd' in q and ('nvme' in q or 'sata' in q):
            return (
                f"Với nhu cầu edit video 4K, bạn nên ưu tiên NVMe vì tốc độ xử lý file lớn tốt hơn SATA rõ rệt. "
                f"Mình gợi ý nhanh 3 lựa chọn phù hợp: {', '.join(names[:3])}."
            )

        if ('macbook' in q and 'xps' in q) or ('thiet ke do hoa' in q) or ('thiết kế đồ họa' in q):
            return (
                f"Nếu ưu tiên thiết kế đồ họa chuyên nghiệp, mình khuyên chọn {names[0] if 'macbook' in names[0].lower() else names[1]}. "
                'Lý do: hiệu năng ổn định khi làm việc lâu, màn hình chuẩn màu tốt và hệ sinh thái phần mềm sáng tạo rất mạnh. '
                f"{names[1] if 'macbook' in names[0].lower() else names[0]} vẫn là lựa chọn tốt nếu bạn cần Windows, nâng cấp phần cứng linh hoạt và đa cổng kết nối hơn."
            )

        return (
            f"Với nhu cầu bạn vừa nêu, mình khuyên ưu tiên {names[0]}. "
            f"{names[1]} là phương án thay thế nếu bạn muốn tối ưu ngân sách hoặc hệ điều hành khác."
        )

    if is_advice and names:
        if ('cao cap' in q or 'premium' in q) and ('tam trung' in q or 'trung cap' in q):
            return (
                f"Nếu dùng ổn định 3 năm, nhóm cao cấp sẽ bền hiệu năng và camera hơn; còn tầm trung tối ưu chi phí ban đầu. "
                f"Mình gợi ý 2 hướng: cao cấp chọn {names[0]}, hoặc tiết kiệm hơn chọn {names[1] if len(names) > 1 else names[0]}."
            )

        if 'ssd' in q and ('nvme' in q or 'sata' in q):
            return (
                f"Với edit video 4K, ưu tiên NVMe vì tốc độ đọc/ghi cao hơn SATA rõ rệt. "
                f"Mình đã lọc 3 mẫu phù hợp để bạn chọn nhanh: {', '.join(names[:3])}."
            )

        if ('tai nghe' in q or 'headphone' in q or 'earbuds' in q) and ('mic' in q or 'hop online' in q):
            if len(names) == 1:
                return (
                    f"Với nhu cầu họp online + nghe nhạc, mình ưu tiên {names[0]} vì mic rõ và đeo thoải mái. "
                    'Nếu bạn muốn, mình sẽ lọc thêm theo kiểu đeo in-ear hoặc over-ear để chọn đúng gu hơn.'
                )
            return (
                f"Với nhu cầu họp online + nghe nhạc, mình ưu tiên {names[0]} vì cân bằng mic và chất âm tốt trong tầm giá. "
                f"Bạn có thể cân nhắc thêm {names[1] if len(names) > 1 else names[0]} để so thêm độ đeo thoải mái."
            )

        if ('di cong tac' in q or 'laptop nhe' in q or 'nhe' in q) and ('pin' in q):
            if len(names) == 1:
                return (
                    f"Với nhu cầu di chuyển nhiều, mình đề xuất {names[0]} vì cân bằng độ nhẹ và pin. "
                    'Hiện danh sách phù hợp đang khá ít; nếu bạn cho thêm ngân sách, mình sẽ mở rộng sang các mẫu mỏng nhẹ cao cấp hơn.'
                )
            return (
                f"Với nhu cầu di chuyển nhiều, bạn nên ưu tiên dòng máy nhẹ và pin bền. "
                f"Mình đề xuất {names[0]}, phương án thay thế là {names[1] if len(names) > 1 else names[0]}."
            )

        if features:
            feature_text = ', '.join(FEATURE_LABELS.get(f, f) for f in features)
            if len(names) == 1:
                return (
                    f"Theo nhu cầu bạn hỏi, mình ưu tiên {names[0]} vì hợp tiêu chí {feature_text}. "
                    'Nếu bạn muốn mình sẽ mở rộng thêm điều kiện ngân sách để có nhiều lựa chọn so sánh hơn.'
                )
            return (
                f"Theo nhu cầu bạn hỏi, mình ưu tiên {names[0]} vì hợp tiêu chí {feature_text}. "
                f"Phương án thay thế là {names[1] if len(names) > 1 else names[0]} nếu bạn muốn cân bằng thêm về giá."
            )
        return (
            f"Theo nhu cầu bạn mô tả, mình khuyên chọn {names[0]}. "
            f"Các lựa chọn còn lại để bạn so nhanh: {', '.join(names[1:3]) if len(names) > 1 else names[0]}."
        )

    if any(k in q for k in ['goc lam viec', 'góc làm việc', 'home office', 'setup', 'nang cap', 'nâng cấp']):
        return (
            f"Để nâng cấp góc làm việc tại nhà, bạn nên ưu tiên theo thứ tự: màn hình -> thiết bị nhập liệu -> phụ kiện họp online. "
            f"Mình đã lọc nhanh {shown_count} món phù hợp: {', '.join(names)}. "
            'Nếu bạn muốn, mình lọc tiếp theo ngân sách cụ thể để ra combo tối ưu nhất.'
        )

    if price_tier == 'premium':
        return (
            f"Với nhu cầu phan khuc cao cap, minh uu tien {shown_count} lua chon noi bat: {', '.join(names)}. "
            'Neu ban muon, minh co the chot 1 mau toi uu theo uu tien do ben, hieu nang hoac trai nghiem su dung.'
        )

    if price_tier == 'budget':
        return (
            f"Với nhu cầu tiết kiệm, mình lọc {shown_count} mẫu giá tốt dễ mua: {', '.join(names)}. "
            'Nếu bạn đưa mức ngân sách cụ thể, mình sẽ chọn ra phương án có tỷ lệ giá/hiệu năng tốt nhất.'
        )

    if is_question:
        return (
            f"Mình đã lọc {shown_count} lựa chọn đúng hướng câu hỏi: {', '.join(names)}. "
            'Bạn muốn mình chốt 1 mẫu tốt nhất theo ưu tiên camera, pin hay hiệu năng không?'
        )

    return (
        f"Mình đã lọc {shown_count} sản phẩm bám sát nhu cầu của bạn: {', '.join(names)}. "
        'Bạn có thể chọn theo ngân sách trước, rồi mình tinh chỉnh thêm theo thương hiệu hoặc mục tiêu sử dụng.'
    )


def _build_sources(query: str):
    if _is_cart_query(query):
        return ['Goi y dua tren gio hang hien tai va hanh vi gan day']

    intents = _detect_intents(query)
    sources = [INTENT_SOURCES[i] for i in intents if i in INTENT_SOURCES]
    if not sources:
        sources = ['Goi y mua sam tong hop theo nhu cau va hanh vi gan day']
    return sources[:3]


def _override_intent_from_query(query: str):
    q = _normalize(query)

    keyword_to_sub = [
        (['son moi', 'lip tint', 'lipstick', 'son'], 'beauty', 'son-moi'),
        (['kem nen', 'foundation', 'cushion'], 'beauty', 'kem-nen'),
        (['nuoc hoa', 'perfume', 'mui huong'], 'beauty', 'nuoc-hoa'),
        (['skincare', 'cham soc da', 'serum', 'sua rua mat'], 'beauty', 'cham-soc-da'),
        (['ao', 'ao thun', 'ao khoac'], 'fashion', 'ao'),
        (['quan', 'quan jeans', 'quan tay'], 'fashion', 'quan'),
        (['giay', 'dep', 'sneaker'], 'fashion', 'giay-dep'),
    ]

    for keywords, main_category, sub_category in keyword_to_sub:
        if any(_contains_keyword(q, k) for k in keywords):
            return {
                'main_category': main_category,
                'sub_category': sub_category,
            }
    return None


def _build_product_links(segment: str, query: str):
    ids = SEGMENT_PRODUCT_MAP.get(segment, SEGMENT_PRODUCT_MAP['normal_user'])
    try:
        segment_products = requests.get(
            f"{PRODUCT_SERVICE_URL}/by-ids?ids={','.join(map(str, ids))}", timeout=6
        ).json()
    except Exception:
        segment_products = []

    all_products = _fetch_products_cached()

    guessed_intent = _override_intent_from_query(query) or _guess_category_intent(query) or {}
    guessed = guessed_intent.get('sub_category')
    guessed_main = guessed_intent.get('main_category')
    intents = _detect_intents(query)
    q = _normalize(query)
    budget_usd = _extract_budget_usd(query)
    target_count = _extract_target_count(query)
    price_tier = _detect_price_tier(query)

    should_compare = _is_compare_query(query) or _is_decision_query(query)
    if 'storage' in intents and ('nvme' in q or 'sata' in q):
        should_compare = False
    if should_compare:
        target_count = 2

    if should_compare:
        compared = _find_compare_products(all_products or segment_products, query)
        if compared:
            products = compared
        else:
            products = []
    elif ('combo' in q and 'gaming' in q):
        products = _build_gaming_combo(all_products or segment_products, budget_usd)
    elif (('combo' in q or 'setup' in q) and ('goc lam viec' in q or 'tai nha' in q or 'home office' in q)):
        products = _build_workspace_combo(all_products or segment_products, budget_usd)
    elif 'combo' in q and 'gaming' in q:
        products = _build_gaming_combo(all_products or segment_products, budget_usd)
    else:
        # Intent-specific category override.
        force_category = None
        if 'phu kien' in q or 'phụ kiện' in q:
            force_category = 'accessory'
        if guessed == 'laptop' and ('phu kien' in q or 'phụ kiện' in q):
            force_category = 'accessory'
        if any(i in intents for i in ['audio', 'storage', 'display', 'power']):
            force_category = 'accessory'
        if guessed and not force_category:
            force_category = guessed

        ranked_pool = all_products or segment_products
        if force_category:
            ranked_pool = [p for p in ranked_pool if _product_sub_category(p) == force_category]
        elif guessed_main:
            ranked_pool = [p for p in ranked_pool if _product_main_category(p) == guessed_main]
        elif guessed:
            ranked_pool = sorted(
                ranked_pool,
                key=lambda p: 0 if _product_sub_category(p) == guessed else 1,
            )

        if not ranked_pool:
            ranked_pool = all_products or segment_products

        # Hard price-band separation to avoid premium/budget returning similar products.
        if price_tier == 'premium':
            premium_pool = [p for p in ranked_pool if float(p.get('price') or 0) >= 800]
            if premium_pool:
                ranked_pool = premium_pool
        elif price_tier == 'budget':
            budget_pool = [p for p in ranked_pool if float(p.get('price') or 0) <= 600]
            if budget_pool:
                ranked_pool = budget_pool

        if budget_usd:
            priced = [
                p for p in ranked_pool
                if float(p.get('price') or 0) <= budget_usd * 1.05
            ]
            if priced:
                ranked_pool = priced

        # Score full catalog by query relevance first.
        ranked = sorted(
            ranked_pool,
            key=lambda p: _score_product(p, query, guessed, intents),
            reverse=True,
        )

        # Keep segment-specific products as backup to avoid empty recommendations.
        products = ranked + segment_products

    # Deduplicate by product id while preserving priority order.
    seen = set()
    deduped = []
    for p in products:
        pid = p.get('id')
        if pid in seen:
            continue
        seen.add(pid)
        deduped.append(p)
    products = deduped

    if not products:
        fallback = segment_products or all_products or []
        if guessed:
            narrowed = [p for p in fallback if _product_sub_category(p) == guessed]
            if narrowed:
                fallback = narrowed
        elif guessed_main:
            narrowed = [p for p in fallback if _product_main_category(p) == guessed_main]
            if narrowed:
                fallback = narrowed
        products = fallback

    # If category filter is too strict and yields too few items, backfill from same category catalog.
    if guessed and len(products) < target_count:
        catalog = all_products or segment_products or []
        extras = [p for p in catalog if _product_sub_category(p) == guessed]
        if len(extras) < target_count:
            category_rows = _fetch_products_by_category(main_category=guessed_main, sub_category=guessed)
            if category_rows:
                extras = category_rows
        for p in extras:
            pid = p.get('id')
            if any(pid == e.get('id') for e in products):
                continue
            products.append(p)
            if len(products) >= target_count:
                break

    if guessed == 'laptop' and _is_travel_laptop_query(query) and len(products) < max(3, target_count):
        catalog = all_products or segment_products or []
        desired = max(3, target_count)
        products = _augment_laptop_mobility_choices(products, catalog, desired)

    links = []
    for p in products[:target_count]:
        display_name = p.get('name')
        category = _product_sub_category(p)
        normalized_name = _normalize(display_name or '')
        if category == 'laptop' and 'laptop' not in normalized_name:
            display_name = f"Laptop {display_name}"
        elif category == 'phone' and ('phone' not in normalized_name and 'dien thoai' not in normalized_name):
            display_name = f"Phone {display_name}"
        links.append(
            {
                'id': p.get('id'),
                'name': display_name,
                'price': p.get('price'),
                'url': f"{FRONTEND_BASE_URL}/product/{p.get('id')}",
            }
        )
    return links


def _build_graph_product_links(user_id: int, message: str, search_context: str | None = None, cart_product_ids=None, limit: int = 4):
    products = _fetch_products_cached()
    if not products:
        return [], {}

    by_id = {}
    for p in products:
        pid = p.get('id')
        if pid is None:
            continue
        by_id[int(pid)] = p

    score_map = {}

    def _add_score(pid: int, delta: float):
        if int(pid) not in by_id:
            return
        score_map[int(pid)] = score_map.get(int(pid), 0.0) + float(delta)

    cart_ids = []
    for raw in (cart_product_ids or []):
        try:
            cart_ids.append(int(raw))
        except Exception:
            continue

    for pid in cart_ids:
        _add_score(pid, 7.0)

    # Learn cart intent: recommend alternatives/complements in the same cart categories,
    # but avoid recommending the exact items that are already in cart.
    cart_sub_counts = {}
    cart_main_counts = {}
    for pid in cart_ids:
        product = by_id.get(int(pid))
        if not product:
            continue
        main_cat = _product_main_category(product)
        sub_cat = _product_sub_category(product)
        if sub_cat:
            cart_sub_counts[sub_cat] = cart_sub_counts.get(sub_cat, 0) + 1
        if main_cat:
            cart_main_counts[main_cat] = cart_main_counts.get(main_cat, 0) + 1

    if cart_sub_counts or cart_main_counts:
        for pid, p in by_id.items():
            if pid in cart_ids:
                continue
            sub_cat = _product_sub_category(p)
            main_cat = _product_main_category(p)
            if sub_cat in cart_sub_counts:
                _add_score(pid, 3.6 + (cart_sub_counts[sub_cat] * 0.6))
            elif main_cat in cart_main_counts:
                _add_score(pid, 1.8 + (cart_main_counts[main_cat] * 0.35))

    q_all = _normalize(f"{message or ''} {search_context or ''}")
    tokens = [t for t in q_all.split(' ') if len(t) >= 3]

    for pid, p in by_id.items():
        text = _normalize(f"{p.get('name', '')} {p.get('description', '')}")
        lexical_hits = sum(1 for t in tokens if t in text)
        if lexical_hits:
            _add_score(pid, min(4.0, lexical_hits * 0.7))

    driver = _neo4j_driver()
    if driver:
        try:
            with driver.session() as session:
                rows = session.run(
                    """
                    MATCH (u:User {id:$uid})-[r:VIEWED|CLICKED|ADDED_TO_CART]->(p:Product)
                    WITH p.id AS pid,
                         sum(
                             CASE type(r)
                                 WHEN 'ADDED_TO_CART' THEN coalesce(r.count, 1) * 3
                                 WHEN 'CLICKED' THEN coalesce(r.count, 1) * 2
                                 ELSE coalesce(r.count, 1)
                             END
                         ) AS w
                    RETURN pid, w
                    ORDER BY w DESC
                    LIMIT 60
                    """,
                    uid=int(user_id),
                )
                for r in rows:
                    pid = r.get('pid')
                    if pid is None:
                        continue
                    _add_score(int(pid), float(r.get('w') or 0.0))

                if cart_ids:
                    sim_rows = session.run(
                        """
                        UNWIND $cart_ids AS cid
                        MATCH (:Product {id: cid})-[s:SIMILAR]->(p:Product)
                        RETURN p.id AS pid, sum(coalesce(s.weight, 1)) AS w
                        ORDER BY w DESC
                        LIMIT 80
                        """,
                        cart_ids=cart_ids,
                    )
                    for r in sim_rows:
                        pid = r.get('pid')
                        if pid is None:
                            continue
                        _add_score(int(pid), float(r.get('w') or 0.0) * 0.35)
        except Exception:
            pass
        finally:
            driver.close()

    if not score_map:
        return [], {}

    ranked_ids = sorted(score_map.keys(), key=lambda x: score_map[x], reverse=True)
    out_links = []
    for pid in ranked_ids:
        if pid in cart_ids:
            continue
        p = by_id.get(pid)
        if not p:
            continue
        out_links.append(
            {
                'id': p.get('id'),
                'name': p.get('name'),
                'price': p.get('price'),
                'url': f"{FRONTEND_BASE_URL}/product/{p.get('id')}",
            }
        )
        if len(out_links) >= max(1, int(limit)):
            break

    return out_links, {'neo4j': True, 'used_cart': bool(cart_ids), 'used_search': bool(search_context)}


def _merge_links(primary: list, secondary: list, limit: int = 3):
    out = []
    seen = set()
    for link in (primary or []) + (secondary or []):
        pid = link.get('id')
        if pid in seen:
            continue
        seen.add(pid)
        out.append(link)
        if len(out) >= max(1, int(limit)):
            break
    return out


@router.post('/chat')
def chat(body: ChatBody):
    segment = 'normal_user'
    try:
        profile = requests.get(f'{USER_SERVICE_URL}/profile/{body.user_id}', timeout=6).json()
        segment = profile.get('segment', 'normal_user')
    except Exception:
        pass

    query_for_intent = body.message
    if body.search_context:
        query_for_intent = f"{body.message} {body.search_context}".strip()

    # Default to 3 suggestions unless user explicitly asks for another count.
    desired_count = _extract_target_count(query_for_intent, default=3, max_items=5)

    base_links = _build_product_links(segment, query_for_intent)
    graph_links, graph_meta = _build_graph_product_links(
        user_id=body.user_id,
        message=body.message,
        search_context=body.search_context,
        cart_product_ids=body.cart_product_ids,
        limit=desired_count,
    )
    product_links = _merge_links(graph_links, base_links, limit=desired_count)

    guessed = _guess_category(query_for_intent)
    intents = _detect_intents(query_for_intent)
    confidence = _compute_match_confidence(product_links, query_for_intent, guessed, intents)
    rag_result = _try_rag_answer(query_for_intent, segment)

    answer = _compose_short_answer(body.message, product_links)
    # Hybrid policy: use RAG answer for advisory questions, keep rule answer for strict compare/decision queries.
    has_cart_signal = bool(body.cart_product_ids) or _is_cart_query(query_for_intent)

    if (
        rag_result
        and confidence >= 0.25
        and not has_cart_signal
        and not _is_compare_query(body.message)
        and not _is_decision_query(body.message)
    ):
        if _is_advice_query(body.message) or _is_question_query(body.message):
            answer = rag_result['answer']

    if graph_links and (_is_advice_query(query_for_intent) or body.search_context or body.cart_product_ids):
        answer = (
            f"{answer}\n\n"
            "Minh da uu tien de xuat dua tren lich su xem/chon va noi dung gio hang hien tai "
            "de danh sach sat nhu cau hon."
        )

    if (
        confidence < 0.18
        and not _is_greeting(body.message)
        and not _is_out_of_scope(body.message)
        and not _is_advice_query(body.message)
        and not _is_compare_query(body.message)
        and not _is_decision_query(body.message)
        and _extract_budget_usd(body.message) is None
    ):
        answer = (
            'Minh can them mot chut thong tin de tu van chinh xac hon. '
            'Ban cho minh biet ngan sach va uu tien chinh (camera, pin, hieu nang, man hinh hay do ben) nhe.'
        )
    sources = _build_sources(query_for_intent)
    doc_ids = []
    if (
        rag_result
        and confidence >= 0.25
        and not has_cart_signal
        and not _is_compare_query(body.message)
        and not _is_decision_query(body.message)
    ):
        sources = _merge_sources(rag_result.get('sources', []), sources)
        doc_ids = rag_result.get('doc_ids', [])

    return {
        'answer': answer,
        'segment': segment,
        'sources': sources,
        'doc_ids': doc_ids,
        'confidence': round(confidence, 3),
        'product_links': product_links,
        'graph_meta': graph_meta,
    }
