
import os
from pathlib import Path
from tempfile import TemporaryDirectory

from database import connect, initialize

with TemporaryDirectory() as temp:
    db_path = Path(temp) / "full_api_test.sqlite3"
    os.environ["SHOP_DATABASE"] = str(db_path)
    initialize(db_path)

    owner_key = "full-api-test-user"

    # 테스트 상품과 장바구니 준비
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
        db.execute("""
            INSERT INTO CART_ITEM (cart_id, product_id, quantity)
            VALUES (?, ?, ?)
        """, (cart.lastrowid, product_id, 2))

    from app import app

    app.config["TESTING"] = True
    client = app.test_client()

    with client.session_transaction() as session:
        session["visitor"] = owner_key

    shipping = {
        "recipient": "테스트 고객",
        "phone": "01012345678",
        "postalCode": "06978",
        "address": "서울특별시 동작구",
        "addressDetail": "101호",
        "memo": "문 앞에 놓아주세요"
    }

    # 1. 주문 API
    response = client.post("/api/orders", json=shipping)
    assert response.status_code == 200, response.get_json()

    order_code = response.get_json()["orderId"]
    print("1. 주문 생성 API 통과")
    
    
    # 주문 직후 배송 정보 저장 확인
    with connect(db_path) as db:
        saved = db.execute(
            """
            SELECT s.recipient, s.phone,
                   s.postal_code, s.shipping_address,
                   s.address_detail, s.memo,
                   s.shipping_status
            FROM SHIPMENT s
            JOIN ORDERS o ON s.order_id = o.order_id
            WHERE o.order_code = ?
            """,
            (order_code,)
        ).fetchone()

        assert saved is not None
        assert saved["recipient"] == shipping["recipient"]
        assert saved["phone"] == shipping["phone"]
        assert saved["postal_code"] == shipping["postalCode"]
        assert saved["shipping_address"] == shipping["address"]
        assert saved["address_detail"] == shipping["addressDetail"]
        assert saved["memo"] == shipping["memo"]
        assert saved["shipping_status"] is None

    print("1-1. 주문 시 배송 정보 DB 저장 통과")


    # 2. 결제 API
    response = client.post(
        f"/api/orders/{order_code}/payment",
        json={
            "success": True,
            "paymentMethod": "카드"
        }
    )
    assert response.status_code == 200, response.get_json()
    assert response.get_json()["paymentStatus"] == "완료"
    print("2. 모의 결제 API 통과")

    # 관리자 세션으로 전환
    admin_client = app.test_client()

    with admin_client.session_transaction() as session:
        session["username"] = "ADMIN"

    # 3. 배송 등록 API
    response = admin_client.post(
        f"/api/orders/{order_code}/shipment",
        json=shipping
    )
    assert response.status_code == 200, response.get_json()
    assert response.get_json()["shippingStatus"] == "배송준비"
    print("3. 배송 등록 API 통과")

    # 4. 배송중
    response = admin_client.patch(
        f"/api/orders/{order_code}/shipment",
        json={"status": "배송중"}
    )
    assert response.status_code == 200, response.get_json()
    print("4. 배송중 변경 API 통과")

    # 5. 배송완료
    response = admin_client.patch(
        f"/api/orders/{order_code}/shipment",
        json={"status": "배송완료"}
    )
    assert response.status_code == 200, response.get_json()
    print("5. 배송완료 변경 API 통과")

    # 6. 최종 DB 확인
    with connect(db_path) as db:
        result = db.execute("""
            SELECT o.order_status, o.warehouse_id,
                   p.payment_status, p.payment_method,
                   s.shipping_status
            FROM ORDERS o
            JOIN PAYMENT p ON o.order_id = p.order_id
            JOIN SHIPMENT s ON o.order_id = s.order_id
            WHERE o.order_code = ?
        """, (order_code,)).fetchone()

        stock = db.execute("""
            SELECT quantity
            FROM INVENTORY
            WHERE product_id = ? AND warehouse_id = 1
        """, (product_id,)).fetchone()[0]

        assert result["order_status"] == "완료"
        assert result["warehouse_id"] == 1
        assert result["payment_status"] == "완료"
        assert result["payment_method"] == "카드"
        assert result["shipping_status"] == "배송완료"
        assert stock == 8

    print("6. 최종 DB 상태 확인 통과")
    
    
    # 7. 기존 쇼핑몰 조회 API 테스트
    response = client.get("/api/shop")
    assert response.status_code == 200, response.get_json()

    shop = response.get_json()
    order = next(
        o for o in shop["orders"]
        if o["id"] == order_code
    )

    assert order["status"] == "완료"
    assert order["paymentStatus"] == "완료"
    assert order["shippingStatus"] == "배송완료"

    print("7. 쇼핑몰 조회 API 통과")

    # 8. 장바구니 변경 후 주문 상태 유지 확인
    response = client.put(
        f"/api/cart/items/{product_id}",
        json={"quantity": 1}
    )

    assert response.status_code == 200, response.get_json()

    with connect(db_path) as db:
        result = db.execute("""
            SELECT o.order_status,
                   p.payment_status,
                   s.shipping_status
            FROM ORDERS o
            JOIN PAYMENT p ON o.order_id = p.order_id
            JOIN SHIPMENT s ON o.order_id = s.order_id
            WHERE o.order_code = ?
        """, (order_code,)).fetchone()

        assert result["order_status"] == "완료"
        assert result["payment_status"] == "완료"
        assert result["shipping_status"] == "배송완료"

    print("8. 장바구니 변경 후 기존 주문 상태 유지 통과")

    print("\n전체 Flask API 통합 테스트 통과!")
