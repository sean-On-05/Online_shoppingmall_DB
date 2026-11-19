
import sqlite3
from database import restore_inventory

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
    "INSERT INTO INVENTORY VALUES (101, 1, 7)"
)

restore_inventory(db, 101, 1, 3)

stock = db.execute(
    """
    SELECT quantity
    FROM INVENTORY
    WHERE product_id = 101
      AND warehouse_id = 1
    """
).fetchone()[0]

assert stock == 10

print("복구 후 재고:", stock)
print("재고 복구 테스트 통과!")

db.close()
