# AI-Eco: AI-Powered E-commerce

He thong e-commerce gom frontend React, backend Node.js microservices, va AI service FastAPI (Deep Learning + RAG).

## 1) Cau truc chinh

- `frontend`: UI React + Vite (Noir Tech)
- `services/api-gateway`: API Gateway
- `services/user-service`: Users + auth + segment profile
- `services/product-service`: Product catalog + filter
- `services/order-service`: Orders + payment flow + goi AI classify
- `ai-service`: Deep Learning model_behavior + KB + RAG

## 2) Chay bang Docker

```bash
docker compose up --build
```

## 3) Chay thu cong

### Frontend
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

### Backend
```bash
cd services/user-service && npm install && node index.js
cd services/product-service && npm install && node index.js
cd services/order-service && npm install && node index.js
cd services/api-gateway && npm install && node index.js
```

### AI service
```bash
cd ai-service
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Neu can dung semantic retrieval dung embedding (khong fallback keyword), cai them:

```bash
pip install -r requirements-rag.txt
```

## 4) Bien moi truong can thiet

- `ai-service/.env`: `GEMINI_API_KEY=...`
- `services/user-service/.env`: `PORT=3001`, `JWT_SECRET=...`
- `services/order-service/.env`: `PORT=3003`, `USER_SERVICE_URL=...`, `AI_SERVICE_URL=...`, `PRODUCT_SERVICE_URL=...`
- `services/api-gateway/.env`: `PORT=3000`, `USER_URL=...`, `PRODUCT_URL=...`, `ORDER_URL=...`, `AI_URL=...`
- `frontend/.env`: `VITE_API_URL=http://localhost:3000/api`

## 5) Luong chinh

1. User mua hang
2. Order service cap nhat user stats
3. Order service goi AI `/segment`
4. User service luu `segment` + `segment_score`
5. Frontend dashboard/chat hien thi ket qua AI

## 6) Chat Regression Test (Tieng Viet)

Bo test tu dong cho chatbot gom 26 cau hoi tieng Viet (so sanh, tu van, ngan sach, nhu cau su dung), co cham pass/fail va bao cao JSON de phat hien hoi quy nhanh.

Ho tro 3 profile de can bang toc do va do nghiem:
- `smoke`: chay nhanh (8 case dai dien), phu hop CI moi commit
- `balanced`: mac dinh (26 case), giam false-fail do wording thay doi
- `strict`: nghiem ngat nhat (26 case + check wording chat chat)

Chay test mac dinh (`balanced`):

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\chat_regression_test.ps1
```

Tuy chon:

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\chat_regression_test.ps1 -Profile smoke -ReportPath scripts/chat_regression_report.smoke.json
powershell -ExecutionPolicy Bypass -File .\scripts\chat_regression_test.ps1 -Profile balanced -ReportPath scripts/chat_regression_report.balanced.json
powershell -ExecutionPolicy Bypass -File .\scripts\chat_regression_test.ps1 -Profile strict -ReportPath scripts/chat_regression_report.strict.json
powershell -ExecutionPolicy Bypass -File .\scripts\chat_regression_test.ps1 -ChatUrl http://localhost:3000/api/ai/chat -UserId 1 -TimeoutSec 60
```

Ket qua:
- In ra summary pass/fail theo nhom test
- In thong tin profile dang dung va so case da chay
- In pair-check cho intent doi nghich (premium vs budget)
- Ghi file report: `scripts/chat_regression_report.json`
- Exit code `0` neu tat ca pass, `1` neu co test fail

Goi y CI:
- PR nhanh: chay `smoke`
- Nightly/Release candidate: chay `balanced` hoac `strict`

## 7) Dynamic AI Recommendations

Endpoint recommend da ho tro xep hang dong theo nhu cau chat + ngan sach, khong con chi map cung theo segment.

API:

```bash
GET /api/ai/recommend/{user_id}?message=...&budget_usd=...&limit=4
```

Query params (tuy chon):
- `message`: cau hoi/nhu cau gan nhat cua nguoi dung
- `budget_usd` hoac `budget_vnd`: ngan sach de ranking theo tam gia
- `limit`: so luong goi y (1-10)

Neu khong truyen `message`, he thong van ranking dong dua tren profile user (segment + fav_category + avg_price).

## 8) Hybrid RAG Chat

Chat tu van da duoc tich hop theo kieu hybrid:
- Rule-based + ranking san pham de giu do on dinh cho cac cau hoi so sanh/quyet dinh.
- RAG pipeline (`retrieve` + `generate`) de bo sung cau tra loi va nguon tai lieu cho cau hoi tu van.

Runtime uu tien:
- Cau hoi tu van chung: co the dung cau tra loi RAG neu kha dung.
- Cau hoi so sanh/nen chon: giu logic rule de tranh tra loi lac de, nhung van hop nhat `sources` tu RAG.

## 9) Show hanh vi nguoi dung len Neo4j

He thong da co API dong bo event hanh vi (view/click/add_to_cart) tu SQLite sang Neo4j de ban xem graph truc quan.

### 9.1 Cau hinh bien moi truong cho AI service

Them vao `ai-service/.env`:

```bash
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
```

Neu chay bang Docker Compose va Neo4j cung nam trong compose/network thi co the dung host la ten service (vi du `bolt://neo4j:7687`).

### 9.2 Dong bo event sang Neo4j

```bash
POST /api/ai/graph/sync-behavior
```

Tuy chon query:
- `user_id`: chi sync 1 user
- `limit`: gioi han so event sync (mac dinh 5000)
- `clear_existing=true`: xoa canh hanh vi cu roi sync lai

Vi du:

```bash
curl -X POST "http://localhost:3000/api/ai/graph/sync-behavior?limit=10000"
curl -X POST "http://localhost:3000/api/ai/graph/sync-behavior?user_id=1&clear_existing=true"
```

### 9.3 API xem graph cua 1 user

```bash
GET /api/ai/graph/user/{user_id}?limit=200
```

API tra ve `nodes` va `edges` de frontend ve graph, hoac de debug nhanh.

### 9.4 Cypher de show tren Neo4j Browser

Sau khi sync, mo Neo4j Browser va chay:

```cypher
MATCH (u:User)-[r:VIEWED|CLICKED|ADDED_TO_CART]->(p:Product)
RETURN u, r, p
LIMIT 200;
```

Loc theo 1 user:

```cypher
MATCH (u:User {id: 1})-[r:VIEWED|CLICKED|ADDED_TO_CART]->(p:Product)
RETURN u, r, p
ORDER BY r.last_at DESC
LIMIT 200;
```

Kiem tra quan he SIMILAR duoc build tu hanh vi dong mua/xem:

```cypher
MATCH (p1:Product)-[s:SIMILAR]->(p2:Product)
RETURN p1, s, p2
ORDER BY s.weight DESC
LIMIT 100;
```
