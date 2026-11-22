"""Admin member APIs and checkout regression; all writes stay in a temporary directory."""
import importlib.util
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch


class AdminMembersTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        base = Path(cls.temp.name)
        # app.py creates a session secret at import time; isolate that file too.
        shutil.copyfile(Path(__file__).with_name('app.py'), base / 'app.py')
        spec = importlib.util.spec_from_file_location('member_test_app', base / 'app.py')
        cls.server = importlib.util.module_from_spec(spec)
        with patch.dict(os.environ, {'SHOP_DATABASE': str(base / 'test.sqlite3'), 'SECRET_KEY': 'test-only'}):
            spec.loader.exec_module(cls.server)
        cls.app = cls.server.app
        cls.app.config['TESTING'] = True

    def setUp(self):
        self.admin = self.app.test_client()
        response = self.admin.post('/api/session', json={'username': 'ADMIN', 'password': 'ADMIN'})
        self.assertEqual(response.status_code, 200)

    def assert_safe(self, value):
        if isinstance(value, dict):
            for key, nested in value.items():
                self.assertNotIn(key, ('password', 'password_hash', 'owner', 'owner_key'))
                self.assert_safe(nested)
        elif isinstance(value, list):
            for nested in value:
                self.assert_safe(nested)

    def test_access_requires_database_admin_role(self):
        guest = self.app.test_client()
        customer = self.app.test_client()
        self.assertEqual(customer.post('/api/session', json={'username': 'user', 'password': 'user'}).status_code, 200)
        for client in (guest, customer):
            for path in ('/api/admin/members', '/api/admin/members/1', '/api/admin/members/1/orders'):
                self.assertEqual(client.get(path).status_code, 403)

    def test_list_minimizes_personal_information(self):
        response = self.admin.get('/api/admin/members')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['total'], len(data['members']))
        self.assertGreaterEqual(data['total'], 2)
        for member in data['members']:
            self.assertEqual(set(member), {'id', 'username', 'name', 'role', 'createdAt', 'isAdmin', 'isActive'})
        self.assert_safe(data)

    def test_search_by_username_name_and_literal_input(self):
        total = self.admin.get('/api/admin/members').json['total']
        for query, username in [('AdMiN', 'ADMIN'), ('숭실', 'user')]:
            response = self.admin.get('/api/admin/members', query_string={'q': query})
            self.assertEqual([m['username'] for m in response.json['members']], [username])
            self.assertEqual(response.json['total'], total)
        for query in ("' OR 1=1 --", '%', '_', '없는회원'):
            self.assertEqual(self.admin.get('/api/admin/members', query_string={'q': query}).json['members'], [])
        self.assertEqual(self.admin.get('/api/admin/members', query_string={'q': 'x' * 101}).status_code, 400)

    def test_detail_empty_history_and_not_found(self):
        member = self.admin.get('/api/admin/members', query_string={'q': 'ADMIN'}).json['members'][0]
        detail = self.admin.get(f"/api/admin/members/{member['id']}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json['username'], 'ADMIN')
        self.assertEqual(detail.json['email'], '')
        self.assert_safe(detail.json)
        self.assertEqual(self.admin.get(f"/api/admin/members/{member['id']}/orders").json, [])
        for suffix in ('', '/orders'):
            self.assertEqual(self.admin.get('/api/admin/members/999999' + suffix).status_code, 404)

    def test_signup_guest_merge_payment_shipping_and_member_orders(self):
        client = self.app.test_client()
        payload = dict(username='member_test', name='회원검증', password='password123',
                       email='member@example.com', phone='01012345678', address='회원 주소')
        self.assertEqual(client.post('/api/users', json=payload).status_code, 201)
        self.assertEqual(client.put('/api/cart/items/101', json={'quantity': 1}).status_code, 200)
        shipping = dict(recipient='테스트', phone='01012345678', postalCode='06978',
                        address='주문 주소', addressDetail='', memo='')
        created = client.post('/api/orders', json=shipping)
        self.assertEqual(created.status_code, 200)
        code = created.json['orderId']
        self.assertEqual(client.post('/api/session', json=payload).status_code, 200)
        self.assertEqual(client.get('/api/me').json['name'], '회원검증')
        paid = client.post(f'/api/orders/{code}/payment', json={'success': True, 'paymentMethod': '카드'})
        self.assertEqual(paid.status_code, 200)
        self.assertEqual(paid.json['paymentStatus'], '완료')
        member = self.admin.get('/api/admin/members', query_string={'q': '회원검증'}).json['members'][0]
        path = f"/api/admin/members/{member['id']}"
        self.assertEqual(self.admin.get(path).json['address'], '회원 주소')
        history = self.admin.get(path + '/orders')
        self.assertEqual(history.status_code, 200)
        self.assertEqual([o['id'] for o in history.json], [code])
        self.assertEqual(history.json, client.get('/api/me/orders').json)
        self.assert_safe(history.json)
        self.assertEqual(self.admin.post(f'/api/orders/{code}/shipment', json={}).status_code, 200)
        for status in ('배송중', '배송완료'):
            self.assertEqual(self.admin.patch(f'/api/orders/{code}/shipment', json={'status': status}).status_code, 200)
        self.assertEqual(self.admin.get(path + '/orders').json[0]['status'], '완료')
        other = self.admin.get('/api/admin/members', query_string={'q': 'user'}).json['members'][0]
        self.assertEqual(self.admin.get(f"/api/admin/members/{other['id']}/orders").json, [])

    def test_existing_product_inventory_and_cancel_flow(self):
        client = self.app.test_client()
        before = client.get('/api/products/102').json
        self.assertEqual(client.put('/api/cart/items/102', json={'quantity': 1}).status_code, 200)
        shipping = dict(recipient='취소검증', phone='01012345678', postalCode='06978',
                        address='주소', addressDetail='', memo='')
        created = client.post('/api/orders', json=shipping)
        self.assertEqual(created.status_code, 200)
        code = created.json['orderId']
        self.assertEqual(client.get('/api/products/102').json['stock'], before['stock'] - 1)
        self.assertEqual(self.admin.patch(f'/api/orders/{code}', json={'status': '취소'}).status_code, 200)
        self.assertEqual(client.get('/api/products/102').json['stock'], before['stock'])
        self.assertEqual(client.get('/api/shop').json['orders'][0]['status'], '취소')
        edited = {**before, 'name': '상품 수정 검증'}
        self.assertEqual(self.admin.put('/api/products/102', json=edited).status_code, 200)
        self.assertEqual(client.get('/api/products/102').json['name'], edited['name'])
        self.assertEqual(self.admin.delete('/api/products/102').status_code, 200)
        self.assertEqual(client.get('/api/products/102').status_code, 404)
        self.assertEqual(self.admin.post('/api/products/102/resume', json={}).status_code, 200)
        self.assertEqual(client.get('/api/products/102').json['stock'], before['stock'])


if __name__ == '__main__':
    unittest.main()
