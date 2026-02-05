#! /usr/bin/env python

import json
import random
from decimal import Decimal
from pathlib import Path

import pandas as pd
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError

from rentals.models import Building, Profile

User = get_user_model()


def normalize_column(name: str) -> str:
	return name.strip().lower().replace(" ", "_")


def parse_bool(value):
	if value is None or (isinstance(value, float) and pd.isna(value)):
		return None
	if isinstance(value, bool):
		return value
	if isinstance(value, (int, float)):
		return bool(int(value))
	str_value = str(value).strip().lower()
	if str_value in {"true", "1", "yes", "y"}:
		return True
	if str_value in {"false", "0", "no", "n"}:
		return False
	return None


def parse_decimal(value):
	if value is None or (isinstance(value, float) and pd.isna(value)):
		return None
	return Decimal(str(value))


def parse_int(value):
	if value is None or (isinstance(value, float) and pd.isna(value)):
		return None
	return int(value)


def parse_date(value):
	if value is None or (isinstance(value, float) and pd.isna(value)):
		return None
	parsed = pd.to_datetime(value, errors="coerce")
	if pd.isna(parsed):
		return None
	return parsed.date()


def random_amenities():
	options = ["wifi", "pool", "parking", "gym"]
	count = random.randint(0, len(options))
	return random.sample(options, count)


class Command(BaseCommand):
	help = "Import buildings from a CSV file and link them to testUser1."

	def add_arguments(self, parser):
		parser.add_argument(
			"--csv",
			dest="csv_path",
			default="data/buildings.csv",
			help="Path to CSV file containing building data.",
		)

	def handle(self, *args, **kwargs):
		csv_path = Path(kwargs.get("csv_path")).expanduser().resolve()
		if not csv_path.exists():
			raise CommandError(f"CSV file not found: {csv_path}")

		user = User.objects.filter(username="testUser1").first()
		if not user:
			raise CommandError("User with username 'testUser1' not found.")

		profile, _ = Profile.objects.get_or_create(user=user)

		df = pd.read_csv(csv_path)
		if df.empty:
			self.stdout.write(self.style.WARNING("CSV file is empty. Nothing to import."))
			return

		normalized_columns = {normalize_column(col): col for col in df.columns}

		def get_value(row, key):
			col_name = normalized_columns.get(normalize_column(key))
			if not col_name:
				return None
			value = row[col_name]
			if isinstance(value, float) and pd.isna(value):
				return None
			return value

		created_count = 0
		skipped_count = 0

		for _, row in df.iterrows():
			lat = get_value(row, "latitude")
			lon = get_value(row, "longitude")

			if lat is None or lon is None:
				location_value = get_value(row, "location")
				if isinstance(location_value, str):
					coords = [c for c in location_value.replace(" ", "").split(",") if c]
					if len(coords) == 2:
						lat = lat or coords[0]
						lon = lon or coords[1]
				elif isinstance(location_value, (list, tuple)) and len(location_value) == 2:
					lat = lat or location_value[0]
					lon = lon or location_value[1]

			if lat is None or lon is None:
				skipped_count += 1
				self.stdout.write(self.style.WARNING("Skipping row without valid coordinates."))
				continue

			try:
				location = Point(float(lon), float(lat), srid=4326)
			except (TypeError, ValueError):
				skipped_count += 1
				self.stdout.write(self.style.WARNING("Skipping row with invalid coordinates."))
				continue

			building_data = {
				"title": get_value(row, "title"),
				"county": get_value(row, "county"),
				"district": get_value(row, "district"),
				"address": get_value(row, "address"),
				"location": location,
				"pets_allowed": parse_bool(get_value(row, "pets_allowed"))
				if get_value(row, "pets_allowed") is not None
				else None,
				"rental_price": parse_decimal(
					get_value(row, "rental_price") or get_value(row, "rent")
				),
				"num_bedrooms": parse_int(
					get_value(row, "num_bedrooms") or get_value(row, "bedroom")
				),
				"num_bathrooms": parse_int(
					get_value(row, "num_bathrooms") or get_value(row, "bathroom")
				),
				"square_meters": parse_decimal(
					get_value(row, "square_meters") or get_value(row, "area")
				),
				"is_available": parse_bool(get_value(row, "is_available"))
				if get_value(row, "is_available") is not None
				else None,
				"description": get_value(row, "description"),
				"amenities": get_value(row, "amenities"),
				"owner_contact": get_value(row, "owner_contact"),
			}

			if isinstance(building_data["amenities"], str):
				raw_amenities = building_data["amenities"].strip()
				if raw_amenities.startswith("{") or raw_amenities.startswith("["):
					try:
						building_data["amenities"] = json.loads(raw_amenities)
					except json.JSONDecodeError:
						pass

			if not building_data.get("amenities"):
				building_data["amenities"] = random_amenities()

			building_data = {k: v for k, v in building_data.items() if v is not None}

			building = Building.objects.create(**building_data)
			profile.building.add(building)
			created_count += 1

		self.stdout.write(
			self.style.SUCCESS(
				f"Imported {created_count} buildings. Skipped {skipped_count} rows."
			)
		)




