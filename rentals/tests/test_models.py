from django.test import TestCase
from django.contrib.gis.geos import Point, Polygon, MultiPolygon
from django.contrib.auth import get_user_model

from rentals.models import Building, Profile, ProfileBuilding, District


User = get_user_model()


polygon = Polygon(((-122.0, 37.0),(-122.0, 38.0),(-121.0, 38.0),(-121.0, 37.0),(-122.0, 37.0),), srid=4326)
location = Point(-121.5, 37.5, srid=4326)
multipolygon = MultiPolygon(polygon, srid=4326)


class ModelsTestCase(TestCase):
	"""Comprehensive tests for User, Profile and Building models.

	Tests cover:
	- valid and invalid creation of Building objects
	- automatic Profile creation on User creation (signals)
	- Profile <-> Building many-to-many relationship through ProfileBuilding
	- deletion behaviour: deleting Profiles (and Users) removes orphan Buildings
	- deleting Buildings updates related Profiles
	- string representations for readability
	"""

	def make_point(self, x=-121.5, y=37.5):
		"""Utility to create a simple Point for Building.location."""
		return Point(x, y, srid=4326)

	def test_building_creation_valid(self):
		"""A Building can be created with required fields and string repr works."""
		district = District.objects.create(name="Test District1",county="Test County",geometry=multipolygon)
		p = self.make_point()
		b = Building.objects.create(
			county='Test County',
			district=district,
			address='123 Test St',
			location=p,
			rental_price='1200.00',
			num_bedrooms=2,
			num_bathrooms=1,
			square_meters=750,
			owner_contact='owner@example.com'
		)

		self.assertIsNotNone(b.id)
		self.assertEqual(b.county, 'Test County')
		self.assertEqual(str(b), f"[{b.location.x}, {b.location.y}] - owner: {b.owner_contact}")

	def test_building_creation_missing_location_raises(self):
		district = District.objects.create(name="Test District2",county="Test County",geometry=multipolygon)
		"""Creating a Building without a location should fail at DB level."""
		with self.assertRaises(Exception):
			Building.objects.create(county='NoLoc',address='Nowhere', district=district,rental_price='0.00')

	def test_profile_auto_created_on_user_creation(self):
		"""Saving a new User should create an associated Profile (signal)."""
		user = User.objects.create_user(username='alice', email='alice@example.com', password='pass')
		profile = Profile.objects.filter(user=user).first()
		self.assertIsNotNone(profile)
		self.assertEqual(profile.user, user)
		self.assertEqual(str(profile), f"{user.username} Profile")

	def test_profile_building_relationship(self):
		district = District.objects.create(name="Test District3",county="Test County",geometry=multipolygon)
		"""Test adding buildings to a profile and reverse relation from building to profiles."""
		user = User.objects.create_user(username='bob', email='bob@example.com', password='pass')
		profile = user.profile

		b1 = Building.objects.create(address='A1', location=self.make_point(-121.90, 37.10), owner_contact='o1', district=district)
		b2 = Building.objects.create(address='A2', location=self.make_point(-121.60, 37.40), owner_contact='o2', district=district)

		profile.building.add(b1)
		profile.building.add(b2)

		# Check forward relation
		building_ids = set(profile.building.values_list('id', flat=True))
		self.assertEqual(building_ids, {b1.id, b2.id})

		# Check reverse relation (building -> profiles)
		self.assertIn(profile, list(b1.profiles.all()))
		self.assertIn(profile, list(b2.profiles.all()))

		# Check through model instance exists and its __str__ works
		pb = ProfileBuilding.objects.filter(profile=profile, building=b1).first()
		self.assertIsNotNone(pb)
		self.assertIn('Profile: ', str(pb))

	def test_profile_deletion_deletes_orphan_building(self):
		district = District.objects.create(name="Test District4",county="Test County",geometry=multipolygon)
		"""If a Profile is the only owner of a Building, deleting the Profile deletes the Building."""
		user = User.objects.create_user(username='carol', email='carol@example.com', password='pass')
		profile = user.profile

		b = Building.objects.create(address='Orphan', location=self.make_point(-121.50, 37.50), owner_contact='oc', district=district)
		profile.building.add(b)

		self.assertTrue(Building.objects.filter(id=b.id).exists())
		self.assertIn(b, profile.building.all())

		profile.delete()

		self.assertFalse(Building.objects.filter(id=b.id).exists())

	def test_profile_deletion_keeps_shared_building(self):
		"""If multiple Profiles reference a Building, deleting one Profile should NOT delete the Building."""
		district = District.objects.create(name="Test District5",county="Test County",geometry=multipolygon)
		u1 = User.objects.create_user(username='d1', email='d1@example.com', password='pass')
		u2 = User.objects.create_user(username='d2', email='d2@example.com', password='pass')
		p1 = u1.profile
		p2 = u2.profile

		b = Building.objects.create(address='Shared', location=self.make_point(-121.40, 37.65), owner_contact='oc', district=district)
		p1.building.add(b)
		p2.building.add(b)

		p1.delete()

		self.assertTrue(Building.objects.filter(id=b.id).exists())
		self.assertIn(b, p2.building.all())

	def test_building_deletion_updates_profile_relations(self):
		"""Deleting a Building should remove it from related Profiles (through cascade)."""
		district = District.objects.create(name="Test District6",county="Test County",geometry=multipolygon)
		user = User.objects.create_user(username='ellen', email='ellen@example.com', password='pass')
		profile = user.profile

		b = Building.objects.create(address='ToBeDeleted', location=self.make_point(-121.30, 37.80), owner_contact='oc', district=district)
		profile.building.add(b)

		b.delete()

		self.assertNotIn(b, profile.building.all())
		self.assertFalse(ProfileBuilding.objects.filter(profile=profile, building__id=b.id).exists())

	def test_user_deletion_triggers_profile_and_building_cleanup(self):
		"""Deleting a User cascades to Profile; signals should then clean-up orphan Buildings."""
		district = District.objects.create(name="Test District6",county="Test County",geometry=multipolygon)
		user = User.objects.create_user(username='frank', email='frank@example.com', password='pass')
		profile = user.profile

		b1 = Building.objects.create(address='B1', location=self.make_point(-121.15, 37.90), owner_contact='oc', district=district)
		b2 = Building.objects.create(address='B2', location=self.make_point(-121.75, 37.25), owner_contact='oc', district=district)

		profile.building.add(b1)
		profile.building.add(b2)

		other_user = User.objects.create_user(username='other', email='other@example.com', password='pass')
		other_profile = other_user.profile
		other_profile.building.add(b2)

		user.delete()

		self.assertFalse(Building.objects.filter(id=b1.id).exists())

		self.assertTrue(Building.objects.filter(id=b2.id).exists())

	def test_update_user_username_reflected_in_profile_str(self):
		"""Updating a User's username is reflected in the Profile __str__ result."""
		user = User.objects.create_user(username='gina', email='gina@example.com', password='pass')
		self.assertEqual(str(user.profile), 'gina Profile')
		user.username = 'gina_new'
		user.save()
		user.refresh_from_db()
		self.assertEqual(str(user.profile), 'gina_new Profile')

