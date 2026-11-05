import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from werkzeug.security import check_password_hash
from database import initialize, connect, load_state, save_state

class MigrationTest(unittest.TestCase):
    def test_legacy_migration_and_history(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'shop.sqlite3'
            products=json.loads(Path('products.json').read_text())
            order=dict(id='SSU-OLD',owner='user',createdAt='2026-11-01T00:00:00Z',subtotal=89000,shippingFee=0,total=89000,status='배송완료',payment='데모 결제',items=[dict(productId=101,name='주문 당시 이름',image='/old.svg',quantity=1,price=89000)],shipping=dict(recipient='수령인',phone='01012345678',postalCode='06978',address='주문 주소',addressDetail='101호',memo='문 앞'))
            state=dict(products=products,carts={'user':[dict(productId=101,quantity=2)],'guest-token':[dict(productId=102,quantity=1)]},orders=[order])
            with sqlite3.connect(path) as db:
                db.execute('CREATE TABLE state(id INTEGER PRIMARY KEY,data TEXT)')
                db.execute('INSERT INTO state VALUES (1,?)',(json.dumps(state),))
            initialize(path)
            self.assertTrue(Path(str(path)+'.before-relational.bak').exists())
            with connect(path) as db:
                loaded=load_state(db)
                self.assertEqual(loaded['orders'],state['orders'])
                self.assertEqual(loaded['carts'],state['carts'])
                self.assertEqual(sorted(loaded['products'],key=lambda p:p['id']),products)
                self.assertEqual(len(db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name!='sqlite_sequence'").fetchall()),11)
                admin=db.execute("SELECT * FROM CUSTOMER WHERE username='ADMIN'").fetchone()
                self.assertEqual(admin['is_admin'],1)
                self.assertTrue(check_password_hash(admin['password_hash'],'ADMIN'))
                loaded['products']=[p for p in loaded['products'] if p['id']!=101]
                loaded['carts']['user']=[]
                save_state(db,loaded)
                self.assertIsNone(db.execute('SELECT product_id FROM ORDER_ITEM').fetchone()[0])
                self.assertEqual(load_state(db)['orders'][0],order)
                self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
                db.execute("UPDATE CUSTOMER SET is_admin=0 WHERE username='ADMIN'")
            initialize(path)
            with connect(path) as db:
                self.assertEqual(db.execute("SELECT is_admin FROM CUSTOMER WHERE username='ADMIN'").fetchone()[0],0)
                self.assertEqual(len(load_state(db)['products']),7)

    def test_database_role_controls_api(self):
        import os
        import sys
        if 'app' not in sys.modules:
            temporary = tempfile.TemporaryDirectory()
            self.addCleanup(temporary.cleanup)
            os.environ['SHOP_DATABASE'] = str(Path(temporary.name)/'api.sqlite3')
        import app as server
        client=server.app.test_client()
        with connect(server.DB) as db:
            db.execute("UPDATE CUSTOMER SET is_admin=1 WHERE username='user'")
            db.execute("UPDATE CUSTOMER SET is_admin=0 WHERE username='ADMIN'")
        try:
            result=client.post('/api/session',json=dict(username='user',password='user'))
            self.assertEqual(result.json['user']['role'],'admin')
            self.assertEqual(client.delete('/api/products/999999').status_code,404)
            client.post('/api/session',json=dict(username='ADMIN',password='ADMIN'))
            self.assertEqual(client.delete('/api/products/999999').status_code,403)
        finally:
            with connect(server.DB) as db:
                db.execute("UPDATE CUSTOMER SET is_admin=0 WHERE username='user'")
                db.execute("UPDATE CUSTOMER SET is_admin=1 WHERE username='ADMIN'")
