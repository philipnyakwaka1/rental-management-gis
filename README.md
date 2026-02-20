# Rentals GIS

A geospatial search platform for discovering rental properties based on location and proximity to amenities. Built with Django, Django REST Framework, PostGIS, and Leaflet Maps, this application provides an intuitive map-based interface for querying and filtering rental properties by district, price, and proximity to points of interest (POIs).

🌐 **[View Live Application →](https://www.philipnyakwaka.tech/rentals)**

## Table of Contents

- [Overview](#overview)
- [Project Architecture](#project-architecture)
- [RESTful API Design & Authentication](#restful-api-design--authentication)
- [API Endpoints Documentation](#api-endpoints-documentation)
- [GIS Components](#gis-components)
  - [Backend: PostGIS Integration](#backend-postgis-integration)
  - [Frontend: Leaflet Maps Implementation](#frontend-leaflet-maps-implementation)
- [Installation & Setup](#installation--setup)
- [Running the Server](#running-the-server)
- [Testing](#testing)
- [Data Loading](#data-loading)
- [Project Structure](#project-structure)


## Overview

Rentals GIS is a full-stack geospatial search platform that enables users to discover rental properties through an interactive map interface, filter listings by district, price range, and proximity to points of interest, calculate distances to nearby amenities such as shops and transit, manage secure JWT-based accounts, and access property data via a fully RESTful API. The system leverages PostGIS for advanced spatial querying within PostgreSQL and uses Leaflet.js to deliver an intuitive, interactive mapping experience.


## Project Architecture

```
rental-management-gis/
├── rentals/                    # Main Django app
│   ├── api/v1/                # RESTful API v1
│   │   ├── views.py           # API endpoints
│   │   ├── serializers.py      # DRF serializers
│   │   ├── pagination.py       # Custom pagination
│   │   └── urls.py             # API route configuration
│   ├── models.py              # Django ORM models with GIS fields
│   ├── static/rentals/        # Frontend assets
│   │   ├── js/                # JavaScript (Leaflet integration)
│   │   ├── css/               # Stylesheets
│   │   ├── icons/             # Map markers
│   │   └── data/              # GeoJSON data files
│   ├── templates/rentals/     # HTML templates
│   ├── loaders/               # GIS data import utilities
│   ├── management/commands/   # Custom Django commands
│   ├── migrations/            # Database schema migrations
│   ├── signals.py             # Django signals (auto-profile creation)
│   ├── tests/                 # Test suite
│   └── views.py               # Frontend views
├── rentals_root/              # Django project settings
│   ├── settings.py            # Configuration & GIS setup
│   ├── urls.py                # Root URL configuration
│   └── wsgi.py                # WSGI application
├── data/                      # Geospatial data files
│   └── shapefiles/            # GIS shapefiles for import
├── manage.py                  # Django CLI
├── requirements.txt           # Python dependencies
└── package.json               # JavaScript dependencies
```


## RESTful API Design & Authentication

### Architecture Principles

The API adheres to core REST architectural principles, employing a resource-oriented design in which each endpoint represents a distinct resource (such as users, buildings, or profiles), using appropriate HTTP methods (GET, POST, PATCH, DELETE) for CRUD operations, maintaining statelessness by requiring each request to contain all necessary processing information, exchanging data exclusively in JSON format, and returning meaningful HTTP status codes (e.g., 200, 201, 400, 401, 403, 404) to clearly communicate outcomes.

### Authentication: JSON Web Tokens (JWT)

Authentication is implemented using Django REST Framework Simple JWT in a fully RESTful model, issuing short-lived access tokens (15 minutes by default) stored in memory or session storage and long-lived refresh tokens (30 days) stored in secure, HttpOnly cookies. Cookie security is enforced through HttpOnly (mitigating XSS), Secure (HTTPS-only in production), and SameSite (CSRF protection) flags. The system supports seamless token refresh without requiring re-authentication and enforces strong password validation, including a minimum of eight characters with at least one uppercase letter, one number, and one special character.

#### Authentication Flow

```
1. User Registration
   POST /api/v1/users/register/
   {username, email, password} → User + Profile created

2. User Login
   POST /api/v1/users/login/
   {username, password} → Access token returned, refresh token in HttpOnly cookie

3. API Request
   GET /api/v1/users/me/ with "Authorization: Bearer {access_token}"
   → Protected resource accessed

4. Token Refresh
   GET /api/v1/users/refresh-token/ (with refresh cookie)
   → New access token returned

5. Logout
   POST /api/v1/users/logout/
   → Refresh token cookie cleared
```


## API Endpoints Documentation

All API endpoints are prefixed with `/rentals/api/v1/`.

### Authentication Endpoints

#### User Registration
```
POST /users/register/
Permissions: Public

Request:
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}

Response: 201 Created
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "first_name": "",
  "last_name": ""
}
```

#### User Login
```
POST /users/login/
Permissions: Public

Request:
{
  "username": "john_doe",
  "password": "SecurePass123!"
}

Response: 200 OK
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
Headers:
  Set-Cookie: refresh=<refresh_token>; HttpOnly; Secure; SameSite=Lax
```

#### User Logout
```
POST /users/logout/
Permissions: Authenticated

Response: 200 OK
{
  "message": "Logged out successfully"
}
Headers:
  Set-Cookie: refresh=; (cleared)
```

#### Refresh Token
```
GET /users/refresh-token/
Permissions: Public (requires refresh token in cookie)

Response: 200 OK
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

### User Management Endpoints

#### Get Authenticated User
```
GET /users/me/
Permissions: Authenticated

Response: 200 OK
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "phone_number": "+254712345678",
  "address": "123 Main St"
}
```

#### Update Authenticated User
```
PATCH /users/me/
Permissions: Authenticated

Request:
{
  "email": "newemail@example.com",
  "phone": "+254710000000",
  "address": "456 New Ave"
}

Response: 200 OK
{
  "message": "User updated successfully",
  "user": {...}
}
```

#### Delete Authenticated User
```
DELETE /users/me/
Permissions: Authenticated

Response: 204 No Content
```

#### Get User by ID
```
GET /users/<id>/
Permissions: Authenticated (owner or admin)

Response: 200 OK
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "profile": {...}
}
```

#### Update User by ID
```
PATCH /users/<id>/
Permissions: Authenticated (owner or admin)

Response: 200 OK
{
  "message": "User updated successfully",
  "user": {...}
}
```

#### Delete User by ID
```
DELETE /users/<id>/
Permissions: Authenticated (owner or admin)

Response: 204 No Content
```

#### List All Users (Paginated)
```
GET /users/?page=1&page_size=10
Permissions: Admin only

Response: 200 OK
{
  "count": 50,
  "next": "http://api.example.com/v1/users/?page=2",
  "previous": null,
  "results": [...]
}
```

### Profile Endpoints

#### Get Authenticated User's Profile
```
GET /users/me/profile/
Permissions: Authenticated

Response: 200 OK
{
   "phone_number": "+254712345678",
   "address": "123 Main St"
}
```

#### Update Authenticated User's Profile
```
PATCH /users/me/profile/
Permissions: Authenticated

Request:
{
  "phone_number": "+254710000000",
  "address": "456 New Ave"
}

Response: 200 OK
{
  "message": "Profile updated successfully",
  "profile": {...}
}
```

#### Get User Profile by ID
```
GET /users/<user_id>/profile/
Permissions: Authenticated (owner or admin)

Response: 200 OK
{
  "phone_number": "+254712345678",
  "address": "123 Main St"
}
```

#### Update User Profile by ID
```
PATCH /users/<user_id>/profile/
Permissions: Authenticated (owner or admin)

Response: 200 OK
{
  "message": "Profile updated successfully",
  "profile": {...}
}
```

### Building Endpoints

#### List Buildings
```
GET /buildings/?geojson=true&district=Nairobi&price_min=1000&price_max=5000&poi_type=shops&poi_radius=500
Permissions: Public (read), Authenticated (create)

Query Parameters:
  - geojson: true/false (return GeoJSON format for maps) - Default: false
  - district: Filter by district name
  - price_min: Minimum rental price
  - price_max: Maximum rental price
  - poi_type: shops|bus_stop|route (repeatable for multiple filters)
  - poi_radius: Radius in meters for POI proximity (repeatable, must match poi_type count)
  - page: Page number (for pagination)
  - page_size: Results per page (default: 5, max: 20)

GeoJSON Response (geojson=true):
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": 1,
      "geometry": {
        "type": "Point",
        "coordinates": [36.7123, -1.2878]
      },
      "properties": {
        "title": "Cozy 2-Bedroom",
        "address": "456 Elm Street",
        "district": "Nairobi",
        "rental_price": "3500.00",
        "num_bedrooms": 2,
        "num_bathrooms": 1,
        "square_meters": "850.00",
        "amenities": {...},
        "nearby_pois": {
          "shops": [
            {"name": "Supermarket X", "category": "Grocery", "distance_m": 245.5}
          ],
          "bus_stops": [
            {"name": "Main Bus Station", "distance_m": 512.3}
          ]
        }
      }
    }
  ]
}

Paginated Response (geojson=false):
{
  "count": 125,
  "next": "http://api.example.com/v1/buildings/?page=2",
  "previous": null,
  "results": {
  "type": "FeatureCollection",
  "features": [
    {
        "type": "Feature",
        "id": 1,
        "geometry": {
            "type": "Point",
            "coordinates": [
                36.718945,
                -1.265073
            ]
        },
        "properties": {
            "id": 1,
            "title": null,
            "county": "Nairobi",
            "district": "Dagoretti",
            "address": "Uthiru Desire Apartment 3",
            "rental_price": 280.0,
            "num_bedrooms": 5,
            "num_bathrooms": 1,
            "square_meters": 54.0,
            "amenities": ["wifi","parking","pool","gym"],
            "image": "buildings/2026/02/17/abby-rurenko-unsplash.jpg",
            "description": null,
            "owner_contact": "2547XX2384",
            "nearby_pois": null
        }
    }
  ]
}
```

#### Create Building
```
POST /buildings/
Permissions: Authenticated

Request (multipart/form-data):
{
  "title": "Modern Apartment",
  "address": "123 Main Street",
  "county": "Nairobi County",
  "district": "Nairobi",
  "location": "POINT(36.7123 -1.2878)",
  "rental_price": "2500.00",
  "num_bedrooms": 1,
  "num_bathrooms": 1,
  "square_meters": "600.00",
  "pets_allowed": true,
  "available_from": "2026-02-15",
  "image": <binary>,
  "description": "A modern apartment with great amenities",
  "amenities": ["WiFi", "Parking"],
  "owner_contact": "+254712345678"
}

Response: 201 Created
{
  "id": 1,
  "title": "Modern Apartment",
  ...
}
```

#### Get Building Details
```
GET /buildings/<id>/?geojson=true
Permissions: Public

Response: 200 OK (GeoJSON format if geojson=true, otherwise standard JSON)
```

#### Update Building
```
PATCH /buildings/<id>/
Permissions: Authenticated (owner or admin)

Request:
{
  "rental_price": "2750.00",
  "num_bedrooms": 2
}

Response: 200 OK
{...}
```

#### Delete Building
```
DELETE /buildings/<id>/
Permissions: Authenticated (owner or admin)

Response: 204 No Content
```

### Building-Profile Association Endpoints

#### List Profiles Associated with Building
```
GET /buildings/<building_id>/profiles/?page=1
Permissions: Public

Response: 200 OK
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "phone_number": "+254712345678",
      "address": "123 Main St"
    }
  ]
}
```

#### Associate Profile with Building
```
PATCH /buildings/<building_id>/profiles/<user_id>/
Permissions: Authenticated (owner or admin)

Response: 200 OK
{
  "message": "Profile added to building successfully"
}
```

#### Remove Profile from Building
```
DELETE /buildings/<building_id>/profiles/<user_id>/
Permissions: Authenticated (owner or admin)

Response: 200 OK
{
  "message": "Profile removed from building successfully"
}
```

### User Buildings Endpoints

#### Get Authenticated User's Buildings
```
GET /users/me/buildings/?geojson=true
Permissions: Authenticated

Response: GeoJSON (if geojson=true) or paginated JSON list
```

#### Get User's Buildings by ID
```
GET /users/<user_id>/buildings/?geojson=true
Permissions: Authenticated (owner or admin)

Response: GeoJSON or paginated JSON list
```

---

## GIS Components

### Backend: PostGIS Integration

The backend integrates PostGIS, a PostgreSQL spatial extension, to enable advanced geospatial functionality. It supports geometric data types such as Point, LineString, Polygon, and MultiPolygon, leverages GiST spatial indexes for efficient query performance, and utilizes built-in spatial functions for distance calculations and containment operations. All geographic data is stored using the WGS84 coordinate system (SRID 4326) to ensure accurate handling of GPS-based coordinates.

**Django Configuration** (in `settings.py`):
```python
INSTALLED_APPS = [
    'django.contrib.gis',
    ...
]

DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'rental_db',
        'USER': 'postgres',
        'PASSWORD': '...',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

SERIALIZATION_MODULES = {
    "geojson": "django.contrib.gis.serializers.geojson",
}
```

#### GIS Models

**Building Model**:
```python
class Building(models.Model):
    # Geographic field - Point type with WGS84 projection
    location = gis_models.PointField(
        spatial_index=True,  # GiST index for fast queries
        geography=True,      # Use geography type for accurate distance
        srid=4326,          # WGS84 (GPS coordinates)
        null=False,
        blank=False
    )
    # ... other fields
```

**District Model**:
```python
class District(models.Model):
    # Boundary polygon for administrative areas
    geometry = gis_models.MultiPolygonField(
        spatial_index=True,
        srid=4326,
        geography=True,
        null=False
    )
```

**BusStop Model**:
```python
class BusStop(models.Model):
    # Point location for public transport
    geometry = gis_models.PointField(
        spatial_index=True,
        geography=True,
        srid=4326,
        null=False
    )
```

**Route Model**:
```python
class Route(models.Model):
    # LineString for transit paths
    geometry = gis_models.MultiLineStringField(
        spatial_index=True,
        geography=True,
        srid=4326,
        null=False
    )
```

**Shops Model**:
```python
class Shops(models.Model):
    # Point location for retail/service locations
    geometry = gis_models.PointField(
        spatial_index=True,
        geography=True,
        srid=4326,
        null=False
    )
```

#### PostGIS Functions Implemented

**1. Distance Queries**

The API uses `Distance()` function to calculate straight-line distances between buildings and POIs:

```python
from django.contrib.gis.db.models.functions import Distance

# Get shops within 500m of a building, sorted by distance
shops = Shops.objects.annotate(
    distance=Distance('geometry', building.location)
).filter(
    distance__lte=500  # meters
).order_by('distance')

# Response includes distance in meters
# Example: {"name": "Supermarket X", "distance_m": 245.5}
```

**2. Proximity Filtering (Exists Subqueries)**

The API filters buildings by proximity to POIs using spatial relationships:

```python
from django.db.models import Exists, OuterRef

# Find all buildings within 1000m of any bus stop
queryset = Building.objects.annotate(
    has_nearby_stops=Exists(
        BusStop.objects.filter(
            geometry__dwithin=(OuterRef('location'), 1000)
        )
    )
).filter(has_nearby_stops=True)
```

**3. Administrative Boundary Containment**

While not directly exposed in the current API, the District model contains methodology for point-in-polygon queries:

```python
# Check if a building point lies within a district boundary
from django.contrib.gis.db.models.functions import Contains

# Example of how it would be used:
building_in_district = District.objects.filter(
    geometry__contains=building_point
).exists()
```

#### Query Performance Optimization

1. **Spatial Indexes**: All geometry fields use GiST indexes for fast lookups
2. **Geography Type**: Uses accurate Earth ellipsoid for distance calculations
3. **Query Annotation**: Filters applied at database level with `Exists()` subqueries
4. **API Filtering**: Multiple POI filters use unique annotation names to ensure proper AND logic:
   ```python
   # Filter: buildings with shops within 500m AND bus stops within 1000m
   queryset = queryset.annotate(has_nearby_shops_0=Exists(...))
   queryset = queryset.filter(has_nearby_shops_0=True)
   queryset = queryset.annotate(has_nearby_stops_1=Exists(...))
   queryset = queryset.filter(has_nearby_stops_1=True)
   ```


### Frontend: Leaflet Maps Implementation

The frontend GIS layer is built with Leaflet.js, providing a lightweight, interactive mapping interface. The architecture separates map management from listing and filtering logic, loads GeoJSON data asynchronously to improve performance, synchronizes user interactions between map markers and property listings, and ensures responsive behavior by dynamically resizing the map as the layout changes.

#### Core Components

**File**: `rentals/static/rentals/js/map-ui.js`

**1. Map Initialization**

```javascript
// Center on Nairobi CBD
const CENTER_COORDINATES = [-1.281058090000000, 36.712155400000000];
const MAP_ZOOM_LEVEL = 15;

// Initialize Leaflet map
map = L.map('map', {
  center: CENTER_COORDINATES,
  zoom: MAP_ZOOM_LEVEL,
  layers: [baseLayers['OpenStreetMap']]
})
```

**2. Base Layers & Layer Control**

```javascript
const baseLayers = {
  "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }),
  "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '&copy; Esri'
  })
};
```

**3. Administrative Boundary Layer**

```javascript
// Load static GeoJSON file
fetch('/static/rentals/data/nairobi_outline.geojson')
  .then(resp => resp.json())
  .then(data => {
    const boundaryLayer = L.geoJSON(data, {
      style: {
        color: '#1f77b4',
        weight: 2,
        opacity: 0.7,
        fillOpacity: 0.05
      }
    });
    boundaryLayer.addTo(map);
  })
```

**4. Custom Building Icons**

```javascript
const customBuildingIcon = L.Icon.extend({
  options: {
    iconUrl: '/static/rentals/icons/building-icon.svg',
    iconSize: [32, 37],
    iconAnchor: [16, 37],
    popupAnchor: [0, -28]
  }
});
```

**5. All Buildings Layer (GeoJSON)**

```javascript
// Load all buildings as GeoJSON from API
async function loadAllBuildings(){
  const url = `${API_BASE}/buildings/?geojson=true`;
  const resp = await fetch(url);
  const buildings_geojson = await resp.json();
  
  allBuildingsLayer = L.geoJSON(buildings_geojson, {
    pointToLayer: function(feature, latlng){
      // Use custom building icon
      return L.marker(latlng, {icon: new customBuildingIcon()});
    },
    onEachFeature: function(feature, layer){
      // Add popup content
      const props = feature.properties || {};
      const popup = `<div>
        Address: <strong>${props.address}</strong>
        <br/>District: ${props.district}
        <br/>Price: $${props.rental_price}
        <br/>Contact: ${props.owner_contact}
      </div>`;
      layer.bindPopup(popup);
      
      // Track layer by building ID for highlighting
      idToLayer.set(String(props.id || props.pk), layer);
    }
  }).addTo(map);
}
```

**Design rationale**:
- All buildings loaded at once as GeoJSON format (efficient for map rendering)
- Markers use custom building icon for visual consistency
- Popups provide quick property information
- Layer tracking (idToLayer map) enables synchronized highlighting

**6. Synchronized Highlighting**

```javascript
function showOnMap(feature){
  const props = feature.properties || {};
  const key = String(props.id || props.pk);
  
  // Remove previous highlight
  if(activeHighlight && activeHighlight.layer){
    activeHighlight.layer.setIcon(activeHighlight.prevIcon);
  }
  
  // Apply red highlight to new selection
  const layer = idToLayer.get(key);
  if(layer){
    const redIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34]
    });
    layer.setIcon(redIcon);
    layer.openPopup();
    activeHighlight = {layer: layer, prevIcon: previousIcon};
  }
}
```

**Design rationale**:
- Red highlighting provides clear visual feedback
- Previous highlight is restored before applying new one
- Prevents confusion with multiple highlights
- Syncs listing selection with map visualization

**7. Responsive Map Sizing**

```javascript
// Watch for container size changes
const resizeObserver = new ResizeObserver(() => {
  if(map) {
    map.invalidateSize();
  }
});
resizeObserver.observe(mapContainer);
```

**8. Filtered Listings & Multi-Handler**

```javascript
function applyFiltersToUrl(url){
  // Build URL with filter parameters
  const u = new URL(url);
  activeFilters.forEach((value, key) => {
    u.searchParams.append(key, value);
  });
  return u.toString();
}

// Custom fetcher applies filters to all API requests
const listings = window.RentalsListings.createListings({
  apiUrl: `${API_BASE}/buildings/`,
  fetcher: async function(url, opts){
    const finalUrl = applyFiltersToUrl(url);
    return fetch(finalUrl, opts);
  }
});
```

#### Frontend Data Flow

```
User Input (Filters) 
        ↓
Filter Form Submission
        ↓
Build URLSearchParams
        ↓
Apply to Listings Pagination
        ↓
Fetch Filtered Building Data
        ↓
Render Listing Cards + Highlight on Map
        ↓
Click Listing → showOnMap()
        ↓
Highlight Building Marker + Zoom
        ↓
User Views Property Details
```

#### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **GeoJSON API endpoint** | Efficient bulk loading; Leaflet native format |
| **Paginated listings** | Reduces API payload; improves performance |
| **Lazy-load boundary** | Static data doesn't change; reduce initial load |
| **Custom markers** | Visual branding; coordinated with design system |
| **idToLayer mapping** | O(1) lookup for synchronization; prevents DOM traversal |
| **ResizeObserver** | Handles dynamic layout changes; responsive design |
| **Filtered API requests** | Server-side filtering; reduces client-side processing |


## Data & GIS Files

### Files Included in Repository

All geospatial data for **Nairobi County context** is included in the repository and will be automatically available when you clone the project. This ensures users have the complete geographic foundation needed for the application.

#### Shapefiles & Boundaries (Administrative)
```
data/shapefiles/administrative/
├── nairobi_administrative.shp      # Geometry file (districts/boundaries)
├── nairobi_administrative.dbf      # Attribute database
├── nairobi_administrative.prj      # Projection information
├── nairobi_administrative.shx      # Shape index
├── nairobi_administrative.cpg      # Code page file
└── nairobi_administrative.qmd      # QGIS metadata
```

**Purpose**: Administrative district boundaries used to filter properties by district and provide geographic context on the map.

#### Frontend Boundary Files (GeoJSON)
```
rentals/static/rentals/data/
└── nairobi_outline.geojson         # County boundary visualization (committed)
```

**Purpose**: Displayed on the Leaflet map to show the geographic extent of the service area. This is the single source of truth for the county boundary.

#### Additional GIS Data Files

The following directories are **included in the repository**:

```
data/shapefiles/matatus/           # Transit route data (optional)
  ├── shapes.shp, shapes.dbf, shapes.prj, shapes.shx, shapes.cpg, shapes.qpj
  ├── stops.shp, stops.dbf, stops.prj, stops.shx, stops.cpg, stops.qpj
  └── README.txt

data/shapefiles/shopping/          # Shopping districts (optional)
  ├── shopping.shp, shopping.dbf, shopping.prj, shopping.shx, shopping.cpg
  └── (other related files)
```

**These are available for use** but are optional for core functionality. Load instructions are available if you want to use this data.

### Files NOT Included (User-Generated Data)

The following files are **excluded from the repository** and must be created/populated during deployment:

#### Building Data File
```
data/buildings.csv
```

## Installation & Setup

### Prerequisites

- Python 3.8+
- PostgreSQL 12+ with PostGIS extension
- Node.js 14+ (for frontend tests)
- Git (for cloning the repository)

### Step-by-Step Installation Guide

#### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/rental-management-gis.git
cd rental-management-gis
```

#### Step 2: Set Up Python Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate (Linux/Mac)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate
```


#### Step 3: Install Python Dependencies

```bash
pip install -r requirements.txt
```

#### Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
DB_ENGINE=django.contrib.gis.db.backends.postgis
DB_NAME=rental_db
DB_USER=postgres
DB_USER_PWD=your_secure_password
DB_HOST=localhost
DB_PORT=5432

# Django Settings
SECRET_KEY=your-super-secret-key-change-this-in-production
DEBUG=False  # Set to False in production
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com

# JWT Token Lifetimes (optional - uses defaults if not set)
# JWT_ACCESS_TOKEN_LIFETIME=15  # minutes
# JWT_REFRESH_TOKEN_LIFETIME=30  # days
```

#### Step 5: Set Up PostgreSQL Database with PostGIS

```bash
# Connect to PostgreSQL command line
psql -U postgres

# In the psql shell, create database and enable PostGIS:
CREATE DATABASE rental_db;
\c rental_db
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

# Verify installation:
SELECT PostGIS_Version();

# Exit psql
\q
```

#### Step 6: Run Database Migrations

```bash
python manage.py migrate
```

#### Step 7: Load GIS Data

```bash
# Load district boundary data
python manage.py load_districts

# Load bus stops (public transportation)
python manage.py load_bus_stops

# Load matatu routes (public transit routes)
python manage.py load_routes

# Load shops and amenities
python manage.py load_shops
```

#### Step 8: Install Frontend Dependencies

```bash
npm install
```

Installs:
- Jest testing framework
- Test utilities
- Development dependencies

#### Step 9: Create Superuser (Admin Account)

```bash
python manage.py createsuperuser
```

Follow prompts:
```
Username: admin
Email: admin@example.com
Password: StrongP@ss1!
Password (again): StrongP@ss1!
```

#### Step 10: Populate Building Data (CSV)

Create a CSV file at `data/buildings.csv` with rental property data. See the [Buildings CSV Format](#buildings-csv-format) section for required columns and format.

#### Step 11 Load Buildings

```bash
python manage.py import_buildings
```


## Buildings CSV Format

### File Location
```
data/buildings.csv
```

### Required Columns

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `title` | String (150 chars) | Property name/title | "Modern 2-BR Apartment" |
| `county` | String (100 chars) | County name | "Nairobi County" |
| `district` | String (100 chars) | District/area name | "Nairobi" |
| `address` | String (255 chars) | Full address | "123 Main Street, Nairobi" |
| `latitude` | Float | GPS latitude (WGS84) | -1.28576 |
| `longitude` | Float | GPS longitude (WGS84) | 36.81516 |
| `rental_price` | Decimal | Monthly rent in USD | 2500.00 |
| `num_bedrooms` | Integer | Number of bedrooms | 2 |
| `num_bathrooms` | Integer | Number of bathrooms | 1 |
| `square_meters` | Decimal | Property size | 850.50 |
| `pets_allowed` | Boolean | Pets permitted? | true |
| `is_available` | Boolean | Currently available? | true |
| `owner_contact` | String (100 chars) | Owner phone/email | "+254712345678" |
| `description` | String (1000 chars) | Property description | "Beautiful modern apartment with WiFi and parking" |
| `amenities` | JSON Array | Features as JSON | "["WiFi","Parking","Garden","24hr Security"]" |

### CSV Template Example

Create `data/buildings.csv`:

```csv
title,county,district,address,latitude,longitude,rental_price,num_bedrooms,num_bathrooms,square_meters,pets_allowed,is_available,owner_contact,description,amenities
Modern 2-Bedroom Apartment,Nairobi County,Nairobi,123 Main Street,36.7123,-1.2878,2500.00,2,1,850.50,true,true,+254712345678,Beautiful modern apartment with great amenities,"["WiFi","Parking","Garden"]"
Cozy Studio Flat,Nairobi County,Westlands,456 Elm Road,36.8050,-1.2706,1500.00,1,1,450.00,false,true,+254722111222,Studio apartment perfect for singles,"["WiFi","Kitchen"]"
Spacious 3-BR House,Nairobi County,Parklands,789 Oak Avenue,36.7650,-1.3050,5000.00,3,2,1200.00,true,true,+254732333444,Lovely house with garden and garage,"["WiFi","Parking","Garden","Security"]"
```

## Running the Server

### Development Server

```bash
python manage.py runserver
```

The application will be available at `http://localhost:8000/rentals/`




## Testing

### Backend Testing

#### Run All Backend Tests

```bash
python manage.py test
```

#### Run Specific Test Module

```bash
# Test models
python manage.py test rentals.tests.test_models

# Test API views
python manage.py test rentals.tests.test_api_views

# Test authentication
python manage.py test rentals.tests.test_authentication
```

#### Backend Test Coverage

**File**: `rentals/tests/test_models.py`

Tests cover:
- Building creation with geographic coordinates
- Profile auto-creation via signals
- Profile-Building many-to-many relationships
- Cascade deletion and orphaned building cleanup
- String representations

**Example Test**:
```python
def test_building_creation_valid(self):
    """A Building can be created with required fields."""
    p = Point(1.0, 2.0)  # Geographic point
    b = Building.objects.create(
        county='TestCounty',
        location=p,
        rental_price='1200.00',
        owner_contact='owner@example.com'
    )
    self.assertIsNotNone(b.id)
    self.assertEqual(b.county, 'TestCounty')
```

**File**: `rentals/tests/test_authentication.py`

Tests cover:
- User registration with password strength validation
- JWT token generation and validation
- Refresh token mechanism
- Token expiry handling
- Logout cookie clearing
- Invalid credential rejection

**Example Test**:
```python
def test_login_success_sets_tokens(self):
    """Login returns access token and sets refresh cookie."""
    resp = self.client.post(self.login_url, {
        'username': 'testuser',
        'password': 'StrongP@ss1'
    }, format='json')
    self.assertEqual(resp.status_code, 200)
    self.assertIn('access', resp.data)
    self.assertIn('refresh', resp.cookies)
```

**File**: `rentals/tests/test_api_views.py`

Tests cover:
- RESTful endpoint functionality (GET, POST, PATCH, DELETE)
- Permission checks (owner, admin, authenticated, public)
- GeoJSON serialization
- Pagination
- Building-Profile associations
- Error handling

**Example Test**:
```python
def test_user_detail_get_patch_delete_permissions(self):
    """User can only access own details without admin."""
    token_resp = self._login_and_get_token('user1', 'StrongP@ss1')
    access = token_resp.data.get('access')
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
    r = client.get(self.user_detail_url(self.user.pk))
    self.assertEqual(r.status_code, 200)
```

### Frontend Testing

#### Run All Frontend Tests

```bash
npm test
```

#### Run Tests in Watch Mode

```bash
npm run test:watch
```

#### Generate Coverage Report

```bash
npm run test:coverage
```

View at: `coverage/lcov-report/index.html`

**Test Files Location**: `rentals/static/rentals/js/tests/`

**Key Frontend Modules Tested**:
- `map-ui.js`: Map initialization, layer management, highlighting
- `listings.js`: Listing rendering, pagination, filtering
- `filters-form.js`: Filter form handling, validation
- `account.js`: User account management, profile updates
- `login.js`: Authentication forms, token handling
- `register.js`: User registration, password validation


## Complete Deployment Checklist

Use this checklist for a complete deployment:

```
☐ 1. Clone repository (GIS data included)
☐ 2. Create & activate Python virtual environment
☐ 3. Install Python dependencies (pip install -r requirements.txt)
☐ 4. Install Node.js dependencies (npm install)
☐ 5. Configure .env file with database credentials
☐ 6. Create PostgreSQL database with PostGIS extension
☐ 7. Run migrations (python manage.py migrate)
☐ 8. Load district boundaries (python manage.py load_districts)
☐ 9. Prepare buildings.csv file with your properties
☐ 10. Load buildings (python manage.py import_buildings)
☐ 11. Create superuser for admin access (python manage.py createsuperuser)
☐ 12. Run tests to verify installation (python manage.py test)
☐ 13. Start development server (python manage.py runserver)
☐ 14. Access application at http://localhost:8000/rentals/
☐ 15. Verify buildings appear on the map
```


## Technologies Used

### Backend
- **Django 5.2**: Web framework
- **Django REST Framework 3.16**: REST API development
- **Django REST Framework Simple JWT**: Token authentication
- **PostGIS**: Spatial database extension
- **PostgreSQL**: Relational database with spatial support
- **Psycopg**: PostgreSQL driver for Python

### Frontend
- **Leaflet 1.9.4**: Interactive mapping library
- **OpenStreetMap**: Free tile layer provider
- **ArcGIS**: Satellite imagery provider
- **Vanilla JavaScript**: No frontend framework dependencies
- **Jest**: JavaScript testing framework

### Development
- **Django Management Commands**: Data import utilities
- **Django Signals**: Automatic profile creation
- **Custom Pagination**: 5 results per page
- **GeoJSON Serialization**: Map-compatible format


## Security Considerations

1. **JWT Token Storage**: Access tokens in memory, refresh tokens in secure HttpOnly cookies
2. **Password Strength**: Enforced 8+ chars, uppercase, numbers, special characters
3. **CORS & CSRF**: Protected via Django middleware and SameSite cookie policy
4. **SQL Injection**: Django ORM prevents SQL injection attacks
5. **Content Security Policy**: Configured to limit script execution
6. **HTTPS**: Set `SECURE_SSL_REDIRECT=True` in production
7. **User Permissions**: Role-based access control (owner, admin, authenticated, public)


## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request


## Authors

**Philip Nyakwaka** . [GitHub](https://github.com/philipnyakwaka1) · [Twitter](https://x.com/ominaphillip18)

## License

This project is provided for portfolio and demonstration purposes.

You may view, run, and study the code for personal or educational use.
Reuse, redistribution, or commercial use of this project or its assets is not permitted without permission.



