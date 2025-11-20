from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point

from django.db.models.signals import post_save

from rentals.models import Building, Profile
import rentals.signals as signals

User = get_user_model()


class APITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Disconnect profile-creation signal to avoid migration timing issues during tests
        post_save.disconnect(signals.create_user_profile, sender=User)

        self.user = User.objects.create_user(username='user1', email='u1@example.com', password='StrongP@ss1')
        self.other = User.objects.create_user(username='user2', email='u2@example.com', password='StrongP@ss1')
        self.admin = User.objects.create_superuser(username='admin', email='admin@example.com', password='AdminP@ss1')

        Profile.objects.create(user=self.user)
        Profile.objects.create(user=self.other)
        Profile.objects.create(user=self.admin)

        self.building = Building.objects.create(address='Addr', location=Point(1.0, 1.0), owner_contact='oc')
        self.building.profiles.add(self.user.profile)

        # endpoints
        self.user_list_url = reverse('rentals:user-list')
        # pk-based endpoints (used by permission tests)
        self.user_detail_url = lambda pk: reverse('rentals:user-detail', kwargs={'pk': pk})
        self.profile_detail_url = lambda pk: reverse('rentals:profile-detail', kwargs={'pk': pk})
        self.user_buildings_url = lambda pk: reverse('rentals:user-buildings', kwargs={'pk': pk})
        self.building_list_url = reverse('rentals:building-list-create')
        self.building_detail_url = lambda pk: reverse('rentals:building-detail', kwargs={'pk': pk})
        self.building_profiles_url = lambda building_pk, user_pk: reverse('rentals:building-profiles', kwargs={'building_pk': building_pk, 'user_pk': user_pk})
        self.building_profiles_list_url = lambda building_pk: reverse('rentals:building-profiles-list', kwargs={'building_pk': building_pk})

    def _login_and_get_token(self, username, password):
        login_url = reverse('rentals:user-login')
        resp = self.client.post(login_url, data={'username': username, 'password': password}, format='json')
        return resp

    def test_user_list_requires_admin(self):
        # unauthenticated
        r = self.client.get(self.user_list_url)
        self.assertIn(r.status_code, (401, 403))

        # authenticated non-admin
        token_resp = self._login_and_get_token('user1', 'StrongP@ss1')
        access = token_resp.data.get('access')
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        r2 = client.get(self.user_list_url)
        self.assertEqual(r2.status_code, 403)

        # admin via session auth
        admin_client = APIClient()
        admin_client.force_login(self.admin)
        r3 = admin_client.get(self.user_list_url)
        self.assertEqual(r3.status_code, 200)

    def test_user_detail_get_patch_delete_permissions(self):
        # other user should be forbidden to GET another user's detail
        token_resp = self._login_and_get_token('user2', 'StrongP@ss1')
        access = token_resp.data.get('access')
        client = APIClient(); client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        r = client.get(self.user_detail_url(self.user.pk))
        self.assertEqual(r.status_code, 403)

        # user can get own detail
        token_resp = self._login_and_get_token('user1', 'StrongP@ss1')
        access = token_resp.data.get('access')
        client = APIClient(); client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        r2 = client.get(self.user_detail_url(self.user.pk))
        self.assertEqual(r2.status_code, 200)

        # admin can get any user
        admin_client = APIClient(); admin_client.force_login(self.admin)
        r3 = admin_client.get(self.user_detail_url(self.user.pk))
        self.assertEqual(r3.status_code, 200)

    def test_profile_crud_permissions(self):
        # non-authenticated cannot access
        r = self.client.get(self.profile_detail_url(self.user.pk))
        self.assertEqual(r.status_code, 401)

        # user can patch own profile
        token_resp = self._login_and_get_token('user1', 'StrongP@ss1')
        access = token_resp.data.get('access')
        client = APIClient(); client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        r2 = client.patch(self.profile_detail_url(self.user.pk), data={'phone_number': '12345'}, format='json')
        self.assertEqual(r2.status_code, 200)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.phone_number, '12345')
        

        # other user cannot patch another's profile
        token_resp = self._login_and_get_token('user2', 'StrongP@ss1')
        access = token_resp.data.get('access')
        client2 = APIClient(); client2.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        r3 = client2.patch(self.profile_detail_url(self.user.pk), data={'phone_number': '67890'}, format='json')
        self.assertEqual(r3.status_code, 403)

        # admin can patch any profile
        admin_client = APIClient(); admin_client.force_login(self.admin)
        r4 = admin_client.patch(self.profile_detail_url(self.user.pk), data={'phone_number': '99999'}, format='json')
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.phone_number, '99999')
        self.assertEqual(r4.status_code, 200)

    def test_building_crud_and_permissions(self):
        # GET building list should work for unauthenticated
        r = self.client.get(self.building_list_url)
        self.assertEqual(r.status_code, 200)

        # create building requires authentication and user match
        token_resp = self._login_and_get_token('user1', 'StrongP@ss1')
        access = token_resp.data.get('access')
        client = APIClient(); client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        create_resp = client.put(self.building_list_url, data={'address': 'New', 'location': '2.0,2.0', 'owner_contact': 'oc'}, format='json')
        self.assertEqual(create_resp.status_code, 201)

        # modify building by non-owner should be forbidden
        token_resp = self._login_and_get_token('user2', 'StrongP@ss1')
        access = token_resp.data.get('access')
        client2 = APIClient(); client2.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        r2 = client2.patch(self.building_detail_url(self.building.pk), data={'address': 'X'}, format='json')
        self.assertEqual(r2.status_code, 403)

        # owner can modify
        token_resp = self._login_and_get_token('user1', 'StrongP@ss1')
        access = token_resp.data.get('access')
        owner_client = APIClient(); owner_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        r3 = owner_client.patch(self.building_detail_url(self.building.pk), data={'address': 'Y'}, format='json')
        self.assertEqual(r3.status_code, 200)

        # admin can modify
        admin_client = APIClient(); admin_client.force_login(self.admin)
        r4 = admin_client.patch(self.building_detail_url(self.building.pk), data={'address': 'Z'}, format='json')
        self.assertEqual(r4.status_code, 200)

    def test_building_profiles_add_remove(self):
        # add profile to building by owner
        token_resp = self._login_and_get_token('user1', 'StrongP@ss1')
        access = token_resp.data.get('access')
        client = APIClient(); client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        resp = client.patch(self.building_profiles_url(self.building.pk, self.other.pk))
        self.assertEqual(resp.status_code, 200)
        self.assertIn(self.other.profile, self.building.profiles.all())

        # remove by owner
        resp2 = client.delete(self.building_profiles_url(self.building.pk, self.other.pk))
        self.assertEqual(resp2.status_code, 200)
        self.assertNotIn(self.other.profile, self.building.profiles.all())

        # admin can add profile
        admin_client = APIClient(); admin_client.force_login(self.admin)
        resp3 = admin_client.patch(self.building_profiles_url(self.building.pk, self.other.pk))
        self.assertEqual(resp3.status_code, 200)
        self.assertIn(self.other.profile, self.building.profiles.all())

    def tearDown(self):
        # Reconnect the profile-creation signal so other test modules relying on it work correctly
        post_save.connect(signals.create_user_profile, sender=User)

    def test_me_endpoints_access(self):
        # user can access their own /users/me/ endpoints
        token_resp = self._login_and_get_token('user1', 'StrongP@ss1')
        access = token_resp.data.get('access')
        client = APIClient(); client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

        r = client.get(reverse('rentals:user-detail-me'))
        self.assertEqual(r.status_code, 200)

        r2 = client.get(reverse('rentals:profile-detail-me'))
        self.assertEqual(r2.status_code, 200)

        r3 = client.get(reverse('rentals:user-buildings-me'))
        self.assertIn(r3.status_code, (200, 204))
