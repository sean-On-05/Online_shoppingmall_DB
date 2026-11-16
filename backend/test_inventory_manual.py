
import sqlite3
from database import deduct_inventory

# 실제 DB에 영향을 주지 않는 임시 DB
db = sqlite3.connect(":memory:")

db.execute("""
    CREATE TABLE INVENTORY (
        product_id INTEGER,
        warehouse_id INTEGER,
        quantity INTEGER NOT NULL CHECK(quantity >= 0),
        PRIMARY KEY (product_id, warehouse_id)
    )
""")

db.execute(
    "INSERT INTO INVENTORY VALUES (101, 1, 10)"
)

# 정상 재고 차감: 10개 -> 7개
deduct_inventory(db, 101, 1, 3)

stock = db.execute(
    "SELECT quantity FROM INVENTORY WHERE product_id=101 AND warehouse_id=1"
).fetchone()[0]

print("차감 후 재고:", stock)
assert stock == 7

# 재고 부족 상황 검증
try:
    deduct_inventory(db, 101, 1, 10)
except ValueError as e:
    print("재고 부족 처리:", e)

stock = db.execute(
    "SELECT quantity FROM INVENTORY WHERE product_id=101 AND warehouse_id=1"
).fetchone()[0]

assert stock == 7
print("재고 차감 테스트 통과")

db.close()
