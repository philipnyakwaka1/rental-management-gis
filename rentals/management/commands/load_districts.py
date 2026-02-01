from django.core.management.base import BaseCommand
from rentals.loaders.district_loader import import_districts

class Command(BaseCommand):
    help = 'Load districts from shapefile into the database'

    def handle(self, *args, **kwargs):
        import_districts(verbose=True)
        self.stdout.write(self.style.SUCCESS('Successfully loaded districts from shapefile'))
    
    