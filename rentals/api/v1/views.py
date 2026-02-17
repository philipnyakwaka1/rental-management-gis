# rest_framework imports
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser, IsAuthenticatedOrReadOnly
from rest_framework.decorators import permission_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.exceptions import PermissionDenied

# Model imports
from django.contrib.auth import get_user_model
from rentals.models import Profile, Building, ProfileBuilding, BusStop, Route, Shops
from django.db import transaction

# Serializers imports
from rentals.api.v1.serializers import UserSerializer, ProfileSerializer, BuildingSerializer, BuildingGeoSerializer
from django.core import serializers

from rentals.api.v1.pagination import CustomPagination

# Authentication imports
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import authenticate

# Database & GIS imports
from django.db.models import Exists, OuterRef
from django.contrib.gis.db.models.functions import Distance, AsGeoJSON
import json

User = get_user_model()

# User Views

# User view permissions and implementations
def check_user_permission(request, pk):
    if not (request.user.is_staff or request.user.pk == pk):
        raise PermissionDenied("You do not have permission to perform this action.")

@api_view(['POST'])
def user_register(request):
    try:
        username = request.data.get('username')
        user = User.objects.get(username=username)
        return Response({'error': 'User with this username already exists.'}, status=status.HTTP_400_BAD_REQUEST)
    except User.DoesNotExist:
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def user_login(request):
    username = request.data.get('username')
    password = request.data.get('password')

    user = authenticate(request, username=username, password=password)
    if not user or not getattr(user, "is_active", True):
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    refresh = RefreshToken.for_user(user)
    access = str(refresh.access_token)

    response = Response({'access': access}, status=status.HTTP_200_OK)

    # Set refresh token in secure HttpOnly cookie to reduce XSS risk.
    from django.conf import settings
    response.set_cookie(
        key='refresh',
        value=str(refresh),
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Lax',
        max_age=60 * 60 * 24 * 30 # 30 days
    )
    return response

