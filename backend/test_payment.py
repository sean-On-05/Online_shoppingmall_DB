
from pathlib import Path
from tempfile import TemporaryDirectory

from database import connect, initialize, create_order, process_payment

with TemporaryDirectory() as temp:
    db_path = Path(temp) / "payment_test.sqlite3"
    initialize(db_path)

    # 테스트용 장바구니 준비
    with connect(db_path) as db:
        product = db.execute(
            "SELECT product_id FROM PRODUCT "
            "WHERE status = '판매중' LIMIT 1"
        ).fetchone()

        assert product is not None, "판매 중인 테스트 상품이 없습니다."
        product_id = product["product_id"]

        db.execute("""
            INSERT INTO INVENTORY (product_id, warehouse_id, quantity)
            VALUES (?, 1, 10)
            ON CONFLICT(product_id, warehouse_id)
            DO UPDATE SET quantity = 10
        """, (product_id,))

        cursor = db.execute(
            "INSERT INTO CART (owner_key) VALUES (?)",
            ("payment-test-user",)
        )

        db.execute(
            "INSERT INTO CART_ITEM VALUES (?, ?, ?)",
            (cursor.lastrowid, product_id, 1)
        )

    # 주문 생성
    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        order_code = create_order(db, "payment-test-user")

    print("주문 생성 완료:", order_code)

    # 1. 결제 실패 테스트
    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        result = process_payment(db, order_code, success=False)
        assert result == "실패"

    print("결제 실패 처리 통과")

    # 2. 실패 후 재시도 → 결제 완료
    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        result = process_payment(db, order_code, success=True)
        assert result == "완료"

    print("결제 재시도 및 완료 처리 통과")

    # 3. 실제 DB 기록 확인
    with connect(db_path) as db:
        payment = db.execute("""
            SELECT p.payment_status, p.payment_date
            FROM PAYMENT p
            JOIN ORDERS o ON p.order_id = o.order_id
            WHERE o.order_code = ?
        """, (order_code,)).fetchone()

        assert payment["payment_status"] == "완료"
        assert payment["payment_date"] is not None

        count = db.execute("""
            SELECT COUNT(*)
            FROM PAYMENT p
            JOIN ORDERS o ON p.order_id = o.order_id
            WHERE o.order_code = ?
        """, (order_code,)).fetchone()[0]

        assert count == 1

    print("PAYMENT 테이블 저장 확인 통과")

    # 4. 중복 결제 방지
    try:
        with connect(db_path) as db:
            db.execute("BEGIN IMMEDIATE")
            process_payment(db, order_code, success=True)
    except ValueError:
        print("중복 결제 차단 통과")
    else:
        raise AssertionError("중복 결제가 허용되었습니다.")

    print("\n모든 모의 결제 테스트 통과!")
