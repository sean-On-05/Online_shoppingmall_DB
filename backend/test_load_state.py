
from pathlib import Path
from tempfile import TemporaryDirectory

from database import connect, initialize, create_order, load_state

with TemporaryDirectory() as temp:
    db_path = Path(temp) / "load_state_test.sqlite3"
    initialize(db_path)

    owner_key = "load-state-test-user"

    # 테스트용 장바구니 준비
    with connect(db_path) as db:
        product = db.execute("""
            SELECT product_id
            FROM PRODUCT
            WHERE status = '판매중'
            LIMIT 1
        """).fetchone()

        assert product is not None
        product_id = product["product_id"]

        db.execute("""
            INSERT INTO INVENTORY (product_id, warehouse_id, quantity)
            VALUES (?, 1, 10)
            ON CONFLICT(product_id, warehouse_id)
            DO UPDATE SET quantity = 10
        """, (product_id,))

        cart = db.execute(
            "INSERT INTO CART (owner_key) VALUES (?)",
            (owner_key,)
        )

        db.execute(
            "INSERT INTO CART_ITEM (cart_id, product_id, quantity)"
            " VALUES (?, ?, ?)",
            (cart.lastrowid, product_id, 2)
        )

    # 결제·배송 없이 주문만 생성
    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        order_code = create_order(db, owner_key, warehouse_id=1)

    # load_state() 조회 테스트
    with connect(db_path) as db:
        state = load_state(db)

        payment_count = db.execute("""
            SELECT COUNT(*)
            FROM PAYMENT
        """).fetchone()[0]

        shipment_count = db.execute("""
            SELECT COUNT(*)
            FROM SHIPMENT
        """).fetchone()[0]

    order = next(
        o for o in state["orders"]
        if o["id"] == order_code
    )

    assert order["status"] == "주문접수"
    assert len(order["items"]) == 1
    assert payment_count == 0
    assert shipment_count == 0

    # 결제·배송 미등록 상태의 기본 표시값
    assert order["paymentStatus"] == "대기"
    assert order["shippingStatus"] is None

    print("주문 조회 성공")
    print("결제 미등록 주문 조회 성공")
    print("배송 미등록 주문 조회 성공")
    print("\nload_state 테스트 통과!")
