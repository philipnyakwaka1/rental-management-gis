from django.db import models
from django.contrib.gis.db import models as gis_models
from django.contrib.auth.models import User

class Building(models.Model):
    """Model representing a building with geographic location and rental details."""
    county = models.CharField(max_length=100, null=True, default=None)
    district = models.CharField(max_length=100, null=True, default=None)
    address = models.CharField(max_length=255, null=True, default=None)
    location = gis_models.PointField(spatial_index=True, srid=4326)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    rental_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, default=None)
    num_bedrooms = models.IntegerField(null=True, default=None)
    num_bathrooms = models.IntegerField(null=True, default=None)
    square_footage = models.IntegerField(null=True, default=None)
    is_available = models.BooleanField(default=True)
    description = models.TextField(null=True, default=None)
    amenities = models.JSONField(null=True, default=None)
    owner_contact = models.CharField(max_length=100, null=True, default=None)

    def __str__(self):
        return f"[{self.location.x}, {self.location.y}] - owner: {self.owner_contact}"
    
    class Meta:
        db_table = "building"
    

class Profile(models.Model):
    """Model representing a user profile."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile', null=True, default=None)
    phone_number = models.CharField(max_length=15, null=True, default=None)
    address = models.CharField(max_length=255, null=True, default=None)
    building = models.ManyToManyField(Building, through='ProfileBuilding', related_name='profiles')

    def __str__(self):
        return f'{self.user.username} Profile'
    
    class Meta:
        db_table = "profile"
    
class ProfileBuilding(models.Model):
    """Model representing the relationship between profiles and buildings."""
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, null=True, default=None)
    building = models.ForeignKey(Building, on_delete=models.CASCADE, null=True, default=None)

    def __str__(self):
        return f'Profile: {self.profile.user.username} - Building ID: {self.building.id}'
    
    class Meta:
        db_table = "profile_building"
