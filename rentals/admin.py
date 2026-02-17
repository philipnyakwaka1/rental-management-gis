from django.contrib import admin
from .models import Building, Profile, ProfileBuilding

# Register your models here.
admin.site.register(Building)
admin.site.register(Profile)
admin.site.register(ProfileBuilding)
