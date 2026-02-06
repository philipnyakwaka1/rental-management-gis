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
        # Validate file is actually an image (server-side check)
        if value:
            import imghdr
            # Check magic number
            image_type = imghdr.what(value)
            if not image_type:
                raise serializers.ValidationError("Uploaded file is not a valid image.")
            # Check file extension matches content
            allowed_types = ['jpeg', 'jpg', 'png', 'gif', 'webp']
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
        
        # Check if building lies within the district boundary (only if district is provided)
        point = Point(lon, lat, srid=4326)
        district_name = self.initial_data.get('district')
        if district_name:
            district = District.objects.filter(name=district_name).first()
            if district and not district.geometry.contains(point):
                raise serializers.ValidationError(f"Building location must be within {district.name} district boundary.")
            elif not district:
                raise serializers.ValidationError(f"District '{district_name}' does not exist.")
        
        # Return Point object directly
        return point
        
    def create(self, validated_data):
        return self.Meta.model.objects.create(**validated_data)
    
    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            if hasattr(instance, attr):
                setattr(instance, attr, value)
        instance.save()
        return instance