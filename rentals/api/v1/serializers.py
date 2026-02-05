from rest_framework import serializers
from django.contrib.auth import get_user_model
from rentals.models import Profile, Building, District
from password_strength import PasswordPolicy
from django.contrib.gis.geos import Point

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        exclude = ['is_superuser', 'is_staff', 'is_active', 'groups', 'user_permissions']
        extra_kwargs = {'password': {'write_only': True}, 'last_login': {'read_only': True}, 'date_joined': {'read_only': True}}

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
        for attr, value in validated_data.items():
            if hasattr(instance, attr):
                setattr(instance, attr, value)
        if password is not None:
            instance.set_password(password)
        instance.save()
        return instance

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['phone_number', 'address']

class BuildingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Building
        fields = '__all__'
        extra_kwargs = {'created_at': {'read_only': True}, 'updated_at': {'read_only': True}}

    def validate_image(self, value):
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError("Image size should not exceed 2MB.")
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
        
        # check if building lies within the district boundary can be added here
        point = Point(lon, lat, srid=4326)
        district = District.objects.filter(name=self.initial_data.get('district')).first()
        if not district or not district.geometry.contains(point):
            raise serializers.ValidationError(f"Building location must be within {district.name if district else 'a valid'} district boundary.")
        return lat, lon
        
    def create(self, validated_data):
        location = validated_data.pop('location', None)
        if location is not None:
            validated_data['location'] = Point(location[1], location[0], srid=4326)  # Note: Point takes (longitude, latitude)
        return self.Meta.model.objects.create(**validated_data)
    
    def update(self, instance, validated_data):
        location = validated_data.pop('location', None)
        for attr, value in validated_data.items():
            if hasattr(instance, attr):
                setattr(instance, attr, value)
        if location is not None:
            instance.location = Point(location[1], location[0], srid=4326)  # Note: Point takes (longitude, latitude)
        instance.save()
        return instance