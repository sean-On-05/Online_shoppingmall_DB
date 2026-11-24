# SSU Mall — 온라인 쇼핑몰 주문·재고 관리

데이터베이스 수업 기말 팀 프로젝트입니다. 숭실대 굿즈를 판매하는 쇼핑몰을 만들고, 주문이 들어오거나 취소될 때 재고가 어떻게 바뀌는지 구현했습니다.

[배포 사이트](https://online-shoppingmall-db.vercel.app/)

## 구현한 기능

- 고객은 상품을 조회하고 장바구니에 담아 주문할 수 있습니다. 주문 후에는 모의 결제 결과와 배송 상태를 확인할 수 있습니다.
- 관리자는 상품 등록·수정·판매 중지, 재고 조정, 주문 취소와 배송 상태 변경을 할 수 있습니다.
- 주문을 받을 때 재고 확인, 차감, 주문 저장을 하나의 트랜잭션에서 처리합니다. 재고가 부족하면 주문을 받지 않고, 주문을 취소하면 출고 창고의 재고를 복구합니다.

## 개발 환경

웹 화면은 React, TypeScript, Vite로 만들고 Vercel에 배포했습니다. Flask로 작성한 Python API는 PythonAnywhere에서 실행됩니다. 웹 화면은 HTTP로 API를 호출하고, SQLite 파일은 백엔드 서버에서 관리합니다. 팀 작업에는 Git과 GitHub를 사용했습니다.

- `frontend/` — 고객 화면과 관리자 화면
- `backend/` — Flask API와 SQLite 스키마
- `docs/` — 업무 흐름도, ERD, 테이블 정의서 등 설계 자료

## 제출 DB로 실행하기

Python 3.12와 Node.js 22.13 이상을 준비합니다. 아래 명령은 저장소 루트에서 시작하며, `shop.db`는 제출용 SQLite 파일의 이름입니다.

**터미널 1 · 백엔드**

제출용 DB를 `backend/`에 넣고 실행합니다.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
SHOP_DATABASE=shop.db python app.py
```

Windows PowerShell에서는 가상환경 활성화에 `.\.venv\Scripts\Activate.ps1`을 사용합니다. 실행 전 `$env:SHOP_DATABASE = "shop.db"`를 입력한 뒤 `python app.py`를 실행합니다. DB 파일명이 다르면 실제 이름을 지정하세요. `SHOP_DATABASE`를 설정하지 않으면 앱은 `backend/shop.sqlite3`를 사용합니다.

**터미널 2 · 프런트엔드**

로컬 실행본의 `frontend/vite.config.ts`에서 `/api` 프록시의 `target`을 `http://127.0.0.1:5000`으로 바꿉니다. 기본 설정은 PythonAnywhere의 배포 API에 연결됩니다.

```bash
cd frontend
npm ci
npm run dev
```

브라우저에서 [http://localhost:5173](http://localhost:5173)을 엽니다.

## 시연 순서

시연 상품의 재고를 1개로 맞춘 뒤, 두 고객 세션의 장바구니에 그 상품을 각각 1개씩 담습니다. 첫 고객이 주문하면 재고는 0개가 되고, 두 번째 고객의 주문은 재고 부족으로 차단됩니다. 관리자 화면에서 첫 주문을 취소한 뒤 재고가 1개로 돌아오는지 확인합니다.

## 발표용 SQL

Flask가 사용하는 **시연용 SQLite 파일**을 `sqlite3` 또는 DB Browser for SQLite에서 엽니다. 아래 블록은 위에서부터 하나씩 실행하세요. 백업용 임시 테이블은 현재 연결에만 남으므로, 복원까지 같은 콘솔이나 연결을 사용합니다. 예시의 첫 상품과 `user`는 실제 시연용 상품과 계정인지 확인한 뒤 진행하세요.

### 0. 대상 확인 및 백업

```sql
-- 트랜잭션을 열기 전에 실행합니다. foreign_keys의 결과는 1이어야 합니다.
PRAGMA foreign_keys = ON;
PRAGMA foreign_keys;

SELECT product_id, product_name, price, status
FROM PRODUCT ORDER BY product_id;

SELECT customer_id, username, is_admin, is_active FROM CUSTOMER;

SELECT o.order_id, o.order_code, o.order_status, p.payment_status, s.shipping_status
FROM ORDERS o
LEFT JOIN PAYMENT p USING (order_id)
LEFT JOIN SHIPMENT s USING (order_id)
ORDER BY o.order_id DESC;

CREATE TEMP TABLE demo_inventory_backup AS
SELECT * FROM INVENTORY
WHERE product_id = (SELECT MIN(product_id) FROM PRODUCT);

CREATE TEMP TABLE demo_member_backup AS
SELECT customer_id, is_admin, is_active
FROM CUSTOMER WHERE username = 'user';

SELECT * FROM demo_inventory_backup;
SELECT * FROM demo_member_backup;
```

두 백업 조회 모두 결과가 있어야 합니다. 다른 상품이나 회원으로 시연하려면 백업을 만들기 전에 각 `WHERE` 조건을 바꾸세요. 배송 상태 시연에는 배송 정보가 저장된 주문이 필요합니다.

### 1. 재고 소진과 복원

**1-A.** 재고를 0으로 만든 뒤 웹을 새로고침해 품절과 구매 제한을 확인합니다.

```sql
BEGIN IMMEDIATE;
UPDATE INVENTORY SET quantity = 0
WHERE product_id IN (SELECT product_id FROM demo_inventory_backup);
COMMIT;

SELECT p.product_name, i.warehouse_id, i.quantity
FROM INVENTORY i JOIN PRODUCT p USING (product_id)
WHERE i.product_id IN (SELECT product_id FROM demo_inventory_backup);
```

**1-B.** 확인을 마치면 창고별 재고를 복원합니다.

```sql
BEGIN IMMEDIATE;
UPDATE INVENTORY
SET quantity = (
    SELECT b.quantity FROM demo_inventory_backup b
    WHERE b.product_id = INVENTORY.product_id
      AND b.warehouse_id = INVENTORY.warehouse_id
)
WHERE EXISTS (
    SELECT 1 FROM demo_inventory_backup b
    WHERE b.product_id = INVENTORY.product_id
      AND b.warehouse_id = INVENTORY.warehouse_id
);
COMMIT;
```

### 2. 관리자 권한 부여와 회수

**2-A.** 시연 계정에 앱 관리자 권한을 주고 그 계정으로 로그인합니다.

```sql
BEGIN IMMEDIATE;
UPDATE CUSTOMER SET is_admin = 1, is_active = 1
WHERE customer_id IN (SELECT customer_id FROM demo_member_backup);
COMMIT;
```

쇼핑몰 탭의 브라우저 개발자 도구 Console에서 아래 코드를 실행하면 `200`이 나옵니다.

```js
fetch('/api/admin/members').then(response => console.log(response.status))
```

**2-B.** 관리자 권한을 회수하고, 같은 로그인 세션에서 위 요청을 다시 보내 `403`을 확인합니다. 실제 접근 허용 여부는 API 응답으로 확인합니다.

```sql
BEGIN IMMEDIATE;
UPDATE CUSTOMER SET is_admin = 0
WHERE customer_id IN (SELECT customer_id FROM demo_member_backup);
COMMIT;
```

### 3. 계정 정지와 원상 복원

**3-A.** 시연 계정이 로그인한 상태에서 계정을 정지합니다.

```sql
BEGIN IMMEDIATE;
UPDATE CUSTOMER SET is_active = 0
WHERE customer_id IN (SELECT customer_id FROM demo_member_backup);
COMMIT;
```

정지 직후 같은 브라우저 Console에서 아래 요청을 보내면 `403`이 나옵니다.

```js
fetch('/api/me').then(response => console.log(response.status))
```

**3-B.** 권한과 계정 상태를 원래 값으로 돌립니다.

```sql
BEGIN IMMEDIATE;
UPDATE CUSTOMER SET
    is_admin = (SELECT b.is_admin FROM demo_member_backup b
                WHERE b.customer_id = CUSTOMER.customer_id),
    is_active = (SELECT b.is_active FROM demo_member_backup b
                 WHERE b.customer_id = CUSTOMER.customer_id)
WHERE customer_id IN (SELECT customer_id FROM demo_member_backup);
COMMIT;
```

### 4. 제약조건 오류 확인

아래 블록은 하나씩 실행합니다. 예상 오류에서 SQL 도구가 실행을 멈추면 해당 블록의 `ROLLBACK TO`와 `RELEASE`를 이어서 실행합니다.

**4-A. 음수 재고** — `CHECK constraint failed`

```sql
SAVEPOINT demo_negative;
UPDATE INVENTORY SET quantity = -1
WHERE product_id = (SELECT MIN(product_id) FROM INVENTORY);
ROLLBACK TO demo_negative;
RELEASE demo_negative;
```

**4-B. 중복 아이디** — `UNIQUE constraint failed`

```sql
SAVEPOINT demo_duplicate;
INSERT INTO CUSTOMER (username, name, password_hash)
SELECT username, '중복 테스트', 'not-a-login-hash'
FROM CUSTOMER ORDER BY customer_id LIMIT 1;
ROLLBACK TO demo_duplicate;
RELEASE demo_duplicate;
```

**4-C. 존재하지 않는 상품의 재고** — `FOREIGN KEY constraint failed`. 창고가 하나 이상 있어야 합니다.

```sql
SAVEPOINT demo_foreign_key;
INSERT INTO INVENTORY (product_id, warehouse_id, quantity)
SELECT (SELECT COALESCE(MAX(product_id), 0) + 1 FROM PRODUCT),
       MIN(warehouse_id), 1
FROM WAREHOUSE
HAVING COUNT(*) > 0;
ROLLBACK TO demo_foreign_key;
RELEASE demo_foreign_key;
```

**4-D. 주문 합계 불일치** — `CHECK constraint failed`. 주문이 하나 이상 있어야 합니다.

```sql
SAVEPOINT demo_total;
UPDATE ORDERS SET total_amount = subtotal + shipping_fee + 1
WHERE order_id = (SELECT MIN(order_id) FROM ORDERS);
ROLLBACK TO demo_total;
RELEASE demo_total;
```

### 5. DB 제약조건과 앱의 주문 규칙

현재 스키마에서는 주문 상태와 배송 상태의 허용값을 각각 검사합니다. SQL로 직접 쓰면 취소 주문에 배송완료를 지정할 수 있습니다. 배송 정보가 있는 주문으로 SQL 화면에서만 확인하고, 같은 블록에서 변경을 되돌립니다.

```sql
SAVEPOINT demo_cross_table;
UPDATE ORDERS SET order_status = '취소'
WHERE order_id = (SELECT MIN(order_id) FROM SHIPMENT);

UPDATE SHIPMENT SET shipping_status = '배송완료'
WHERE order_id = (SELECT MIN(order_id) FROM SHIPMENT);

SELECT o.order_code, o.order_status, s.shipping_status
FROM ORDERS o JOIN SHIPMENT s USING (order_id)
WHERE o.order_id = (SELECT MIN(order_id) FROM SHIPMENT);

ROLLBACK TO demo_cross_table;
RELEASE demo_cross_table;
```

### 6. 시연 후 점검

`foreign_key_check` 결과는 0행, `integrity_check` 결과는 `ok`가 정상입니다. 마지막 두 조회에서 현재 재고와 회원 상태가 백업값으로 복원됐는지 확인합니다.

```sql
PRAGMA foreign_key_check;
PRAGMA integrity_check;

SELECT i.product_id, i.warehouse_id, i.quantity, b.quantity AS original_quantity
FROM INVENTORY i JOIN demo_inventory_backup b USING (product_id, warehouse_id);

SELECT c.username, c.is_admin, b.is_admin AS original_is_admin,
       c.is_active, b.is_active AS original_is_active
FROM CUSTOMER c JOIN demo_member_backup b USING (customer_id);
```

SQLite는 `GRANT`와 `REVOKE`를 지원하지 않습니다. 여기서 바꾸는 `CUSTOMER.is_admin`은 쇼핑몰 앱의 역할입니다.
