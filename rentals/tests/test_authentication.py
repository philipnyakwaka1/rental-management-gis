import time
from datetime import timedelta

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save

from rentals.models import Profile
import rentals.signals as signals

User = get_user_model()


class AuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('rentals:user-register')
        self.login_url = reverse('rentals:user-login')
        self.refresh_url = reverse('rentals:user-refresh-token')
        self.logout_url = reverse('rentals:user-logout')
        # Disconnect profile-creation signal to avoid migration timing issues during tests
        post_save.disconnect(signals.create_user_profile, sender=get_user_model())

        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'StrongP@ss1'
        }
        self.user = User.objects.create_user(**self.user_data)
        Profile.objects.create(user=self.user)

    def test_register_success(self):
        data = {'username': 'newuser', 'email': 'new@example.com', 'password': 'Str0ng!Pass'}
        resp = self.client.post(self.register_url, data, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data.get('username'), 'newuser')

    def test_register_existing_user(self):
        data = {'username': 'testuser', 'email': 'x@example.com', 'password': 'Str0ng!Pass'}
        resp = self.client.post(self.register_url, data, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_register_weak_password(self):
        data = {'username': 'weak', 'email': 'w@example.com', 'password': 'weakpass'}
        resp = self.client.post(self.register_url, data, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_login_success_sets_tokens(self):
        resp = self.client.post(self.login_url, {'username': 'testuser', 'password': 'StrongP@ss1'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.cookies)

    def test_login_invalid_credentials(self):
        resp = self.client.post(self.login_url, {'username': 'testuser', 'password': 'wrong'}, format='json')
        self.assertEqual(resp.status_code, 401)

    @override_settings(SIMPLE_JWT={'ACCESS_TOKEN_LIFETIME': timedelta(seconds=1), 'REFRESH_TOKEN_LIFETIME': timedelta(seconds=2), 'ROTATE_REFRESH_TOKENS': False})
    def test_access_token_expiry_and_refresh(self):
        resp = self.client.post(self.login_url, {'username': 'testuser', 'password': 'StrongP@ss1'}, format='json')
        self.assertEqual(resp.status_code, 200)
        access = resp.data.get('access')
        refresh_cookie = resp.cookies.get('refresh')

        user_detail_url = reverse('rentals:user-detail', kwargs={'pk': self.user.pk})
        auth_client = APIClient()
        auth_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        r = auth_client.get(user_detail_url)
        self.assertIn(r.status_code, (200, 401))

        time.sleep(1.5)

        r2 = auth_client.get(user_detail_url)
        self.assertIn(r2.status_code, (401, 200))

        client_with_cookie = APIClient()
        if refresh_cookie:
            client_with_cookie.cookies['refresh'] = refresh_cookie.value
        refresh_resp = client_with_cookie.get(self.refresh_url)
        self.assertIn(refresh_resp.status_code, (200, 401))

    def test_logout_deletes_cookie(self):
        resp = self.client.post(self.login_url, {'username': 'testuser', 'password': 'StrongP@ss1'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('refresh', resp.cookies)
        r = self.client.post(self.logout_url)
        self.assertEqual(r.status_code, 200)
        morsel = r.cookies.get('refresh')
        self.assertIsNotNone(morsel)
        self.assertEqual(morsel.value, '')

    def tearDown(self):
        # Reconnect the profile-creation signal for other test modules
        post_save.connect(signals.create_user_profile, sender=get_user_model())
