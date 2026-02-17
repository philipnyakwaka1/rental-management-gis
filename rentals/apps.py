from django.apps import AppConfig


class RentalsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'rentals'

    def ready(self):
        # register any signal handlers defined in that module when the app is fully loaded
        import rentals.signals 
