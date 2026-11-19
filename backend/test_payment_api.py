
import os
from pathlib import Path
from tempfile import TemporaryDirectory

from database import connect, initialize, create_order

with TemporaryDirectory() as temp:
    db_path = Path(temp) / "payment_api_test.sqlite3"

    # Flask가 테스트 DB를 사용하도록 설정
    os.environ["SHOP_DATABASE"] = str(db_path)
    initialize(db_path)

    owner_key = "payment-api-test-user"

    # 테스트 주문 준비
    with connect(db_path) as db:
        product = db.execute(
            "SELECT product_id FROM PRODUCT "
            "WHERE status = '판매중' LIMIT 1"
        ).fetchone()

        assert product is not None, "테스트 상품이 없습니다."
        product_id = product["product_id"]

        db.execute("""
            INSERT INTO INVENTORY (product_id, warehouse_id, quantity)
            VALUES (?, 1, 10)
            ON CONFLICT(product_id, warehouse_id)
            DO UPDATE SET quantity = 10
        """, (product_id,))

        cursor = db.execute(
            "INSERT INTO CART (owner_key) VALUES (?)",
            (owner_key,)
        )

        db.execute(
            "INSERT INTO CART_ITEM VALUES (?, ?, ?)",
            (cursor.lastrowid, product_id, 1)
        )

    with connect(db_path) as db:
        db.execute("BEGIN IMMEDIATE")
        order_code = create_order(db, owner_key, warehouse_id=1)

    # 테스트용 Flask 클라이언트
    from app import app

    app.config["TESTING"] = True
    client = app.test_client()

    # 주문 소유자와 동일한 비회원 세션 설정
    with client.session_transaction() as session:
        session["visitor"] = owner_key

    url = f"/api/orders/{order_code}/payment"

    # 1. 결제 실패
    response = client.post(url, json={"success": False})
    assert response.status_code == 200, response.get_json()
    assert response.get_json()["paymentStatus"] == "실패"
    print("결제 실패 API 통과")

    # 2. 결제 재시도 및 완료
    response = client.post(url, json={"success": True})
    assert response.status_code == 200, response.get_json()
    assert response.get_json()["paymentStatus"] == "완료"
    print("결제 완료 API 통과")

    # 3. 중복 결제 차단
    response = client.post(url, json={"success": True})
    assert response.status_code == 409, response.get_json()
    print("중복 결제 차단 통과")

    # 4. 다른 고객의 결제 요청 차단
    other_client = app.test_client()
    with other_client.session_transaction() as session:
        session["visitor"] = "another-user"

    response = other_client.post(url, json={"success": True})
    assert response.status_code == 403, response.get_json()
    print("다른 고객 접근 차단 통과")

    # 5. 실제 DB 결제 상태 확인
    with connect(db_path) as db:
        payment = db.execute("""
            SELECT p.payment_status
            FROM PAYMENT p
            JOIN ORDERS o ON p.order_id = o.order_id
            WHERE o.order_code = ?
        """, (order_code,)).fetchone()

        assert payment["payment_status"] == "완료"

    print("\n모든 모의 결제 API 테스트 통과!")
