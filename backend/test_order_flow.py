
from pathlib import Path
from tempfile import TemporaryDirectory

from database import (
    connect,
    initialize,
    create_order,
    process_payment,
    register_shipment,
    update_shipping_status
)

with TemporaryDirectory() as temp:
    db_path = Path(temp) / "order_flow.sqlite3"
    initialize(db_path)

    owner_key = "flow-test-user"

    # 1. 상품 및 장바구니 준비
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
            INSERT INTO INVENTORY (
                product_id, warehouse_id, quantity
            )
            VALUES (?, 1, 10)
            ON CONFLICT(product_id, warehouse_id)
            DO UPDATE SET quantity = 10
        """, (product_id,))

        cart = db.execute(
            "INSERT INTO CART (owner_key) VALUES (?)",
            (owner_key,)
        )

        db.execute(
            "INSERT INTO CART_ITEM VALUES (?, ?, ?)",
            (cart.lastrowid, product_id, 2)
        )

    # 2. 주문 생성
    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        order_code = create_order(
            db, owner_key, warehouse_id=1
        )

    with connect(db_path) as db:
        order = db.execute("""
            SELECT warehouse_id, order_status
            FROM ORDERS
            WHERE order_code = ?
        """, (order_code,)).fetchone()

        stock = db.execute("""
            SELECT quantity FROM INVENTORY
            WHERE product_id = ? AND warehouse_id = 1
        """, (product_id,)).fetchone()[0]

        assert order["warehouse_id"] == 1
        assert order["order_status"] == "주문접수"
        assert stock == 8

    print("1. 주문 생성 및 재고 차감 통과")

    # 3. 모의 결제
    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        process_payment(
            db, order_code,
            success=True,
            payment_method="카드"
        )

    print("2. 모의 결제 완료 통과")

    # 4. 배송 등록
    shipping = {
        "recipient": "테스트 고객",
        "phone": "01012345678",
        "postalCode": "06978",
        "address": "서울특별시 동작구",
        "addressDetail": "101호",
        "memo": "문 앞에 놓아주세요"
    }

    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        register_shipment(db, order_code, shipping)

    print("3. 배송 정보 등록 통과")

    # 5. 배송 상태 변경
    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        update_shipping_status(db, order_code, "배송중")

    print("4. 배송중 변경 통과")

    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        update_shipping_status(db, order_code, "배송완료")

    # 6. 최종 DB 상태 확인
    with connect(db_path) as db:
        result = db.execute("""
            SELECT o.order_status,
                   p.payment_status,
                   p.payment_method,
                   s.shipping_status
            FROM ORDERS o
            JOIN PAYMENT p ON o.order_id = p.order_id
            JOIN SHIPMENT s ON o.order_id = s.order_id
            WHERE o.order_code = ?
        """, (order_code,)).fetchone()

        assert result["order_status"] == "완료"
        assert result["payment_status"] == "완료"
        assert result["payment_method"] == "카드"
        assert result["shipping_status"] == "배송완료"

    print("5. 배송 완료 및 주문 완료 통과")
    print("\n전체 주문·결제·배송 통합 테스트 통과!")
