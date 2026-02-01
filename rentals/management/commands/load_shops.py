from django.core.management.base import BaseCommand
from rentals.loaders.shops_loader import import_shops

class Command(BaseCommand):
    help = 'Load shops from shapefile into the database'

    def handle(self, *args, **kwargs):
        import_shops(verbose=True)
        self.stdout.write(self.style.SUCCESS('Successfully loaded shops from shapefile'))
