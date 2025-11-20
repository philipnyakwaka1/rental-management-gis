from django.urls import path, include
from . import views

app_name = 'rentals'

urlpatterns = [
    # Frontend map view
    path('', views.rental_listings, name='rentals_listings'),
    path('user/register/', views.register_user, name='register_user'),
    path('user/login/', views.login_user, name='login_user'),
    path('user/logout/', views.logout_user, name='logout_user'),
    path('user/account/', views.user_account, name='user_account'),
    # API
    path('api/v1/', include('rentals.api.v1.urls')),
]
