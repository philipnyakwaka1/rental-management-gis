from django.core.management.base import BaseCommand
from rentals.loaders.route_loader import import_routes

class Command(BaseCommand):
    help = 'Load matatu routes from shapefile into the database'

    def handle(self, *args, **kwargs):
        import_routes(verbose=True)
        self.stdout.write(self.style.SUCCESS('Successfully loaded matatu routes from shapefile'))
