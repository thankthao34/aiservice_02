import os
import re
import unicodedata

import requests
from fastapi import APIRouter
from ai_core.behavior_store import get_events

router = APIRouter()

USER_SERVICE_URL = os.getenv('USER_SERVICE_URL', 'http://localhost:3001')
PRODUCT_SERVICE_URL = os.getenv('PRODUCT_SERVICE_URL', 'http://localhost:3002')

SEGMENT_PRODUCT_MAP = {
    'cheap_hunter': [15, 16, 17, 18],
    'normal_user': [3, 8, 10, 11],
    'premium_user': [1, 2, 6, 7],
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
    'accessory': ['phu kien', 'chuot', 'mouse', 'ban phim', 'keyboard', 'charger', 'sac', 'webcam', 'hub', 'cable'],
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

CATEGORY_ALIASES = {
    'thoi-trang': 'fashion',
    'thoi trang': 'fashion',
    'my-pham': 'beauty',
    'my pham': 'beauty',
    'lam-dep': 'beauty',
    'lam dep': 'beauty',
    'kem-nen': 'kem-nen',
    'son': 'son-moi',
    'son-moi': 'son-moi',
    'nen': 'kem-nen',
    'sach-vo': 'books-stationery',
    'sach vo': 'books-stationery',
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


def _normalize_category_key(value: str) -> str:
    # Category keys in taxonomy use slug format with hyphens.
    return _normalize(value).replace(' ', '-')


def _resolve_subcategory_key(text: str):
    key = _normalize_category_key(text)
    if not key:
        return None
    if key in SUBCATEGORY_MAIN_MAP:
        return key

    alias = CATEGORY_ALIASES.get(key) or CATEGORY_ALIASES.get(key.replace('-', ' '))
    if alias in SUBCATEGORY_MAIN_MAP:
        return alias

    key_spaced = key.replace('-', ' ')
    for sub_key, keywords in SUBCATEGORY_KEYWORDS.items():
        if _contains_keyword(key_spaced, sub_key.replace('-', ' ')):
            return sub_key
        if any(_contains_keyword(key_spaced, k) for k in keywords):
            return sub_key
    return None


def _resolve_main_category_key(text: str):
    key = _normalize_category_key(text)
    if not key:
        return None
    if key in MAIN_CATEGORY_KEYWORDS:
        return key

    alias = CATEGORY_ALIASES.get(key) or CATEGORY_ALIASES.get(key.replace('-', ' '))
    if alias in MAIN_CATEGORY_KEYWORDS:
        return alias

    key_spaced = key.replace('-', ' ')
    for main_key, keywords in MAIN_CATEGORY_KEYWORDS.items():
        if _contains_keyword(key_spaced, main_key.replace('-', ' ')):
            return main_key
        if any(_contains_keyword(key_spaced, k) for k in keywords):
            return main_key
    return None


def _guess_category_intent(query: str):
    q = _normalize(query)

    # Try exact/alias category keys first (e.g., kem-nen, thoi-trang).
    detected_sub = _resolve_subcategory_key(q)
    detected_main = SUBCATEGORY_MAIN_MAP.get(detected_sub) if detected_sub else _resolve_main_category_key(q)

    if detected_main or detected_sub:
        return {
            'main_category': detected_main,
            'sub_category': detected_sub,
        }

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


def _infer_intent_from_behavior(user_id: int, all_products: list):
    # Learn real preference from recent behavior events to avoid stale profile/category drift.
    try:
        events = get_events(user_id=user_id, limit=160)
    except Exception:
        events = []

    if not events or not all_products:
        return None

    product_map = {}
    for p in all_products:
        try:
            pid = int(p.get('id'))
        except Exception:
            continue
        product_map[pid] = p

    action_weight = {
        'add_to_cart': 4.0,
        'click': 2.0,
        'view': 1.0,
    }

    sub_scores = {}
    main_scores = {}
    usable = 0
    total = len(events)

    for idx, ev in enumerate(events):
        try:
            pid = int(ev.get('product_id'))
        except Exception:
            continue
        product = product_map.get(pid)
        if not product:
            continue

        usable += 1
        main_category, sub_category = _resolve_product_categories(product)
        action = str(ev.get('action') or '').strip().lower()
        base = action_weight.get(action, 1.0)
        # Recency boost for later events because events are ordered asc by timestamp.
        recency = 1.0 + (idx / max(1.0, float(total)))
        w = base * recency

        if sub_category:
            sub_scores[sub_category] = sub_scores.get(sub_category, 0.0) + w
        if main_category:
            main_scores[main_category] = main_scores.get(main_category, 0.0) + w

    if usable < 2 or (not sub_scores and not main_scores):
        return None

    best_sub = max(sub_scores.items(), key=lambda it: it[1])[0] if sub_scores else None
    best_main = max(main_scores.items(), key=lambda it: it[1])[0] if main_scores else None

    if best_sub and best_main and SUBCATEGORY_MAIN_MAP.get(best_sub) not in (None, best_main):
        best_sub = None

    if not best_main and best_sub:
        best_main = SUBCATEGORY_MAIN_MAP.get(best_sub)

    if not best_main and not best_sub:
        return None

    return {
        'main_category': best_main,
        'sub_category': best_sub,
    }


def _parse_cart_product_ids(raw: str):
    ids = []
    for part in str(raw or '').split(','):
        part = part.strip()
        if not part:
            continue
        try:
            ids.append(int(part))
        except Exception:
            continue
    return ids


def _infer_intent_from_cart(cart_ids: list, all_products: list):
    if not cart_ids or not all_products:
        return None

    product_map = {}
    for p in all_products:
        try:
            product_map[int(p.get('id'))] = p
        except Exception:
            continue

    sub_scores = {}
    main_scores = {}
    for pid in cart_ids:
        p = product_map.get(int(pid))
        if not p:
            continue
        main_category, sub_category = _resolve_product_categories(p)
        if sub_category:
            sub_scores[sub_category] = sub_scores.get(sub_category, 0.0) + 1.0
        if main_category:
            main_scores[main_category] = main_scores.get(main_category, 0.0) + 1.0

    if not sub_scores and not main_scores:
        return None

    best_sub = max(sub_scores.items(), key=lambda it: it[1])[0] if sub_scores else None
    best_main = max(main_scores.items(), key=lambda it: it[1])[0] if main_scores else None
    if not best_main and best_sub:
        best_main = SUBCATEGORY_MAIN_MAP.get(best_sub)

    return {
        'main_category': best_main,
        'sub_category': best_sub,
    }


def _is_profile_template_query(query: str) -> bool:
    q = _normalize(query)
    return 'danh muc ua thich' in q


def _resolve_product_categories(product: dict):
    sub_category = _normalize_category_key(product.get('sub_category') or product.get('category'))
    main_category = _normalize_category_key(product.get('main_category') or SUBCATEGORY_MAIN_MAP.get(sub_category) or '')
    return main_category, sub_category


def _product_matches_intent(product: dict, intent: dict):
    if not intent:
        return True

    main_category, sub_category = _resolve_product_categories(product)
    if intent.get('sub_category'):
        return sub_category == intent['sub_category']
    if intent.get('main_category'):
        return main_category == intent['main_category']
    return True


def _extract_budget_usd(message: str, budget_vnd, budget_usd):
    if budget_usd is not None:
        try:
            return float(budget_usd)
        except Exception:
            pass

    if budget_vnd is not None:
        try:
            return float(budget_vnd) / 25_000
        except Exception:
            pass

    q = _normalize(message)
    m_vnd = re.search(r'(\d+[\.,]?\d*)\s*(trieu)', q)
    if m_vnd:
        million = float(m_vnd.group(1).replace(',', '.'))
        return (million * 1_000_000) / 25_000

    m_usd = re.search(r'(\d+[\.,]?\d*)\s*(usd|\$)', q)
    if m_usd:
        return float(m_usd.group(1).replace(',', '.'))

    return None


def _derive_budget_from_profile(profile: dict, segment: str):
    avg_price = float(profile.get('avg_price') or 0)
    if avg_price > 0:
        return avg_price * 1.3
    if segment == 'cheap_hunter':
        return 350
    if segment == 'premium_user':
        return 1400
    return 800


def _score_product(product: dict, query: str, intent: dict, budget_usd):
    text = _normalize(f"{product.get('name', '')} {product.get('description', '')}")
    score = 0.0
    main_category, sub_category = _resolve_product_categories(product)

    if intent and intent.get('sub_category') and sub_category == intent['sub_category']:
        score += 6.0
    elif intent and intent.get('main_category') and main_category == intent['main_category']:
        score += 3.0
    elif intent:
        score -= 2.5

    q = _normalize(query)
    for token in q.split(' '):
        if len(token) >= 3 and token in text:
            score += 0.8

    rating = float(product.get('rating') or 0)
    score += min(2.5, rating / 2)

    # Reward closer-to-budget options and penalize strong outliers.
    price = float(product.get('price') or 0)
    if budget_usd and budget_usd > 0:
        ratio = price / budget_usd
        if 0.65 <= ratio <= 1.1:
            score += 3.0
        elif 0.45 <= ratio < 0.65:
            score += 1.2
        elif ratio > 1.25:
            score -= 2.0

    # Keep catalog quality stable.
    pid = int(product.get('id') or 0)
    if 1 <= pid <= 40:
        score += 1.0
    return score


@router.get('/recommend/{user_id}')
def recommend(
    user_id: int,
    message: str = '',
    budget_vnd: float = None,
    budget_usd: float = None,
    limit: int = 4,
    cart_product_ids: str = '',
):
    segment = 'normal_user'
    profile = {}
    try:
        profile = requests.get(f'{USER_SERVICE_URL}/profile/{user_id}', timeout=6).json()
        segment = profile.get('segment', 'normal_user')
    except Exception:
        pass

    try:
        all_products = requests.get(f'{PRODUCT_SERVICE_URL}/', timeout=6).json()
        if not isinstance(all_products, list):
            all_products = []
    except Exception:
        all_products = []

    if limit < 1:
        limit = 1
    if limit > 10:
        limit = 10

    query = (message or '').strip()
    cart_ids = _parse_cart_product_ids(cart_product_ids)
    intent_source = 'query'
    intent = _guess_category_intent(query)

    fav_intent = None
    fav = (profile.get('fav_category') or '').strip()
    if fav:
        fav_sub = _resolve_subcategory_key(fav)
        fav_main = _resolve_main_category_key(fav)
        if fav_sub and not fav_main:
            fav_main = SUBCATEGORY_MAIN_MAP.get(fav_sub)
        if fav_sub or fav_main:
            fav_intent = {
                'main_category': fav_main,
                'sub_category': fav_sub,
            }

    behavior_intent = _infer_intent_from_behavior(user_id, all_products)
    cart_intent = _infer_intent_from_cart(cart_ids, all_products)

    # Dashboard often sends a profile-template query; in that case cart signal should win.
    if cart_intent and (_is_profile_template_query(query) or not intent):
        intent = cart_intent
        intent_source = 'cart'

    if not intent:
        # Prefer current cart intent first, then behavior, then profile favorite.
        if cart_intent:
            intent = cart_intent
            intent_source = 'cart'
        elif behavior_intent:
            intent = behavior_intent
            intent_source = 'behavior'
        elif fav_intent:
            intent = fav_intent
            intent_source = 'profile'
        else:
            intent_source = 'none'

    budget = _extract_budget_usd(query, budget_vnd, budget_usd)
    if budget is None:
        budget = _derive_budget_from_profile(profile, segment)

    ranked_pool = all_products
    if intent:
        narrowed = [p for p in all_products if _product_matches_intent(p, intent)]
        if narrowed:
            ranked_pool = narrowed
        elif intent.get('main_category'):
            # If specific sub-category has no data in catalog, keep recommendations in the same main category
            # instead of falling back to entire catalog (which causes irrelevant suggestions).
            fallback_main = [
                p for p in all_products
                if _resolve_product_categories(p)[0] == intent.get('main_category')
            ]
            if fallback_main:
                ranked_pool = fallback_main

    scored = sorted(
        ranked_pool,
        key=lambda p: _score_product(p, query, intent, budget),
        reverse=True,
    )

    # Guarantee output size by backfilling from full catalog when narrowed pool is too small.
    picked = []
    seen = set()
    cart_set = set(cart_ids)
    for p in scored:
        pid = p.get('id')
        if pid in seen:
            continue
        if pid in cart_set:
            continue
        seen.add(pid)
        picked.append(p)
        if len(picked) >= limit:
            break

    if len(picked) < limit:
        scored_all = sorted(
            all_products,
            key=lambda p: _score_product(p, query, intent, budget),
            reverse=True,
        )
        for p in scored_all:
            pid = p.get('id')
            if pid in seen:
                continue
            if pid in cart_set:
                continue
            seen.add(pid)
            picked.append(p)
            if len(picked) >= limit:
                break

    # Last-resort fallback to legacy segment mapping if dynamic ranking has no products.
    products = []
    strategy = 'dynamic'
    if picked:
        products = picked
    else:
        # Prefer returning empty over irrelevant hard-coded defaults when data is unavailable.
        products = []
        strategy = 'empty_fallback'

    return {
        'segment': segment,
        'products': products,
        'strategy': strategy,
        'context': {
            'main_category': intent.get('main_category') if intent else None,
            'sub_category': intent.get('sub_category') if intent else None,
            'category': intent.get('sub_category') if intent else None,
            'budget_usd': round(float(budget or 0), 2),
            'has_message': bool(query),
            'intent_source': intent_source,
            'cart_size': len(cart_ids),
            'limit': limit,
        },
    }
