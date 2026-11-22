"""Origin checks and cookie-session flows through the Vercel rewrite, using a temporary DB."""
import importlib.util
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch


class OriginSecurityTest(unittest.TestCase):
    origin = 'https://online-shoppingmall-db.vercel.app'
    backend = 'https://h21yess12.pythonanywhere.com'

    @classmethod
    def setUpClass(cls):
        temporary = tempfile.TemporaryDirectory()
        cls.addClassCleanup(temporary.cleanup)
        base = Path(temporary.name)
        shutil.copyfile(Path(__file__).with_name('app.py'), base / 'app.py')
        spec = importlib.util.spec_from_file_location('origin_test_app', base / 'app.py')
        cls.server = importlib.util.module_from_spec(spec)
        with patch.dict(os.environ, {'SHOP_DATABASE': str(base / 'test.sqlite3'), 'SECRET_KEY': 'test-only'}):
            spec.loader.exec_module(cls.server)
        cls.app = cls.server.app
        cls.app.config['TESTING'] = True

    def login(self, client, origin=None, base_url=None, password='user', **headers):
        if origin is not None:
            headers['Origin'] = origin
        return client.post('/api/session', base_url=base_url or self.backend,
                           headers=headers, json={'username': 'user', 'password': password})

    def test_vercel_login_session_and_logout_through_rewrite(self):
        client = self.app.test_client()
        response = self.login(client, self.origin)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['user']['username'], 'user')
        cookie = response.headers['Set-Cookie']
        self.assertIn('HttpOnly', cookie)
        self.assertIn('SameSite=Lax', cookie)
        self.assertIn('Path=/', cookie)
        self.assertNotIn('Domain=', cookie)
        # On the upstream leg the Host remains PythonAnywhere; Origin is Vercel.
        for _ in range(2):
            session = client.get('/api/session', base_url=self.backend, headers={'Origin': self.origin})
            self.assertEqual(session.status_code, 200)
            self.assertEqual(session.json['user']['username'], 'user')
        profile = client.get('/api/me', base_url=self.backend)
        self.assertEqual(profile.status_code, 200)
        self.assertNotIn('password_hash', profile.json)
        logout = client.delete('/api/session', base_url=self.backend, headers={'Origin': self.origin})
        self.assertEqual(logout.status_code, 200)
        self.assertEqual(client.get('/api/session', base_url=self.backend).json, {'user': None})
        self.assertEqual(client.get('/api/me', base_url=self.backend).status_code, 401)

    def test_local_vite_origins_and_same_origin_still_work(self):
        for origin, base_url in [
            ('http://localhost:5173', self.backend),
            ('http://127.0.0.1:5173', 'http://127.0.0.1:5000'),
            ('http://localhost:5174', 'http://localhost:5174'),
            (self.backend, self.backend),
        ]:
            client = self.app.test_client()
            self.assertEqual(self.login(client, origin, base_url).status_code, 200, origin)
            self.assertEqual(client.get('/api/session', base_url=base_url).json['user']['username'], 'user')
            self.assertEqual(client.delete('/api/session', base_url=base_url, headers={'Origin': origin}).status_code, 200)

    def test_untrusted_origins_cannot_login_or_logout_existing_session(self):
        client = self.app.test_client()
        self.assertEqual(self.login(client, self.origin).status_code, 200)
        for origin in [
            'https://attacker.example', 'https://another-project.vercel.app',
            'https://preview.online-shoppingmall-db.vercel.app',
            'https://online-shoppingmall-db.vercel.app.attacker.example',
            'http://online-shoppingmall-db.vercel.app',
            'https://online-shoppingmall-db.vercel.app:444',
            'http://localhost:9999', 'null', '',
            'https://attacker@online-shoppingmall-db.vercel.app',
            'https://online-shoppingmall-db.vercel.app/login',
            'https://online-shoppingmall-db.vercel.app?other=1',
            'https://online-shoppingmall-db.vercel.app#fragment',
            'https://online-shoppingmall-db.vercel.app:bad',
            'https://[invalid',
        ]:
            response = self.login(client, origin)
            self.assertEqual(response.status_code, 403, origin)
            self.assertEqual(response.json['message'], '허용되지 않는 요청입니다.')
            self.assertEqual(client.delete('/api/session', base_url=self.backend, headers={'Origin': origin}).status_code, 403, origin)
        self.assertEqual(client.get('/api/session', base_url=self.backend).json['user']['username'], 'user')

    def test_forwarded_headers_do_not_authorize_an_attacker(self):
        client = self.app.test_client()
        response = self.login(client, 'https://attacker.example', **{
            'X-Forwarded-Host': 'attacker.example',
            'X-Forwarded-Proto': 'https',
            'Referer': self.origin + '/#/login',
        })
        self.assertEqual(response.status_code, 403)

    def test_missing_origin_checks_referer_and_fetch_metadata(self):
        client = self.app.test_client()
        self.assertEqual(self.login(client, Referer=self.origin + '/#/login').status_code, 200)
        self.assertEqual(self.login(client, Referer='https://attacker.example/page').status_code, 403)
        self.assertEqual(self.login(client, **{'Sec-Fetch-Site': 'cross-site'}).status_code, 403)
        # Existing CLI clients/test clients do not send browser-origin headers.
        self.assertEqual(self.login(self.app.test_client()).status_code, 200)

    def test_allowlisting_does_not_bypass_password_or_admin_checks(self):
        client = self.app.test_client()
        self.assertEqual(self.login(client, self.origin, password='wrong').status_code, 401)
        self.assertEqual(client.get('/api/session', base_url=self.backend).json, {'user': None})
        self.assertEqual(self.login(client, self.origin).status_code, 200)
        response = client.patch('/api/admin/members/1/role', base_url=self.backend,
            headers={'Origin': self.origin}, json={'isAdmin': False})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json['message'], '관리자 권한이 필요합니다.')


if __name__ == '__main__':
    unittest.main()
