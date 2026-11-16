
from pathlib import Path
from tempfile import TemporaryDirectory

from database import (
    connect,
    initialize,
    create_order,
    process_payment,
    cancel_order,
    register_shipment
)

with TemporaryDirectory() as temp:
    db_path = Path(temp) / "cancel_flow.sqlite3"
    initialize(db_path)

    owner_key = "cancel-test-user"

    # 1. 상품 재고 및 장바구니 준비
    with connect(db_path) as db:
        product = db.execute("""
            SELECT product_id FROM PRODUCT
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
            "INSERT INTO CART_ITEM VALUES (?, ?, ?)",
            (cart.lastrowid, product_id, 3)
        )

    # 2. 주문 생성 및 재고 차감
    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        order_code = create_order(db, owner_key, warehouse_id=1)

    with connect(db_path) as db:
        stock = db.execute("""
            SELECT quantity FROM INVENTORY
            WHERE product_id = ? AND warehouse_id = 1
        """, (product_id,)).fetchone()[0]

        assert stock == 7

    print("1. 주문 생성 및 재고 차감 통과")

    # 3. 모의 결제 완료
    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        process_payment(db, order_code, success=True)

    print("2. 모의 결제 완료 통과")

    # 4. 주문 취소
    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        cancel_order(db, order_code)

    # 5. 상태 및 재고 복구 확인
    with connect(db_path) as db:
        result = db.execute("""
            SELECT o.order_status, o.warehouse_id,
                   p.payment_status
            FROM ORDERS o
            JOIN PAYMENT p ON o.order_id = p.order_id
            WHERE o.order_code = ?
        """, (order_code,)).fetchone()

        stock = db.execute("""
            SELECT quantity FROM INVENTORY
            WHERE product_id = ? AND warehouse_id = 1
        """, (product_id,)).fetchone()[0]

        assert result["order_status"] == "취소"
        assert result["payment_status"] == "취소"
        assert result["warehouse_id"] == 1
        assert stock == 10

    print("3. 주문·결제 취소 및 재고 복구 통과")

    # 6. 중복 취소 방지
    try:
        with connect(db_path) as db:
            db.execute("BEGIN IMMEDIATE")
            cancel_order(db, order_code)
    except ValueError:
        print("4. 중복 취소 차단 통과")
    else:
        raise AssertionError("중복 취소가 허용되었습니다.")

    # 7. 취소된 주문의 배송 등록 차단
    shipping = {
        "recipient": "테스트 고객",
        "phone": "01012345678",
        "postalCode": "06978",
        "address": "서울특별시 동작구",
        "addressDetail": "101호",
        "memo": ""
    }

    try:
        with connect(db_path) as db:
            db.execute("BEGIN IMMEDIATE")
            register_shipment(db, order_code, shipping)
    except ValueError:
        print("5. 취소된 주문 배송 등록 차단 통과")
    else:
        raise AssertionError("취소된 주문에 배송 등록이 허용되었습니다.")

    print("\n전체 주문 취소 통합 테스트 통과!")
