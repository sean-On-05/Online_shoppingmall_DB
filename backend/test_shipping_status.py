
import sqlite3

from database import update_shipping_status

# 테스트 전용 메모리 DB
db = sqlite3.connect(":memory:")
db.row_factory = sqlite3.Row
db.execute("PRAGMA foreign_keys = ON")

db.executescript("""
CREATE TABLE ORDERS (
    order_id INTEGER PRIMARY KEY,
    order_code TEXT NOT NULL UNIQUE,
    order_status TEXT NOT NULL
        CHECK (order_status IN ('주문접수', '처리중', '완료', '취소'))
);

CREATE TABLE SHIPMENT (
    shipment_id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL UNIQUE REFERENCES ORDERS(order_id),
    shipping_status TEXT NOT NULL
        CHECK (shipping_status IN ('배송준비', '배송중', '배송완료'))
);
""")

# 배송 등록이 완료된 주문 준비
db.execute(
    "INSERT INTO ORDERS VALUES (1, 'TEST-001', '처리중')"
)
db.execute(
    "INSERT INTO SHIPMENT VALUES (1, 1, '배송준비')"
)
db.commit()

# 1. 배송준비 → 배송중
with db:
    result = update_shipping_status(db, 'TEST-001', '배송중')

assert result == '배송중'
print("배송중 변경 테스트 통과")

# 2. 배송중 → 배송완료
with db:
    result = update_shipping_status(db, 'TEST-001', '배송완료')

assert result == '배송완료'

order = db.execute(
    "SELECT order_status FROM ORDERS WHERE order_id = 1"
).fetchone()

assert order["order_status"] == "완료"
print("배송완료 및 주문 완료 처리 통과")

# 3. 배송완료 → 배송중 변경 차단
try:
    with db:
        update_shipping_status(db, 'TEST-001', '배송중')
except ValueError:
    print("배송 상태 역행 방지 통과")
else:
    raise AssertionError("완료된 배송 상태가 변경되었습니다.")

# 4. 배송 미등록 주문 차단
db.execute(
    "INSERT INTO ORDERS VALUES (2, 'TEST-002', '주문접수')"
)
db.commit()

try:
    with db:
        update_shipping_status(db, 'TEST-002', '배송중')
except ValueError:
    print("배송 미등록 주문 차단 통과")
else:
    raise AssertionError("배송 정보 없는 주문이 변경되었습니다.")

# 5. 실제 DB 상태 최종 확인
shipment = db.execute(
    "SELECT shipping_status FROM SHIPMENT WHERE order_id = 1"
).fetchone()

assert shipment["shipping_status"] == "배송완료"

print("\n모든 배송 상태 변경 테스트 통과!")

db.close()
