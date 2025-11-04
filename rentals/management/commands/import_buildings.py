#! /usr/bin/env python

import pandas as pd
from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand
from rentals.models import Building
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Import building data from a CSV file'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='The path to the CSV file containing building data')

    def handle(self, *args, **kwargs):
        csv_file_path = kwargs['csv_file']
        try:
            data = pd.read_csv(csv_file_path, nrows=100)
            user = User.objects.get(username='admin') 
            for _,row in data.iterrows():
                building_data = {
                    'location': Point(row['LONGITUDE'], row['LATITUDE']),
                    'address': row['ESTATE_NAME'],
                    'county': row['TERRITORY_NAME'],
                    'district': row['CLUSTER_NAME']
                }
                building = Building.objects.create(**building_data)
                user.profile.building.add(building)
            self.stdout.write(self.style.SUCCESS('Successfully imported building data'))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error importing building data: {e}'))

def create_buildings(file):
    """
    Read coordinate, address, county, district from file and create Building entries for users.
    """
    user = User.objects.get(username='admin') 
    for _,row in file.iterrows():
        building_data = {
            'location': Point(row['LONGITUDE'], row['LATITUDE']),
            'address': row['ESTATE_NAME'],
            'county': row['TERRITORY_NAME'],
            'district': row['CLUSTER_NAME']
        }
        building = Building.objects.create(**building_data)
        user.profile.building.add(building)

