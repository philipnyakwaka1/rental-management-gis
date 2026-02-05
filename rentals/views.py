from django.shortcuts import render
from .models import District

districts = District.objects.all().order_by('name')

def rental_listings(request):
	"""Render the rental listings page."""
	return render(request, 'rentals/map.html', {'districts': districts})


def register_user(request):
	"""Render the user registration page."""
	return render(request, 'rentals/register.html')


def login_user(request):
	"""Render the user login page (no authentication logic here).

	Authentication is handled by the REST API; the frontend performs
	an AJAX login and stores the JWT for API requests.
	"""
	return render(request, 'rentals/login.html')


def logout_user(request):
	"""Render a redirect target for logout links (frontend will handle token removal).

	Backend view intentionally does not perform logout side-effects for template rendering.
	"""
	return render(request, 'rentals/map.html')


def user_account(request):
	"""Render the user account page."""
	return render(request, 'rentals/account.html', {'user': request.user, 'districts': districts})