import os
from django.contrib.gis.utils import LayerMapping
from rentals.models import Route
from django.db import transaction
from django.conf import settings

route_mapping = {
    'route_name': 'route_name',
    'headsign': 'headsign',
    'route_long_name': 'route_long',
    'geometry': 'MULTILINESTRING',
}

route_shp = os.path.join(settings.BASE_DIR, 'data/shapefiles/matatus/shapes.shp')
def import_routes(verbose=True):
    """Function to import matatu routes from a shapefile into the Route model."""
    with transaction.atomic():
        Route.objects.all().delete()
        lm = LayerMapping(Route, route_shp, route_mapping, transform=False, encoding='utf-8')
        lm.save(strict=True, verbose=verbose)
