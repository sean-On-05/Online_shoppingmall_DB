"""Account lifecycle, concurrent role changes, and v1 migration on isolated databases."""
from concurrent.futures import ThreadPoolExecutor
import importlib.util
import os
from pathlib import Path
import shutil
import tempfile
from threading import Barrier
import unittest
from unittest.mock import patch

from database import connect, initialize, create_order, process_payment, load_orders


class MemberAccessTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        base = Path(temporary.name)
        shutil.copyfile(Path(__file__).with_name('app.py'), base / 'app.py')
        spec = importlib.util.spec_from_file_location('access_test_app', base / 'app.py')
        self.server = importlib.util.module_from_spec(spec)
        with patch.dict(os.environ, {'SHOP_DATABASE': str(base / 'test.sqlite3'), 'SECRET_KEY': 'test-only'}):
            spec.loader.exec_module(self.server)
        self.app = self.server.app
        self.app.config['TESTING'] = True
        self.admin = self.login('ADMIN', 'ADMIN')
        self.user = self.login('user', 'user')
        members = self.admin.get('/api/admin/members').json['members']
        self.admin_id = next(m['id'] for m in members if m['username'] == 'ADMIN')
        self.user_id = next(m['id'] for m in members if m['username'] == 'user')

    def login(self, username, password):
        client = self.app.test_client()
        self.assertEqual(client.post('/api/session', json=dict(username=username, password=password)).status_code, 200)
        return client

    def change(self, member_id, kind, value, client=None):
        return (client or self.admin).patch(f'/api/admin/members/{member_id}/{kind}',
            json={'isActive' if kind == 'status' else 'isAdmin': value})

    def test_suspend_login_existing_session_and_restore(self):
        result = self.change(self.user_id, 'status', False)
        self.assertEqual(result.status_code, 200)
        self.assertFalse(result.json['isActive'])
        blocked = self.app.test_client()
        self.assertEqual(blocked.post('/api/session', json=dict(username='user', password='user')).status_code, 403)
        for method, path, data in [
            ('get', '/api/me', None), ('patch', '/api/me', {}), ('get', '/api/me/orders', None),
            ('get', '/api/session', None), ('get', '/api/shop', None),
            ('put', '/api/cart/items/101', {'quantity': 1}), ('post', '/api/orders', {}),
            ('post', '/api/orders/anything/payment', {'success': True}),
        ]:
            self.assertEqual(getattr(self.user, method)(path, json=data).status_code, 403, path)
        members = self.admin.get('/api/admin/members', query_string={'q': 'user'}).json['members']
        self.assertFalse(members[0]['isActive'])
        self.assertEqual(self.change(self.user_id, 'status', True).status_code, 200)
        self.assertEqual(blocked.post('/api/session', json=dict(username='user', password='user')).status_code, 200)
        self.assertEqual(self.user.get('/api/me').status_code, 200)

    def test_suspended_session_can_logout(self):
        self.change(self.user_id, 'status', False)
        self.assertEqual(self.user.delete('/api/session').status_code, 200)
        self.assertEqual(self.user.get('/api/session').json, {'user': None})

    def test_grant_revoke_and_existing_admin_session(self):
        self.assertEqual(self.user.get('/api/admin/members').status_code, 403)
        granted = self.change(self.user_id, 'role', True)
        self.assertEqual(granted.status_code, 200)
        self.assertTrue(granted.json['isAdmin'])
        self.assertEqual(self.user.get('/api/admin/members').status_code, 200)
        self.assertEqual(self.user.get('/api/session').json['user']['role'], 'admin')
        self.assertEqual(self.change(self.user_id, 'role', False).status_code, 200)
        self.assertEqual(self.user.get('/api/session').json['user']['role'], 'customer')
        for method, path, data in [
            ('get', '/api/admin/members', None), ('get', f'/api/admin/members/{self.user_id}', None),
            ('get', f'/api/admin/members/{self.user_id}/orders', None),
            ('post', '/api/products', {}), ('patch', '/api/orders/anything', {'status': '취소'}),
            ('patch', f'/api/admin/members/{self.admin_id}/role', {'isAdmin': False}),
        ]:
            self.assertEqual(getattr(self.user, method)(path, json=data).status_code, 403)
        self.assertEqual(self.user.get('/api/me').status_code, 200)

    def test_self_and_last_admin_protection(self):
        response = self.change(self.admin_id, 'role', False)
        self.assertEqual(response.status_code, 409)
        self.assertIn('마지막 관리자', response.json['message'])
        self.assertEqual(self.change(self.admin_id, 'status', False).status_code, 409)
        self.change(self.user_id, 'role', True)
        response = self.change(self.admin_id, 'role', False)
        self.assertEqual(response.status_code, 409)
        self.assertIn('자신의 관리자', response.json['message'])
        self.assertEqual(self.change(self.user_id, 'status', False).status_code, 409)
        with connect(self.server.DB) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM CUSTOMER WHERE is_admin=1 AND is_active=1').fetchone()[0], 2)

    def test_invalid_unauthorized_and_missing_targets(self):
        for client in (self.app.test_client(), self.user):
            for kind in ('status', 'role'):
                self.assertEqual(self.change(self.admin_id, kind, False, client).status_code, 403)
        for kind in ('status', 'role'):
            for value in (None, 0, 1, 'false', [], {}):
                self.assertEqual(self.change(self.user_id, kind, value).status_code, 400)
            self.assertEqual(self.change(999999, kind, True).status_code, 404)
        self.change(self.user_id, 'status', False)
        self.assertEqual(self.change(self.user_id, 'role', True).status_code, 409)

    def test_signup_cannot_choose_role_or_status(self):
        client = self.app.test_client()
        response = client.post('/api/users', json=dict(username='newuser', name='신규회원',
            password='password123', email='new@example.com', phone='01012345678', address='주소',
            isAdmin=True, isActive=False, is_admin=1, is_active=0))
        self.assertEqual(response.status_code, 201)
        member = self.admin.get('/api/admin/members', query_string={'q': 'newuser'}).json['members'][0]
        self.assertTrue(member['isActive'])
        self.assertFalse(member['isAdmin'])

    def test_concurrent_cross_revocations_keep_an_admin(self):
        self.change(self.user_id, 'role', True)
        barrier = Barrier(2)

        def revoke(username, target):
            client = self.app.test_client()
            with client.session_transaction() as session:
                session['username'] = username
            barrier.wait(timeout=5)
            return self.change(target, 'role', False, client).status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(revoke, 'ADMIN', self.user_id), pool.submit(revoke, 'user', self.admin_id)]
            results = [future.result(timeout=15) for future in futures]
        self.assertEqual(sorted(results), [200, 403])
        with connect(self.server.DB) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM CUSTOMER WHERE is_admin=1 AND is_active=1').fetchone()[0], 1)

    def test_v1_migration_preserves_all_rows_and_is_repeatable(self):
        path = Path(self.server.DB).with_name('version1.sqlite3')
        schema = Path(__file__).with_name('schema.sql').read_text(encoding='utf-8-sig')
        schema = schema.replace(' is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),\n', '')
        with connect(path) as db:
            db.executescript(schema)
            db.execute("INSERT INTO CUSTOMER(username,name,password_hash,is_admin) VALUES ('legacy','기존회원','preserve-hash',1)")
            db.execute("INSERT INTO CATEGORY VALUES (1,'의류')")
            db.execute("INSERT INTO PRODUCT(product_id,category_id,product_name,price,image,description) VALUES (101,1,'기존상품',10000,'/images/goods/cap.svg','설명')")
            db.execute("INSERT INTO WAREHOUSE VALUES (1,'창고','')")
            db.execute('INSERT INTO INVENTORY VALUES (101,1,10)')
            db.execute("INSERT INTO CART(customer_id,owner_key) VALUES (1,'legacy')")
            db.execute('INSERT INTO CART_ITEM VALUES (1,101,1)')
            code = create_order(db, 'legacy', shipping=dict(recipient='회원', phone='01012345678',
                postalCode='06978', address='기존 배송지', addressDetail='', memo=''))
            process_payment(db, code)
            db.execute('PRAGMA user_version=1')
            tables = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
            columns = {table: [row['name'] for row in db.execute(f'PRAGMA table_info({table})')] for table in tables}
            before = {table: [tuple(row) for row in db.execute(f'SELECT * FROM {table}')] for table in tables}
            orders_before = load_orders(db)
        initialize(path)
        initialize(path)
        with connect(path) as db:
            for table in tables:
                after = [tuple(row) for row in db.execute(f'SELECT {",".join(columns[table])} FROM {table}')]
                self.assertEqual(after, before[table], table)
            self.assertEqual(load_orders(db), orders_before)
            self.assertEqual(db.execute('SELECT is_active FROM CUSTOMER').fetchone()[0], 1)
            self.assertEqual(db.execute('PRAGMA user_version').fetchone()[0], 3)
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])


if __name__ == '__main__':
    unittest.main()
