from django.urls import path
from rentals.api.v1 import views

urlpatterns = [
    path('buildings/', views.building_list_create, name='building-list-create'),
    path('buildings/<int:pk>/', views.building_detail, name='building-detail'),
    path('buildings/<int:building_pk>/profiles/<int:user_pk>/', views.building_profiles, name='building-profiles'),
    path('buildings/<int:building_pk>/profiles/', views.building_profiles_list, name='building-profiles-list'),
    path('users/', views.user_list, name='user-list'),
    path('users/<int:pk>/', views.user_detail, name='user-detail'),
    path('users/<int:pk>/profile/', views.profile_detail, name='profile-detail'),
    path('users/<int:pk>/buildings/', views.user_buildings, name='user-buildings'),
    path('users/register/', views.user_register, name='user-register'),
    path('users/login/', views.user_login, name='user-login'),
    path('users/logout/', views.user_logout, name='user-logout'),
    path('users/refresh-token/', views.user_refresh_token, name='user-refresh-token'),
]
