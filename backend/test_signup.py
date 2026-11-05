import unittest, uuid
from werkzeug.security import check_password_hash
from test_api import app
from database import connect
import app as server

class SignupTest(unittest.TestCase):
 def test_signup(self):
  c=app.test_client(); username='test_'+uuid.uuid4().hex[:12]
  payload=dict(username=username,name='테스트',password='password123',email=username+'@example.com',phone='010-1234-5678',address='테스트로 1, 101호')
  self.assertEqual(c.post('/api/users',json={}).status_code,400)
  for field,value in [('password','short'),('email','invalid'),('phone','abc'),('address','   '),('email',None),('phone',None),('address',None)]:
   self.assertEqual(c.post('/api/users',json={**payload,field:value}).status_code,400,field)
  self.assertEqual(c.post('/api/users',json={**payload,'username':'admin'}).status_code,409)
  result=c.post('/api/users',json={**payload,'is_admin':1,'role':'admin'})
  self.assertEqual(result.status_code,201)
  self.assertNotIn('password',result.json)
  self.assertEqual(c.post('/api/users',json={**payload,'username':username.upper()}).status_code,409)
  self.assertEqual(c.post('/api/users',json={**payload,'username':username+'x','email':payload['email'].upper()}).status_code,409)
  with connect(server.DB) as db:
   row=db.execute('SELECT * FROM CUSTOMER WHERE username=?',(username,)).fetchone()
   self.assertEqual(row['is_admin'],0)
   self.assertEqual(row['email'],payload['email'])
   self.assertEqual(row['phone'],'01012345678')
   self.assertEqual(row['address'],payload['address'])
   self.assertTrue(check_password_hash(row['password_hash'],'password123'))
  result=c.post('/api/session',json=dict(username=username,password='password123'))
  self.assertEqual(result.status_code,200)
  self.assertEqual(result.json['user']['role'],'customer')
  self.assertEqual(c.post('/api/products',json={}).status_code,403)
  self.assertEqual(c.get('/api/session').json['user']['username'],username)
