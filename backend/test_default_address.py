"""Default shipping address isolation, persistence, migration and order snapshots."""
import importlib.util
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from database import connect, initialize


class DefaultAddressTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        base = Path(temporary.name)
        shutil.copyfile(Path(__file__).with_name('app.py'), base / 'app.py')
        spec = importlib.util.spec_from_file_location('address_test_app', base / 'app.py')
        self.server = importlib.util.module_from_spec(spec)
        with patch.dict(os.environ, {'SHOP_DATABASE': str(base / 'test.sqlite3'), 'SECRET_KEY': 'test-only'}):
            spec.loader.exec_module(self.server)
        self.app = self.server.app
        self.app.config['TESTING'] = True
        self.client = self.login('user', 'user')
        self.address = dict(recipient='배송 수령인', phone='010-1234-5678', postalCode='06978',
            address='배송 주소', addressDetail='101호', memo='문 앞')
        self.normalized = {**self.address, 'phone': '01012345678'}
        self.path = '/api/me/default-address'

    def login(self, username, password):
        client = self.app.test_client()
        self.assertEqual(client.post('/api/session', json=dict(username=username, password=password)).status_code, 200)
        return client

    def test_create_read_update_delete_and_single_address(self):
        self.assertEqual(self.client.get(self.path).json, {'address': None})
        response = self.client.put(self.path, json=self.address)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['address'], self.normalized)
        changed = {**self.address, 'recipient': '변경 수령인', 'address': '새 주소'}
        self.assertEqual(self.client.put(self.path, json=changed).status_code, 200)
        self.assertEqual(self.client.get(self.path).json['address']['address'], '새 주소')
        with connect(self.server.DB) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM DEFAULT_ADDRESS').fetchone()[0], 1)
        self.assertEqual(self.client.delete(self.path).status_code, 200)
        self.assertEqual(self.client.get(self.path).json, {'address': None})
        self.assertEqual(self.client.delete(self.path).status_code, 200)

    def test_logout_relogin_and_app_initialization_preserve_address(self):
        self.client.put(self.path, json=self.address)
        self.client.delete('/api/session')
        self.assertEqual(self.client.get(self.path).status_code, 401)
        initialize(self.server.DB)
        client = self.login('user', 'user')
        self.assertEqual(client.get(self.path).json['address'], self.normalized)

    def test_optional_fields_and_validation_do_not_destroy_saved_address(self):
        minimal = {key: value for key, value in self.address.items() if key not in ('addressDetail', 'memo')}
        self.assertEqual(self.client.put(self.path, json=minimal).status_code, 200)
        self.assertEqual(self.client.get(self.path).json['address']['addressDetail'], '')
        self.client.put(self.path, json=self.address)
        for field, value in [('recipient', ''), ('recipient', ' '), ('recipient', 'a' * 51),
            ('phone', 'abc'), ('phone', None), ('postalCode', '1234'), ('postalCode', 'abcde'),
            ('address', ' '), ('address', 'a' * 201), ('addressDetail', 'a' * 101), ('memo', 'a' * 201)]:
            self.assertEqual(self.client.put(self.path, json={**self.address, field: value}).status_code, 400, field)
        self.assertEqual(self.client.put(self.path, json=[]).status_code, 400)
        self.assertEqual(self.client.get(self.path).json['address'], self.normalized)

    def test_session_ownership_and_no_cross_account_disclosure(self):
        admin = self.login('ADMIN', 'ADMIN')
        # An arbitrary owner in body/query is ignored: only session ownership applies.
        self.client.put(self.path, json={**self.address, 'customer_id': 1, 'username': 'ADMIN'})
        self.assertEqual(admin.get(self.path).json, {'address': None})
        self.assertEqual(admin.delete(self.path + '?customer_id=2').status_code, 200)
        self.assertEqual(self.client.get(self.path + '?customer_id=1').json['address'], self.normalized)
        self.assertEqual(self.client.get('/api/me/default-address/1').status_code, 404)
        self.assertEqual(set(self.client.get(self.path).json['address']), set(self.address))

    def test_authentication_and_suspension_are_enforced(self):
        guest = self.app.test_client()
        for method in ('get', 'put', 'delete'):
            self.assertEqual(getattr(guest, method)(self.path, json=self.address).status_code, 401)
        admin = self.login('ADMIN', 'ADMIN')
        member = admin.get('/api/admin/members', query_string={'q': 'user'}).json['members'][0]
        self.assertEqual(admin.patch(f"/api/admin/members/{member['id']}/status", json={'isActive': False}).status_code, 200)
        for method in ('get', 'put', 'delete'):
            self.assertEqual(getattr(self.client, method)(self.path, json=self.address).status_code, 403)

    def test_order_uses_submitted_address_and_preserves_profile_and_snapshot(self):
        profile = self.client.get('/api/me').json
        updated_profile = {**profile, 'email': 'profile@example.com', 'phone': '01098765432', 'address': '개인정보 주소'}
        self.assertEqual(self.client.patch('/api/me', json=updated_profile).status_code, 200)
        profile = self.client.get('/api/me').json
        self.client.put(self.path, json=self.address)
        self.client.put('/api/cart/items/101', json={'quantity': 1})
        submitted = {**self.address, 'recipient': '이번 주문 수령인', 'address': '이번 주문 주소'}
        result = self.client.post('/api/orders', json=submitted)
        self.assertEqual(result.status_code, 200)
        order = next(o for o in result.json['orders'] if o['id'] == result.json['orderId'])
        self.assertEqual(order['shipping'], submitted)
        self.assertEqual(self.client.get(self.path).json['address'], self.normalized)
        self.client.put(self.path, json={**self.address, 'address': '기본 배송지 수정'})
        self.client.delete(self.path)
        self.assertEqual(self.client.get('/api/me/orders').json[0], order)
        self.assertEqual(self.client.get('/api/me').json, profile)
        # Existing guest checkout still accepts the same shipping contract.
        guest = self.app.test_client()
        self.assertEqual(guest.put('/api/cart/items/102', json={'quantity': 1}).status_code, 200)
        self.assertEqual(guest.post('/api/orders', json=submitted).status_code, 200)

    def test_version2_upgrade_creates_table_without_changing_existing_data(self):
        path = Path(self.server.DB).with_name('v2.sqlite3')
        schema = Path(__file__).with_name('schema.sql').read_text(encoding='utf-8-sig')
        with connect(path) as db:
            for statement in schema.split(';'):
                if statement.strip() and 'CREATE TABLE IF NOT EXISTS DEFAULT_ADDRESS' not in statement:
                    db.execute(statement)
            db.execute("INSERT INTO CUSTOMER(username,name,password_hash,is_admin,is_active,address) VALUES ('preserved','기존회원','same-hash',0,0,'개인정보 주소')")
            db.execute("INSERT INTO WAREHOUSE VALUES (1,'기존 창고','위치')")
            db.execute("INSERT INTO ORDERS(order_code,customer_id,owner_key,order_date,subtotal,shipping_fee,total_amount,warehouse_id) VALUES ('OLD',1,'preserved','2026-11-01',10000,3000,13000,1)")
            db.execute('PRAGMA user_version=2')
            tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
            before = {table: [tuple(r) for r in db.execute(f'SELECT * FROM {table}')] for table in tables}
        initialize(path)
        initialize(path)
        with connect(path) as db:
            for table in tables:
                self.assertEqual([tuple(r) for r in db.execute(f'SELECT * FROM {table}')], before[table], table)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM DEFAULT_ADDRESS').fetchone()[0], 0)
            self.assertEqual(db.execute('PRAGMA user_version').fetchone()[0], 3)
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])


if __name__ == '__main__':
    unittest.main()
