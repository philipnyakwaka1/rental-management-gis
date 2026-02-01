import os
from django.conf import settings
from django.contrib.gis.utils import LayerMapping
from rentals.models import BusStop
from django.db import transaction

bus_stop_mapping = {
    'name': 'stop_name',
    'geometry': 'POINT',
}

bus_stop_shp = os.path.join(settings.BASE_DIR, 'data/shapefiles/matatus/stops.shp')

def import_bus_stops(verbose=True):
    """Function to import bus stops from a shapefile into the BusStop model."""
    with transaction.atomic():
        BusStop.objects.all().delete()
        lm = LayerMapping(BusStop, bus_stop_shp, bus_stop_mapping, transform=False, encoding='utf-8')
        lm.save(strict=True, verbose=verbose)

