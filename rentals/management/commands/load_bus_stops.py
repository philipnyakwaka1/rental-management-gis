from django.core.management.base import BaseCommand
from rentals.loaders.bus_stop_loader import import_bus_stops

class Command(BaseCommand):
    help = 'Load bus stops from shapefile into the database'

    def handle(self, *args, **kwargs):
        import_bus_stops(verbose=True)
        self.stdout.write(self.style.SUCCESS('Successfully loaded bus stops from shapefile'))
