
import sqlite3
from database import register_shipment

db = sqlite3.connect(":memory:")
db.row_factory = sqlite3.Row
db.execute("PRAGMA foreign_keys = ON")

# 배송 등록 테스트에 필요한 최소 테이블
db.executescript("""
CREATE TABLE ORDERS (
    order_id INTEGER PRIMARY KEY,
    order_code TEXT NOT NULL UNIQUE,
    order_status TEXT NOT NULL
        CHECK (order_status IN ('주문접수', '처리중', '완료', '취소'))
);

CREATE TABLE PAYMENT (
    payment_id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL UNIQUE REFERENCES ORDERS(order_id),
    payment_status TEXT NOT NULL
);

CREATE TABLE SHIPMENT (
    shipment_id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL UNIQUE REFERENCES ORDERS(order_id),
    shipping_address TEXT NOT NULL,
    shipping_status TEXT,
    recipient TEXT NOT NULL,
    phone TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    address_detail TEXT NOT NULL DEFAULT '',
    memo TEXT NOT NULL DEFAULT ''
);
""")

db.execute(
    "INSERT INTO ORDERS VALUES (1, 'SSU-TEST-001', '주문접수')"
)
db.execute(
    "INSERT INTO PAYMENT VALUES (1, 1, '완료')"
)

shipping = {
    "recipient": "테스트 고객",
    "phone": "01012345678",
    "postalCode": "06978",
    "address": "서울특별시 동작구",
    "addressDetail": "101호",
    "memo": "문 앞에 놓아주세요"
}

# 배송 정보는 주문을 만들 때 저장한다.
db.execute(
    """INSERT INTO SHIPMENT
       (order_id, shipping_address, recipient, phone, postal_code, address_detail, memo)
       VALUES (1, ?, ?, ?, ?, ?, ?)""",
    (shipping["address"], shipping["recipient"], shipping["phone"],
     shipping["postalCode"], shipping["addressDetail"], shipping["memo"])
)

# 1. 정상 배송 등록
with db:
    result = register_shipment(db, "SSU-TEST-001", shipping)

assert result == "배송준비"

shipment = db.execute(
    "SELECT * FROM SHIPMENT WHERE order_id = 1"
).fetchone()

order = db.execute(
    "SELECT order_status FROM ORDERS WHERE order_id = 1"
).fetchone()

assert shipment["shipping_status"] == "배송준비"
assert shipment["recipient"] == "테스트 고객"
assert order["order_status"] == "처리중"

print("배송 등록 테스트 통과")

# 2. 중복 배송 등록 방지
try:
    with db:
        register_shipment(db, "SSU-TEST-001", shipping)
except ValueError:
    print("중복 배송 등록 차단 통과")
else:
    raise AssertionError("중복 배송 등록이 허용되었습니다.")

# 3. 결제 미완료 주문 차단
db.execute(
    "INSERT INTO ORDERS VALUES (2, 'SSU-TEST-002', '주문접수')"
)
db.execute(
    "INSERT INTO PAYMENT VALUES (2, 2, '실패')"
)
db.commit()

try:
    with db:
        register_shipment(db, "SSU-TEST-002", shipping)
except ValueError:
    print("결제 미완료 배송 등록 차단 통과")
else:
    raise AssertionError("결제 실패 주문에 배송 등록이 허용되었습니다.")

print("\n모든 배송 등록 테스트 통과!")
db.close()
