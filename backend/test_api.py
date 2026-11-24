import os, tempfile, unittest
os.environ['SHOP_DATABASE']=tempfile.mktemp(suffix='.sqlite3')
from app import app

class ApiTest(unittest.TestCase):
    def test_flow(self):
        c=app.test_client(); other=app.test_client()
        self.assertEqual(c.get('/api/products').status_code,200)
        self.assertEqual(c.post('/api/products',json={}).status_code,403)
        self.assertEqual(c.post('/api/session',json={'username':'ADMIN','password':'wrong'}).status_code,401)
        self.assertEqual(c.put('/api/cart/items/101',json={'quantity':999}).status_code,400)
        self.assertEqual(c.put('/api/cart/items/101',json={'quantity':1}).status_code,200)
        shipping=dict(recipient='테스트',phone='01012345678',postalCode='06978',address='테스트 주소',addressDetail='',memo='')
        result=c.post('/api/orders',json=shipping)
        self.assertEqual(result.status_code,200)
        order=result.json['orders'][0]; oid=order['id']
        self.assertEqual(order['total'],89000)
        self.assertEqual(other.get('/api/shop').json['orders'],[])
        self.assertEqual(c.post('/api/orders',json=shipping).status_code,409)
        self.assertEqual(c.post('/api/session',json={'username':'ADMIN','password':'ADMIN'}).status_code,200)
        self.assertEqual(c.patch('/api/orders/'+oid,json={'status':'취소'}).status_code,200)
        self.assertEqual(c.patch('/api/orders/'+oid,json={'status':'취소'}).status_code,409)
        self.assertEqual(c.get('/api/products/101').json['stock'],30)
        p=c.get('/api/products/101').json; p['name']='테스트 상품'
        self.assertEqual(c.put('/api/products/101',json=p).status_code,200)
        self.assertEqual(c.get('/api/products/101').json['name'],'테스트 상품')
        c.delete('/api/session')
        self.assertEqual(c.delete('/api/products/101').status_code,403)

    def test_product_edit_preserves_newer_inventory(self):
        admin = app.test_client()
        customer = app.test_client()
        self.assertEqual(admin.post('/api/session', json=dict(username='ADMIN', password='ADMIN')).status_code, 200)
        before = admin.get('/api/products/102').json
        self.assertEqual(customer.put('/api/cart/items/102', json={'quantity': 1}).status_code, 200)
        shipping = dict(recipient='테스트', phone='01012345678', postalCode='06978',
                        address='테스트 주소', addressDetail='', memo='')
        self.assertEqual(customer.post('/api/orders', json=shipping).status_code, 200)

        changes = dict(before, name='변경된 상품 이름')
        del changes['stock']
        self.assertEqual(admin.put('/api/products/102', json=changes).status_code, 200)
        stock = before['stock'] - 1
        self.assertEqual(admin.get('/api/products/102').json['stock'], stock)
        self.assertEqual(admin.put('/api/products/102', json=before).status_code, 409)
        self.assertEqual(admin.put('/api/products/102', json={
            'stock': 10, 'expectedStock': before['stock']
        }).status_code, 409)
        self.assertEqual(admin.put('/api/products/102', json={
            'stock': 10, 'expectedStock': stock
        }).status_code, 200)
        product = admin.get('/api/products/102').json
        self.assertEqual(product['stock'], 10)
        self.assertEqual(product['name'], changes['name'])

if __name__=='__main__':
    try: unittest.main()
    finally: os.unlink(os.environ['SHOP_DATABASE'])
