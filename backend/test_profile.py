import unittest, uuid
from test_api import app

class ProfileTest(unittest.TestCase):
 def test_profile(self):
  c=app.test_client(); other=app.test_client()
  for method,path in [('get','/api/me'),('get','/api/me/orders'),('patch','/api/me')]:
   self.assertEqual(getattr(c,method)(path,json={}).status_code,401)
  key='profile_'+uuid.uuid4().hex[:10]
  payload=dict(username=key,name='회원',password='password123',email=key+'@example.com',phone='01012345678',address='기존 주소')
  self.assertEqual(c.post('/api/users',json=payload).status_code,201)
  c.post('/api/session',json=dict(username=key,password='password123'))
  self.assertEqual(c.get('/api/me').json['address'],'기존 주소')
  c.put('/api/cart/items/102',json=dict(quantity=1))
  shipping=dict(recipient='테스트',phone='01012345678',postalCode='06978',address='주문 당시 주소',addressDetail='',memo='')
  self.assertEqual(c.post('/api/orders',json=shipping).status_code,200)
  for field,value in [('email','invalid'),('phone','bad'),('address',' ')]:
   self.assertEqual(c.patch('/api/me',json={**payload,field:value}).status_code,400)
  updated=dict(email=key+'new@example.com',phone='010-9876-5432',address='새 주소',username='ADMIN',is_admin=1)
  self.assertEqual(c.patch('/api/me',json=updated).status_code,200)
  profile=c.get('/api/me').json
  self.assertEqual(profile['username'],key)
  self.assertEqual(profile['phone'],'01098765432')
  self.assertNotIn('password_hash',profile)
  self.assertEqual(c.get('/api/session').json['user']['role'],'customer')
  self.assertEqual(c.get('/api/me/orders').json[0]['shipping']['address'],'주문 당시 주소')
  other.post('/api/session',json=dict(username='ADMIN',password='ADMIN'))
  own_ids={o['id'] for o in c.get('/api/me/orders').json}
  self.assertFalse(own_ids.intersection(o['id'] for o in other.get('/api/me/orders').json))
  other.post('/api/session',json=dict(username='user',password='user'))
  own_ids={o['id'] for o in c.get('/api/me/orders').json}
  self.assertFalse(own_ids.intersection(o['id'] for o in other.get('/api/me/orders').json))
  other.patch('/api/me',json=dict(email=key+'other@example.com',phone='01012345678',address='다른 주소'))
  self.assertEqual(c.patch('/api/me',json=dict(email=key+'OTHER@example.com',phone='01012345678',address='주소')).status_code,409)
  self.assertEqual(c.get('/api/me').json['address'],'새 주소')
