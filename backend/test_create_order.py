
from pathlib import Path
from tempfile import TemporaryDirectory

from database import connect, initialize, create_order

with TemporaryDirectory() as temp:
    db_path = Path(temp) / "order_test.sqlite3"
    initialize(db_path)

    with connect(db_path) as db:
        # 테스트용 상품 1개 선택
        product = db.execute(
            "SELECT product_id FROM PRODUCT LIMIT 1"
        ).fetchone()
        assert product is not None, "테스트 상품이 없습니다."

        product_id = product["product_id"]

        # 기본 창고 재고를 10개로 설정
        db.execute("""
            INSERT INTO INVENTORY
            (product_id, warehouse_id, quantity)
            VALUES (?, 1, 10)
            ON CONFLICT(product_id, warehouse_id)
            DO UPDATE SET quantity = 10
        """, (product_id,))

        # 테스트 장바구니 생성
        db.execute(
            "INSERT INTO CART (owner_key) VALUES (?)",
            ("test-order-user",)
        )

        cart_id = db.execute(
            "SELECT cart_id FROM CART WHERE owner_key = ?",
            ("test-order-user",)
        ).fetchone()["cart_id"]

        db.execute(
            "INSERT INTO CART_ITEM VALUES (?, ?, ?)",
            (cart_id, product_id, 3)
        )

    # 주문 생성 및 재고 차감
    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        order_code = create_order(
            db, "test-order-user", warehouse_id=1
        )

    # 결과 확인
    with connect(db_path) as db:
        stock = db.execute(
            "SELECT quantity FROM INVENTORY "
            "WHERE product_id=? AND warehouse_id=1",
            (product_id,)
        ).fetchone()["quantity"]

        order = db.execute(
            "SELECT * FROM ORDERS WHERE order_code=?",
            (order_code,)
        ).fetchone()

        item_count = db.execute(
            "SELECT COUNT(*) FROM ORDER_ITEM "
            "WHERE order_id=?",
            (order["order_id"],)
        ).fetchone()[0]

        cart_count = db.execute(
            "SELECT COUNT(*) FROM CART_ITEM "
            "WHERE cart_id=?",
            (cart_id,)
        ).fetchone()[0]

        assert stock == 7
        assert order is not None
        assert item_count == 1
        assert cart_count == 0

        print("주문 생성:", order_code)
        print("남은 재고:", stock)
        print("주문 항목:", item_count)
        print("장바구니 잔여 항목:", cart_count)
        print("주문 생성 테스트 통과!")
        
    from database import load_state

    with connect(db_path) as db:
        state = load_state(db)
        assert any(o["id"] == order_code for o in state["orders"])

    print("주문 조회 테스트 통과!")


    # 재고 부족 테스트
    with connect(db_path) as db:
        db.execute(
            "INSERT INTO CART_ITEM VALUES (?, ?, ?)",
            (cart_id, product_id, 8)
        )

    try:
        with connect(db_path) as db:
            db.execute("BEGIN IMMEDIATE")
            create_order(db, "test-order-user", warehouse_id=1)
        raise AssertionError("재고 부족인데 주문이 성공했습니다.")

    except ValueError as e:
        print("재고 부족 오류:", e)

    # 주문 실패 후 데이터 검증
    with connect(db_path) as db:
        stock = db.execute(
            "SELECT quantity FROM INVENTORY "
            "WHERE product_id=? AND warehouse_id=1",
            (product_id,)
        ).fetchone()["quantity"]

        order_count = db.execute(
            "SELECT COUNT(*) FROM ORDERS"
        ).fetchone()[0]

        cart_quantity = db.execute(
            "SELECT quantity FROM CART_ITEM "
            "WHERE cart_id=? AND product_id=?",
            (cart_id, product_id)
        ).fetchone()["quantity"]

        assert stock == 7
        assert order_count == 1
        assert cart_quantity == 8

        print("재고 부족 테스트 통과!")
    
    
    from database import cancel_order

    # 정상 주문 취소
    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        cancel_order(db, order_code, warehouse_id=1)

    with connect(db_path) as db:
        stock = db.execute(
            "SELECT quantity FROM INVENTORY "
            "WHERE product_id=? AND warehouse_id=1",
            (product_id,)
        ).fetchone()["quantity"]

        order_status = db.execute(
            "SELECT order_status FROM ORDERS WHERE order_code=?",
            (order_code,)
        ).fetchone()["order_status"]

        assert stock == 10
        assert order_status == "취소"

    print("주문 취소 및 재고 복구 테스트 통과!")

    # 중복 취소 방지
    try:
        with connect(db_path) as db:
            db.execute("BEGIN IMMEDIATE")
            cancel_order(db, order_code, warehouse_id=1)
        raise AssertionError("이미 취소한 주문을 다시 취소했습니다.")

    except ValueError as e:
        print("중복 취소 차단:", e)

    with connect(db_path) as db:
        stock = db.execute(
            "SELECT quantity FROM INVENTORY "
            "WHERE product_id=? AND warehouse_id=1",
            (product_id,)
        ).fetchone()["quantity"]

        assert stock == 10

    print("중복 취소 방지 테스트 통과!")

