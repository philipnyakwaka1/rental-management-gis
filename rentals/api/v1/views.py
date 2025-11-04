# rest_framework imports
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser, IsAuthenticatedOrReadOnly
from rest_framework.decorators import permission_classes
from rest_framework.exceptions import PermissionDenied

# Model imports
from django.contrib.auth import get_user_model
from rentals.models import Profile, Building

# Serializers imports
from rentals.api.v1.serializers import UserSerializer, ProfileSerializer, BuildingSerializer
from django.core import serializers

from rentals.api.v1.pagination import CustomPagination

# Authentication imports
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import authenticate


User = get_user_model()

# User Views

# User view permissions and implementations
def check_user_permission(request, pk):
    if not request.user.is_authenticated:
        raise PermissionDenied("Authentication credentials were not provided.")
    if not (request.user.is_staff or request.user.pk == pk):
        raise PermissionDenied("You do not have permission to perform this action.")

@api_view(['PUT'])
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
    response.set_cookie(
        key='refresh',
        value=str(refresh),
        httponly=True,
        secure=False,        # set True in production (HTTPS)
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

@api_view(['GET'])
def user_logout(request):
    response = Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)
    response.delete_cookie('refresh')
    return response

@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_detail(request, pk):
    try:
        check_user_permission(request, pk)
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)
    
    if request.method == 'GET':
        serializer = UserSerializer(user)
        profile_serializer = ProfileSerializer(user.profile)
        data = {**serializer.data, 'profile': profile_serializer.data}
        return Response(data, status=status.HTTP_200_OK)
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
    users = User.objects.all()
    paginator = CustomPagination()
    paginated_users = paginator.paginate_queryset(users, request)
    users = list(map(lambda x: {**UserSerializer(x).data, 'profile': ProfileSerializer(x.profile).data}, paginated_users))
    return paginator.get_paginated_response(users)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_buildings(request, pk):
    try:
        check_user_permission(request, pk)
        user = User.objects.get(pk=pk)
        profile = Profile.objects.get(user=user)
        buildings = profile.building.all()
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except Profile.DoesNotExist:
        return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

    geojson = request.query_params.get('geojson', 'false').lower()
    if geojson == 'true':
        buildings_geojson = serializers.serialize('geojson', buildings)
        return Response(buildings_geojson, status=status.HTTP_200_OK, content_type='application/json')
    else:
        paginator = CustomPagination()
        paginated_buildings = paginator.paginate_queryset(buildings, request)
        buildings_serialized = list(map(lambda x: serializers.serialize('geojson', [x]), paginated_buildings))
        return paginator.get_paginated_response(buildings_serialized)


# Profile Views

@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def profile_detail(request, pk):
    try:
        check_user_permission(request, pk)
        user = User.objects.get(pk=pk)
        profile = Profile.objects.get(user=user)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except Profile.DoesNotExist:
        return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        serializer = ProfileSerializer(profile)
        user_serializer = UserSerializer(user)
        data = {**user_serializer.data, 'profile': serializer.data}
        return Response(data, status=status.HTTP_200_OK)
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
    if not request.user.is_authenticated:
        raise PermissionDenied("Authentication credentials were not provided.")
    if not (request.user.is_staff or request.user.pk == user_id):
        raise PermissionDenied("You do not have permission to create a building for this user.")
    
def check_modify_building_permission(request, building):
    if not request.user.is_authenticated:
        raise PermissionDenied("Authentication credentials were not provided.")
    if request.user.is_staff:
        return
    try:
        profile = Profile.objects.get(user=request.user)
        if building not in profile.building.all():
            raise PermissionDenied("You do not have permission to modify this building.")
    except Profile.DoesNotExist:
        raise PermissionDenied("You do not have permission to modify this building.")

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticatedOrReadOnly])
def building_list_create(request):
    if request.method == 'GET':
        buildings = Building.objects.all()
        geojson = request.query_params.get('geojson', 'false').lower()
        if geojson == 'true':
            buildings_geojson = serializers.serialize('geojson', buildings)
            return Response(buildings_geojson, status=status.HTTP_200_OK, content_type='application/json')
        else:
            paginator = CustomPagination()
            paginated_buildings = paginator.paginate_queryset(buildings, request)
            buildings_serialized = list(map(lambda x: serializers.serialize('geojson', [x]), paginated_buildings))
            return paginator.get_paginated_response(buildings_serialized)

    elif request.method == 'PUT':
        try:
            user = User.objects.get(pk=request.data.get('user_id'))
            profile = Profile.objects.get(user=user)
            check_create_building_permission(request, user.id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except Profile.DoesNotExist:
            return Response({'error': 'Profile not found for the user'}, status=status.HTTP_404_NOT_FOUND)
        except PermissionDenied as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

        serializer = BuildingSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            profile.building.add(serializer.instance)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticatedOrReadOnly])
def building_detail(request, pk):
    try:
        building = Building.objects.get(pk=pk)
    except Building.DoesNotExist:
        return Response({'error': 'Building not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        geojson = request.query_params.get('geojson', 'false').lower()
        if geojson == 'true':
            building_geojson = serializers.serialize('geojson', [building])
            return Response(building_geojson, status=status.HTTP_200_OK, content_type='application/json')
        else:
            serializer = BuildingSerializer(building)
            return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == 'PATCH':
        try:
            check_modify_building_permission(request, building)
        except PermissionDenied as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

        serializer = BuildingSerializer(building, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        try:
            check_modify_building_permission(request, building)
        except PermissionDenied as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

        building.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['PATCH', 'DELETE'])
def building_profiles(request, building_pk, user_pk):
    try:
        check_modify_building_permission(request, Building.objects.get(pk=building_pk))
        building = Building.objects.get(pk=building_pk)
        user = User.objects.get(pk=user_pk)
        profile = Profile.objects.get(user=user)
    except Building.DoesNotExist:
        return Response({'error': 'Building not found'}, status=status.HTTP_404_NOT_FOUND)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except Profile.DoesNotExist:
        return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)
    
    if request.method == 'PATCH':
        building_profiles = profile.building.all()
        if building in building_profiles:
            return Response({'message': 'Profile already associated with this building'}, status=status.HTTP_200_OK)
        profile.building.add(building)
        return Response({'message': 'Profile added to building successfully'}, status=status.HTTP_200_OK)
    elif request.method == 'DELETE':
        building_profiles = profile.building.all()
        if building not in building_profiles:
            return Response({'message': 'Profile not associated with this building'}, status=status.HTTP_200_OK)
        profile.building.remove(building)
        return Response({'message': 'Profile removed from building successfully'}, status=status.HTTP_200_OK)
    
@api_view(['GET'])
def building_profiles_list(request, building_pk):
    try:
        building = Building.objects.get(pk=building_pk)
        profiles = Profile.objects.filter(building=building)
    except Building.DoesNotExist:
        return Response({'error': 'Building not found'}, status=status.HTTP_404_NOT_FOUND)

    paginator = CustomPagination()
    paginated_profiles = paginator.paginate_queryset(profiles, request)
    profiles_serialized = list(map(lambda x: {**UserSerializer(x.user).data, 'profile': ProfileSerializer(x).data}, paginated_profiles))
    return paginator.get_paginated_response(profiles_serialized)