@api_view(['GET'])
def user_refresh_token(request):
    refresh_token = request.COOKIES.get('refresh')
    if not refresh_token:
        return Response({'error': 'Refresh token not provided'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        refresh = RefreshToken(refresh_token)
        access = str(refresh.access_token)
        return Response({'access': access}, status=status.HTTP_200_OK)
    except TokenError:
        return Response({'error': 'Invalid refresh token'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
def user_logout(request):
    response = Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)
    response.delete_cookie('refresh')
    return response

@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_detail(request, pk):
    try:
        check_user_permission(request, pk)
        user = User.objects.select_related('profile').only(
            'id', 'username', 'email', 'first_name', 'last_name', 'profile__phone_number', 'profile__address'
        ).get(pk=pk)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)
    
    if request.method == 'GET':
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)
    elif request.method == 'PATCH':
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'User updated successfully', 'user': serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == 'DELETE':
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def user_list(request):
    users = User.objects.select_related('profile').only(
            'id', 'username', 'email', 'first_name', 'last_name', 'profile__phone_number', 'profile__address'
        ).all()
    paginator = CustomPagination()
    paginated_users = paginator.paginate_queryset(users, request)
    serializer = UserSerializer(paginated_users, many=True)
    return paginator.get_paginated_response(serializer.data)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_detail_me(request):
    """Operate on the authenticated user's account (GET, PATCH, DELETE).
    This mirrors `user_detail` but always uses request.user fetched fresh from DB.
    """

    try:
        # Re-fetch user from DB to ensure up-to-date object
        user = User.objects.select_related('profile').only(
            'id', 'username', 'email', 'first_name', 'last_name', 'profile__phone_number', 'profile__address'
        ).get(pk=request.user.pk)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)
    elif request.method == 'PATCH':
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'User updated successfully', 'user': serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == 'DELETE':
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def profile_detail_me(request):
    """Operate on the authenticated user's profile (GET, PATCH, DELETE).
    Mirrors `profile_detail` but uses request.user.
    """
    user = request.user
    try:
        profile = user.profile
    except Profile.DoesNotExist:
        return Response({'error': 'User profile not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = ProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)
    elif request.method == 'PATCH':
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Profile updated successfully', 'profile': serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == 'DELETE':
        profile.delete()
        return Response({'message': 'User profile deleted succesfully'}, status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_buildings_me(request):
    queryset = Building.objects.filter(
        profiles__user=request.user
    ).select_related('district').annotate(
        geojson_geom=AsGeoJSON('location')
    ).only(
        'id', 'title', 'county', 'address', 'rental_price',
        'num_bedrooms', 'num_bathrooms', 'square_meters', 'amenities',
        'image', 'description', 'owner_contact', 'district__id', 'district__name'
    ).order_by('id')  # Stable ordering for consistent pagination

    geojson_format = request.query_params.get('geojson', 'false').lower()

    if geojson_format == 'true':
        geojson_response = serializers.serialize('geojson', queryset,
        geometry_field='location', fields=['address', 'price', 'owner_contact'])
        return Response(geojson_response, status=status.HTTP_200_OK)

    paginator = CustomPagination()
    page = paginator.paginate_queryset(queryset, request)
    serializer = BuildingGeoSerializer(page, many=True)
    return paginator.get_paginated_response({
        'type': 'FeatureCollection',
        'features': serializer.data
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_buildings(request, pk):
    try:
        check_user_permission(request, pk)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

    queryset = Building.objects.filter(
        profiles__user_id=pk
    ).select_related('district').annotate(
        geojson_geom=AsGeoJSON('location')
    ).only(
        'id', 'title', 'county', 'address', 'rental_price',
        'num_bedrooms', 'num_bathrooms', 'square_meters', 'amenities',
        'image', 'description', 'owner_contact', 'district__id', 'district__name'
    ).order_by('id')  # Stable ordering for consistent pagination

    geojson_format = request.query_params.get('geojson', 'false').lower()

    if geojson_format == 'true':
        geojson_response = serializers.serialize('geojson', queryset,
        geometry_field='location', fields=['address', 'price', 'owner_contact'])
        return Response(geojson_response, status=status.HTTP_200_OK)

    paginator = CustomPagination()
    page = paginator.paginate_queryset(queryset, request)
    serializer = BuildingGeoSerializer(page, many=True)
    return paginator.get_paginated_response({
        'type': 'FeatureCollection',
        'features': serializer.data
    })


# Profile Views

@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def profile_detail(request, pk):

    try:
        profile = Profile.objects.get(user_id=pk)
        check_user_permission(request, pk)
    except Profile.DoesNotExist:
        return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        serializer = ProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)
    elif request.method == 'PATCH':
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Profile updated successfully', 'profile': serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == 'DELETE':
        profile.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# Building Views

# Building view permissions and implementations
def check_create_building_permission(request, user_id):
    if not (request.user.is_staff or request.user.pk == user_id):
        raise PermissionDenied("You do not have permission to create a building for this user.")
    
def check_modify_building_permission(request, building_id, for_profile=False):
    if request.user.is_staff:
        try:
            building = Building.objects.get(pk=building_id)
            return {'building': building}
        except Building.DoesNotExist:
            raise PermissionDenied("Building does not exist")
    try:
        if for_profile:
            profile_building = ProfileBuilding.objects.prefetch_related('profile', 'building')\
                .filter(profile__user_id=request.user.pk, building_id=building_id).get()
        else:
            profile_building = ProfileBuilding.objects.select_related('profile', 'building', 'building__district')\
                .filter(profile__user_id=request.user.pk, building_id=building_id).get()
        return profile_building
    except ProfileBuilding.DoesNotExist:
        raise PermissionDenied("You do not have permission to modify this building.")

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def building_list_create(request):
    if request.method == 'GET':
        geojson = request.query_params.get('geojson', 'false').lower()
        
        if geojson == 'true':
            # Always return all buildings for map layer (unfiltered)
            queryset = Building.objects.all()
            geojson_response = serializers.serialize('geojson', queryset,
                geometry_field='location', fields=['address', 'rental_price', 'owner_contact', 'district'])
            return Response(geojson_response, status=status.HTTP_200_OK)
        else:
            # Apply filters at DB level for paginated response
            buildings = _apply_building_filters(request.query_params)
            
            paginator = CustomPagination()
            paginated_buildings = paginator.paginate_queryset(buildings, request)
            
            for building in paginated_buildings:        
                # Add all nearby POIs data
                nearby_pois = _get_all_nearby_pois(building, request.query_params)
                if nearby_pois:
                    building.nearby_pois = nearby_pois
            serializer = BuildingGeoSerializer(paginated_buildings, many=True)
            return paginator.get_paginated_response({
                'type': 'FeatureCollection',
                'features': serializer.data
            })

    elif request.method == 'POST':
        user = request.user

        try:
            profile = Profile.objects.get(user=user)
        except Profile.DoesNotExist:
            return Response({'error': 'Profile not found for the user'}, status=status.HTTP_404_NOT_FOUND)

        serializer = BuildingSerializer(data=request.data)
        if serializer.is_valid():
            with transaction.atomic():
                instance = serializer.save()
                profile.building.add(instance)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticatedOrReadOnly])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def building_detail(request, pk):
    if request.method == 'GET':
        try:
            building = Building.objects.select_related('district').only(
                'id', 'title', 'county', 'address', 'rental_price',
                'num_bedrooms', 'num_bathrooms', 'square_meters', 'amenities',
                'image', 'description', 'owner_contact', 'district__id', 'district__name'
            ).get(id=pk)
            geojson = request.query_params.get('geojson', 'false').lower()
            if geojson == 'true':
                building_geojson = BuildingGeoSerializer(building)
                return Response(building_geojson.data, status=status.HTTP_200_OK)
            else:
                serializer = BuildingSerializer(building)
                return Response(serializer.data, status=status.HTTP_200_OK)
        except Building.DoesNotExist:
            return Response({'error': 'Building not found'}, status=status.HTTP_404_NOT_FOUND)
        
    elif request.method == 'PATCH':
        
        try:
            result = check_modify_building_permission(request, pk)
            building = getattr(result, 'building', None) or result.get('building')
            serializer = BuildingSerializer(building, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

    elif request.method == 'DELETE':
        try:
            result = check_modify_building_permission(request, pk)
            building = getattr(result, 'building', None) or result.get('building')
            building.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except PermissionDenied as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)
        
@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def building_profiles(request, building_pk, user_pk):
    try:
        profile = Profile.objects.get(user_id=user_pk)
        result = check_modify_building_permission(request, building_pk, for_profile=True)
        building = getattr(result, 'building', None) or result.get('building')
    except Profile.DoesNotExist:
        return Response({'error': 'User profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)
    
    if request.method == 'PATCH':
        if profile.building.filter(pk=building_pk).exists():
            return Response({'message': 'Profile already associated with this building'}, status=status.HTTP_200_OK)
        profile.building.add(building)
        return Response({'message': 'Profile added to building successfully'}, status=status.HTTP_200_OK)
    elif request.method == 'DELETE':
        if not profile.building.filter(pk=building_pk).exists():
            return Response({'message': 'Profile not associated with this building'}, status=status.HTTP_200_OK)
        profile.building.remove(building)
        return Response({'message': 'Profile removed from building successfully'}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def building_profiles_list(request, building_pk):
    user = request.user
    users = User.objects.select_related('profile')\
        .filter(profile__building__id=building_pk)
    if not users.exists():
        return Response({'error': 'Building not found'}, status=status.HTTP_404_NOT_FOUND)
    if not user.is_staff and user not in users:
        return Response({'error': 'permission denied'}, status=status.HTTP_403_FORBIDDEN)
    paginator = CustomPagination()
    page = paginator.paginate_queryset(users, request)
    serializer = UserSerializer(page, many=True)
    return paginator.get_paginated_response(serializer.data)

# Helper functions for building filtering

def _apply_building_filters(query_params):
    """Apply all filters at database level."""
    queryset = Building.objects.annotate(geojson_geom=AsGeoJSON('location')).all()
    
    # District filter
    district = query_params.get('district')
    if district and district.strip():
        queryset = queryset.filter(district__name=district.strip())
    
    # Price range filters
    price_min = query_params.get('price_min')
    if price_min and price_min.strip():
        try:
            queryset = queryset.filter(rental_price__gte=float(price_min))
        except (ValueError, TypeError):
            pass
    
    price_max = query_params.get('price_max')
    if price_max and price_max.strip():
        try:
            queryset = queryset.filter(rental_price__lte=float(price_max))
        except (ValueError, TypeError):
            pass
    
    # Proximity filters (using Exists subquery at DB level)
    # Support multiple POI filters by getting lists from query params
    poi_types = query_params.getlist('poi_type')
    poi_radii = query_params.getlist('poi_radius')
    
    # Process each poi filter pair
    if poi_types and poi_radii and len(poi_types) == len(poi_radii):
        for idx, (poi_type, poi_radius) in enumerate(zip(poi_types, poi_radii)):
            if not poi_type or not poi_type.strip() or not poi_radius or not poi_radius.strip():
                continue
                
            try:
                radius_m = float(poi_radius)
                if radius_m <= 0:
                    continue
                
                # Use unique annotation names to avoid overwriting and ensure proper AND logic
                if poi_type == 'shops':
                    annotation_name = f'has_nearby_shops_{idx}'
                    queryset = queryset.annotate(**{
                        annotation_name: Exists(
                            Shops.objects.filter(
                                geometry__dwithin=(OuterRef('location'), radius_m)
                            )
                        )
                    }).filter(**{annotation_name: True})
                
                elif poi_type == 'bus_stop':
                    annotation_name = f'has_nearby_stops_{idx}'
                    queryset = queryset.annotate(**{
                        annotation_name: Exists(
                            BusStop.objects.filter(
                                geometry__dwithin=(OuterRef('location'), radius_m)
                            )
                        )
                    }).filter(**{annotation_name: True})
                
                elif poi_type == 'route':
                    annotation_name = f'has_nearby_routes_{idx}'
                    queryset = queryset.annotate(**{
                        annotation_name: Exists(
                            Route.objects.filter(
                                geometry__dwithin=(OuterRef('location'), radius_m)
                            )
                        )
                    }).filter(**{annotation_name: True})
            
            except (ValueError, TypeError):
                continue
    return queryset


def _get_nearby_pois(building, poi_type, query_params):
    """Get nearby POIs with distances."""
    try:
        poi_radius = query_params.get('poi_radius')
        if not poi_radius or not poi_radius.strip():
            return None
        
        radius_m = float(poi_radius)
        pois = []
        
        if poi_type == 'shops':
            shops = Shops.objects.annotate(
                distance=Distance('geometry', building.location)
            ).filter(
                distance__lte=radius_m
            ).values('name', 'category', 'distance').order_by('distance')
            
            for shop in shops:
                distance_m = shop['distance'].m if shop['distance'] else 0
                pois.append({
                    'name': shop['name'] or 'N/A',
                    'category': shop['category'] or 'N/A',
                    'distance_m': round(distance_m, 2)
                })
        
        elif poi_type == 'bus_stop':
            stops = BusStop.objects.annotate(
                distance=Distance('geometry', building.location)
            ).filter(
                distance__lte=radius_m
            ).values('name', 'distance').order_by('distance')
            
            for stop in stops:
                distance_m = stop['distance'].m if stop['distance'] else 0
                pois.append({
                    'name': stop['name'] or 'N/A',
                    'distance_m': round(distance_m, 2)
                })
        
        elif poi_type == 'route':
            routes = Route.objects.annotate(
                distance=Distance('geometry', building.location)
            ).filter(
                distance__lte=radius_m
            ).values('route_name', 'headsign', 'route_long_name', 'distance').order_by('distance')
            
            seen_routes = set()
            for route in routes:
                route_name = route['route_long_name']
                # Skip duplicate route names, keep only first occurrence
                if route_name in seen_routes:
                    continue
                seen_routes.add(route_name)
                
                distance_m = route['distance'].m if route['distance'] else 0
                pois.append({
                    'name': route['route_long_name'] or 'N/A',
                    'distance_m': round(distance_m, 2)
                })
        
        return pois if pois else None
    
    except (ValueError, TypeError):
        return None


def _get_all_nearby_pois(building, query_params):
    """Get nearby POIs with distances. Fetches only requested types or all types if none specified."""
    poi_types = query_params.getlist('poi_type')
    poi_radii = query_params.getlist('poi_radius')
    
    # If specific poi_types requested, only fetch those types
    if poi_types and poi_radii and len(poi_types) == len(poi_radii):
        nearby_pois = {}
        
        # Create a temporary query params object for each filter
        for poi_type, poi_radius in zip(poi_types, poi_radii):
            if not poi_type or not poi_type.strip():
                continue
                
            # Create mock query params with single filter
            class SingleFilterParams:
                def get(self, key, default=None):
                    if key == 'poi_radius':
                        return poi_radius
                    return default
            
            poi_list = _get_nearby_pois(building, poi_type, SingleFilterParams())
            if poi_list:
                # Map singular to plural for response keys
                key = 'routes' if poi_type == 'route' else 'bus_stops' if poi_type == 'bus_stop' else 'shops'
                nearby_pois[key] = poi_list
        
        return nearby_pois if nearby_pois else None
    
    # Otherwise, no specific filters - don't fetch anything to save resources
    return None