"""판매 중지 회귀 테스트. 운영 DB 대신 임시 DB만 사용한다."""
import os
import tempfile
import unittest
from pathlib import Path

temporary = tempfile.TemporaryDirectory()
os.environ['SHOP_DATABASE'] = str(Path(temporary.name) / 'shop.sqlite3')
from app import app  # noqa: E402
from database import connect  # noqa: E402


class ProductVisibilityTest(unittest.TestCase):
    def test_stop_hides_product_without_changing_stock_or_order_history(self):
        admin = app.test_client()
        customer = app.test_client()
        other = app.test_client()
        self.assertEqual(admin.post('/api/session', json={
            'username': 'ADMIN', 'password': 'ADMIN'
        }).status_code, 200)
        pid = 101
        customer.put(f'/api/cart/items/{pid}', json={'quantity': 1})
        response = customer.post('/api/orders', json=dict(
            recipient='테스트', phone='01012345678', postalCode='06978',
            address='테스트 주소', addressDetail='', memo=''
        ))
        self.assertEqual(response.status_code, 200)
        order = response.json['orders'][0]
        for client in (customer, other, admin):
            self.assertEqual(client.put(f'/api/cart/items/{pid}', json={'quantity': 1}).status_code, 200)
        before = admin.get(f'/api/products/{pid}').json
        self.assertGreater(before['stock'], 0)
        self.assertEqual(customer.delete(f'/api/products/{pid}').status_code, 403)
        response = admin.delete(f'/api/products/{pid}')
        self.assertEqual(response.status_code, 200)
        stopped = next(p for p in response.json['products'] if p['id'] == pid)
        self.assertEqual(stopped['status'], '판매중지')
        self.assertEqual(stopped['stock'], before['stock'])
        for client in (customer, other):
            self.assertNotIn(pid, [p['id'] for p in client.get('/api/shop').json['products']])
            self.assertNotIn(pid, [p['id'] for p in client.get('/api/products').json])
            self.assertEqual(client.get(f'/api/products/{pid}').status_code, 404)
            self.assertNotIn(pid, [i['productId'] for i in client.get('/api/shop').json['items']])
            self.assertEqual(client.put(f'/api/cart/items/{pid}', json={'quantity': 1}).status_code, 409)
            self.assertEqual(client.put(f'/api/cart/items/{pid}', json={'quantity': 0}).status_code, 200)
        self.assertEqual(customer.get('/api/shop').json['orders'][0], order)
        self.assertEqual(admin.delete(f'/api/products/{pid}').status_code, 409)
        # Even a stale edit request with status=판매중 must preserve the DB status.
        before['stock'] = 42
        self.assertEqual(admin.put(f'/api/products/{pid}', json=before).status_code, 200)
        persisted = admin.get(f'/api/products/{pid}').json
        self.assertEqual(persisted['status'], '판매중지')
        self.assertEqual(persisted['stock'], 42)
        with connect(os.environ['SHOP_DATABASE']) as db:
            row = db.execute('SELECT status FROM PRODUCT WHERE product_id=?', (pid,)).fetchone()
            self.assertEqual(row['status'], '판매중지')
        self.assertEqual(customer.post(f'/api/products/{pid}/resume', json={}).status_code, 403)
        response = admin.post(f'/api/products/{pid}/resume', json={})
        self.assertEqual(response.status_code, 200)
        resumed = customer.get(f'/api/products/{pid}').json
        self.assertEqual(resumed['status'], '판매중')
        self.assertEqual(resumed['stock'], 42)
        self.assertIn(pid, [p['id'] for p in customer.get('/api/shop').json['products']])
        self.assertIn(pid, [p['id'] for p in customer.get('/api/products').json])
        self.assertEqual(customer.get('/api/shop').json['items'], [])
        self.assertEqual(customer.get('/api/shop').json['orders'][0], order)
        self.assertEqual(customer.put(f'/api/cart/items/{pid}', json={'quantity': 1}).status_code, 200)
        self.assertEqual(admin.post(f'/api/products/{pid}/resume', json={}).status_code, 409)
        self.assertEqual(admin.post('/api/products/999999/resume', json={}).status_code, 404)
        # Resuming does not replenish a sold-out product.
        admin.delete(f'/api/products/{pid}')
        resumed['stock'] = 0
        admin.put(f'/api/products/{pid}', json=resumed)
        self.assertEqual(admin.post(f'/api/products/{pid}/resume', json={}).status_code, 200)
        self.assertEqual(customer.get(f'/api/products/{pid}').json['stock'], 0)
        self.assertEqual(customer.put(f'/api/cart/items/{pid}', json={'quantity': 1}).status_code, 409)


if __name__ == '__main__':
    try:
        unittest.main()
    finally:
        temporary.cleanup()
