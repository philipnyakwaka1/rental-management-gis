from rest_framework import serializers
from django.contrib.auth import get_user_model
from rentals.models import Profile, Building, District
from password_strength import PasswordPolicy
from django.contrib.gis.geos import Point
import imghdr
import json

User = get_user_model()

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['phone_number', 'address']

class UserSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(source='profile.phone_number', required=False, allow_blank=True, allow_null=True)
    address = serializers.CharField(source='profile.address', required=False, allow_blank=True, allow_null=True)
    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'email', 'first_name', 'last_name', 'phone', 'address']
        extra_kwargs = {'password': {'write_only': True}}

    def validate_password(self, value):

        class Length:
            def __init__(self, count):
                self.count = count
            def __str__(self):
                return f'password must be at least {self.count} characters long'

        class Uppercase:
            def __init__(self, count):
                self.count = count
            def __str__(self):
                return f'password must contain at least {self.count} uppercase character'

        class Numbers:
            def __init__(self, count):
                self.count = count
            def __str__(self):
                return f'password must contain at least {self.count} number'

        class Special:
            def __init__(self, count):
                self.count = count
            def __str__(self):
                return f'password must contain at least {self.count} special character'

        policy = PasswordPolicy.from_names(
            length=8,
            uppercase=1,
            numbers=1,
            special=1,
        )
        errors = policy.test(value)
        
        if len(errors) > 0:
            raise serializers.ValidationError({'errors': [str(e) for e in errors]})
        return value
    
    def create(self, validated_data):
        password = validated_data.pop('password', None)
        instance = self.Meta.model(**validated_data)
        if password is not None:
            instance.set_password(password)
        instance.save()
        return instance
    
    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        profile_data = validated_data.pop('profile', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password is not None:
            instance.set_password(password)
        instance.save()
        if profile_data:
            profile = getattr(instance, 'profile', None)
            if profile is None:
                profile = Profile.objects.create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
        return instance

class BuildingSerializer(serializers.ModelSerializer):
    district = serializers.SlugRelatedField(slug_field='name', queryset=District.objects.all())
    class Meta:
        model = Building
        fields = [
        'id',
        'title',
        'county',
        'district',
        'address',
        'rental_price',
        'num_bedrooms',
        'num_bathrooms',
        'square_meters',
        'amenities',
        'location',
        'image',
        'description',
        'owner_contact',
    ]

    def validate_image(self, value):
        if not value:
            return value
        image_type = imghdr.what(value)
        if not image_type:
            raise serializers.ValidationError("Uploaded file is not a valid image.")
        allowed_types = ['jpeg', 'jpg', 'png']
        if image_type not in allowed_types:
            raise serializers.ValidationError(f"Image type '{image_type}' is not supported. Allowed types: {', '.join(allowed_types)}")
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError("Image size should not exceed 2MB.")
        return value
    
    def validate_rental_price(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Rental price must be greater than 0.")
        return value
    
    def validate_num_bedrooms(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Number of bedrooms cannot be negative.")
        return value
    
    def validate_num_bathrooms(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Number of bathrooms cannot be negative.")
        return value
    
    def validate_square_meters(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Square meters must be greater than 0.")
        return value
    
    def validate_location(self, value):
        try:
            coords = value.replace(' ', '').split(',')
            if len(coords) != 2:
                raise serializers.ValidationError("Coordinate format cannot be parsed. The coordinate should be two floats values separated by a comma.")
            lat = float(coords[0])
            lon = float(coords[1])
        except Exception as e:
            raise serializers.ValidationError("Coordinate format cannot be parsed. The coordinate should be two floats values separated by a comma.")

        if not (-90 <= lat <= 90):
            raise serializers.ValidationError("Latitude must be between -90 and 90 degrees.")
        if not (-180 <= lon <= 180):
            raise serializers.ValidationError("Longitude must be between -180 and 180 degrees.")
        
        return Point(lon, lat, srid=4326)
    
    def validate(self, attrs):
        # Check if building lies within the district boundary
        location = attrs.get('location')
        district = attrs.get('district')

        if self.instance: # Always true on PATCH/PUT
            location = location or self.instance.location
            district = district or self.instance.district

        if location and district:
            if not district.geometry.contains(location):
                raise serializers.ValidationError({'location': f'Based on your district selection, the building location must be within {district.name} district boundary. Please check your district and building coordinate data.'})
        return attrs
        
    def create(self, validated_data):
        return self.Meta.model.objects.create(**validated_data)
    
    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
                setattr(instance, attr, value)
        instance.save()
        return instance
    
class BuildingGeoSerializer(serializers.ModelSerializer):
    """Full GeoJSON Feature serializer for building detail responses.
    
    Requires the queryset to be annotated with:
        - geojson_geom = AsGeoJSON('location')
    and select_related('district').
    
    Includes all property fields for detail views.
    """
    geometry = serializers.SerializerMethodField()
    properties = serializers.SerializerMethodField()

    class Meta:
        model = Building
        fields = ['geometry', 'properties']
    
    def get_geometry(self, instance):
        """Parse pre-computed GeoJSON geometry from annotation."""
        # Safely handle missing annotation with getattr
        geojson_geom = getattr(instance, 'geojson_geom', None)
        if not geojson_geom:
            return None
        return json.loads(geojson_geom)

    def get_properties(self, instance):
        return {
            'id': instance.pk,
            'title': instance.title,
            'county': instance.county,
            'district': instance.district.name,
            'address': instance.address,
            'rental_price': instance.rental_price,
            'num_bedrooms': instance.num_bedrooms,
            'num_bathrooms': instance.num_bathrooms,
            'square_meters': instance.square_meters,
            'amenities': instance.amenities,
            'image': instance.image.name if instance.image else None,
            'description': instance.description,
            'owner_contact': instance.owner_contact,
            'nearby_pois': instance.nearby_pois if hasattr(instance, 'nearby_pois') else None
        }

    def to_representation(self, instance):
        return {
            'type': 'Feature',
            'id': instance.pk,
            'geometry': self.get_geometry(instance),
            'properties': self.get_properties(instance)
        }


