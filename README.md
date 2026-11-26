# SSU Mall — 온라인 쇼핑몰 주문·재고 관리

데이터베이스 수업 기말 팀 프로젝트입니다. 숭실대 굿즈를 판매하는 쇼핑몰을 만들고, 주문이 들어오거나 취소될 때 재고가 어떻게 바뀌는지 구현했습니다.

- [배포 사이트](https://online-shoppingmall-db.vercel.app/)
- [백엔드 API 상태 확인](https://h21yess12.pythonanywhere.com/api/health)
- [PythonAnywhere 관리 페이지](https://www.pythonanywhere.com/user/h21yess12/) (로그인 및 접근 권한 필요)

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

발표에서는 **PythonAnywhere의 Bash**에서 배포 DB를 열고, 결과는 **공개 쇼핑몰**에서 확인합니다.

### 배포 DB 열기

PythonAnywhere의 **Consoles → Bash**를 엽니다. 프로젝트 루트에서 아래 두 줄을 실행하세요. 이미 프롬프트 경로가 `~/Online_shoppingmall_DB/backend`로 끝나면 첫 줄은 건너뜁니다. 홈 폴더에서 시작했다면 먼저 `cd ~/Online_shoppingmall_DB`를 실행하세요.

```bash
cd backend
sqlite3 -cmd ".timeout 5000" -cmd ".headers on" -cmd ".mode column" "file:shop.sqlite3?mode=rw"
```

`shop.sqlite3`는 Flask의 기본 DB입니다. 배포 설정에 `SHOP_DATABASE`가 있으면 명령의 파일명을 **그 DB의 실제 경로**로 바꾸세요. `mode=rw`는 파일이 없을 때 새 DB를 만드는 대신 오류를 반환합니다.

`sqlite>`가 뜨면 아래 SQL 블록을 **한 단계씩** 붙여넣으세요. 1~3번의 변경은 실행에 성공하면 바로 저장됩니다. **복원이 끝날 때까지 같은 SQLite 콘솔을 열어 두세요.**

### 0. 대상 확인 및 백업

예시는 상품 **101번**과 `user` 계정을 사용합니다. 다른 대상을 쓰려면 백업을 만들기 전에 아래 `WHERE`를 바꾸세요. 같은 연결에서 이 블록을 다시 실행해도 최초 백업값을 유지합니다.

```sql
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

CREATE TEMP TABLE IF NOT EXISTS demo_inventory_backup AS
SELECT * FROM INVENTORY
WHERE product_id = 101;

CREATE TEMP TABLE IF NOT EXISTS demo_member_backup AS
SELECT customer_id, is_admin, is_active
FROM CUSTOMER WHERE username = 'user';

SELECT * FROM demo_inventory_backup;
SELECT * FROM demo_member_backup;

SELECT '재고 백업' AS item, COUNT(*) AS rows_saved FROM demo_inventory_backup
UNION ALL
SELECT '계정 백업', COUNT(*) FROM demo_member_backup;
```

마지막 결과에서 재고 백업이 1행 이상이면 1번을 진행합니다. 2~3번을 실행하려면 계정 백업도 1행이어야 합니다. 원래 재고 수량도 적어 두세요. 주문 목록이 비어 있어도 재고 시연은 가능합니다.

### 1. 재고 소진과 복원

**1-A. 재고 0개로 변경.** 블록을 실행해 `quantity`가 0인지 확인하세요. [공개 쇼핑몰의 101번 상품 상세](https://online-shoppingmall-db.vercel.app/#/products/101)를 새로고침해 품절 표시를 확인합니다.

```sql
UPDATE INVENTORY SET quantity = 0
WHERE (product_id, warehouse_id) IN (
    SELECT product_id, warehouse_id FROM demo_inventory_backup
);

SELECT p.product_name, i.warehouse_id, i.quantity
FROM INVENTORY i JOIN PRODUCT p USING (product_id)
WHERE i.product_id IN (SELECT product_id FROM demo_inventory_backup);
```

**1-B. 재고 복원.** 아래 블록을 실행한 뒤 공개 쇼핑몰을 다시 새로고침합니다. 결과표의 `quantity`와 `original_quantity`가 같아야 합니다.

```sql
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

SELECT i.product_id, i.warehouse_id, i.quantity, b.quantity AS original_quantity
FROM INVENTORY i JOIN demo_inventory_backup b USING (product_id, warehouse_id);
```

### 2. 관리자 권한 부여와 회수

**2-A.** 시연 계정에 앱 관리자 권한을 준 뒤 공개 쇼핑몰에서 그 계정으로 로그인합니다.

```sql
UPDATE CUSTOMER SET is_admin = 1, is_active = 1
WHERE customer_id IN (SELECT customer_id FROM demo_member_backup);
```

쇼핑몰 탭의 브라우저 개발자 도구 Console에서 아래 코드를 실행하면 `200`이 나옵니다.

```js
fetch('/api/admin/members').then(response => console.log(response.status))
```

**2-B.** 아래 SQL을 실행해 관리자 권한을 회수합니다. 같은 로그인 세션에서 위 요청을 다시 보내 `403`을 확인합니다. 실제 접근 허용 여부는 API 응답으로 확인합니다.

```sql
UPDATE CUSTOMER SET is_admin = 0
WHERE customer_id IN (SELECT customer_id FROM demo_member_backup);
```

### 3. 계정 정지와 원상 복원

**3-A.** 시연 계정이 로그인한 상태에서 아래 SQL로 계정을 정지합니다.

```sql
UPDATE CUSTOMER SET is_active = 0
WHERE customer_id IN (SELECT customer_id FROM demo_member_backup);
```

정지 직후 같은 브라우저 Console에서 아래 요청을 보내면 `403`이 나옵니다.

```js
fetch('/api/me').then(response => console.log(response.status))
```

**3-B.** 권한과 계정 상태를 원래 값으로 돌립니다.

```sql
UPDATE CUSTOMER SET
    is_admin = (SELECT b.is_admin FROM demo_member_backup b
                WHERE b.customer_id = CUSTOMER.customer_id),
    is_active = (SELECT b.is_active FROM demo_member_backup b
                 WHERE b.customer_id = CUSTOMER.customer_id)
WHERE customer_id IN (SELECT customer_id FROM demo_member_backup);
```

### 4. 제약조건 오류 확인

각 블록은 하나씩 실행합니다. 표시된 제약조건 오류가 나오면 해당 SQL 문장이 거절된 것입니다.

**4-A. 음수 재고** — `CHECK constraint failed`

```sql
UPDATE INVENTORY SET quantity = -1
WHERE product_id = (SELECT MIN(product_id) FROM INVENTORY);
```

**4-B. 중복 아이디** — `UNIQUE constraint failed`

```sql
INSERT INTO CUSTOMER (username, name, password_hash)
SELECT username, '중복 테스트', 'not-a-login-hash'
FROM CUSTOMER ORDER BY customer_id LIMIT 1;
```

**4-C. 존재하지 않는 상품의 재고** — `FOREIGN KEY constraint failed`. 창고가 하나 이상 있어야 합니다. 아래 확인 블록의 결과가 `1`일 때만 INSERT를 실행하세요. `0`이면 0번의 `PRAGMA foreign_keys = ON;`을 실행하고 다시 확인하세요.

```sql
PRAGMA foreign_keys;
```

```sql
INSERT INTO INVENTORY (product_id, warehouse_id, quantity)
SELECT (SELECT COALESCE(MAX(product_id), 0) + 1 FROM PRODUCT),
       MIN(warehouse_id), 1
FROM WAREHOUSE
HAVING COUNT(*) > 0;
```

**4-D. 주문 합계 불일치** — `CHECK constraint failed`. 주문이 하나 이상 있어야 합니다.

```sql
UPDATE ORDERS SET total_amount = subtotal + shipping_fee + 1
WHERE order_id = (SELECT MIN(order_id) FROM ORDERS);
```

### 5. DB 제약조건과 앱의 주문 규칙

현재 스키마에서는 주문 상태와 배송 상태의 허용값을 각각 검사합니다. SQL로 직접 쓰면 취소 주문에 배송완료를 지정할 수 있습니다. 배송 정보가 있는 주문이 있을 때 블록 전체를 실행합니다. 마지막 두 줄이 변경을 되돌리므로 이 단계의 변경은 웹에 반영되지 않습니다. 중간에 오류로 멈추면 아래 블록 끝의 `ROLLBACK TO demo_cross_table;`과 `RELEASE demo_cross_table;`을 실행해 되돌리세요.

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


### SQLite 종료

재고와 권한 복원을 확인한 뒤 `sqlite>`에서 아래 명령을 입력합니다. Bash로 돌아가면 `clear`로 화면을 지울 수 있습니다.

```text
.quit
```
