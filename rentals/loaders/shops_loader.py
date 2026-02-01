import os
from django.contrib.gis.utils import LayerMapping
from rentals.models import Shops
from django.db import transaction
from django.conf import settings

shop_mapping = {
    'name': 'name',
    'category': 'shop',
    'geometry': 'POINT',
}

shop_shp = os.path.join(settings.BASE_DIR, 'data/shapefiles/shopping/shopping.shp')
def import_shops(verbose=True):
    """Function to import shops from a shapefile into the Shops model."""
    with transaction.atomic():
        Shops.objects.all().delete()
        lm = LayerMapping(Shops, shop_shp, shop_mapping, transform=False, encoding='utf-8')
        lm.save(strict=True, verbose=verbose)

