import os
from django.conf import settings
from django.contrib.gis.utils import LayerMapping
from rentals.models import District
from django.db import transaction

district_mapping = {
    'name': 'adm2_name',
    'county': 'adm1_name',
    'geometry': 'MULTIPOLYGON',
}

district_shp = os.path.join(settings.BASE_DIR, 'data/shapefiles/administrative/nairobi_administrative.shp')

def import_districts(verbose=True):
    """Function to import districts from a shapefile into the District model."""
    with transaction.atomic():
        District.objects.all().delete()
        lm = LayerMapping(District, district_shp, district_mapping, transform=False, encoding='utf-8')
        lm.save(strict=True, verbose=verbose)