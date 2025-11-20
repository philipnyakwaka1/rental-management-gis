# Frontend Map Implementation Plan

This document describes the front-end implementation for the Rental Management GIS map page and the approach to implement proximity filtering and POI-based analysis.

Goals
- Visualize Building objects from the backend on a web map (Leaflet)
- Allow simple proximity filtering (e.g., buildings within X meters of nearest bus stop)
- Avoid loading large datasets in the browser; use bounding queries or server pagination where possible
- Provide clear instructions for production-ready improvements (server-side spatial filtering, caching, POI sources)

Existing API
- Buildings endpoint: `/rentals/api/v1/buildings/`
  - Add `?geojson=true` to receive a GeoJSON FeatureCollection (Django's `serializers.serialize('geojson', ...)`).
- Building detail: `/rentals/api/v1/buildings/<id>/?geojson=true` returns GeoJSON for a single building.

Frontend choices
- Map rendering: Leaflet (lightweight, open-source)
- Spatial operations: Turf.js for client-side distance, nearest point, and buffering operations
- POI source: OpenStreetMap Overpass API (On-demand bbox queries) or Nominatim for specific queries

Implementation details (what we added)
- Template: `rentals/templates/rentals/map.html`
  - Loads Leaflet and Turf.js, includes controls for selecting POI type and max distance.
- Static JS: `rentals/static/rentals/js/map.js`
  - Fetches buildings GeoJSON from `/rentals/api/v1/buildings/?geojson=true`.
  - Adds buildings to a Leaflet GeoJSON layer and binds popups showing attributes.
  - Uses Overpass API as an example data source for POIs (limited to current map bbox) and converts results to GeoJSON.
  - Filters buildings by computing nearest POI and distance using Turf.js.
- Static CSS: `rentals/static/rentals/css/map.css` for controls.
- Backend small change: added `map_view` in `rentals/views.py` and routed it at `/rentals/` in `rentals/urls.py`.

Notes and caveats
- Performance: Current implementation fetches all buildings via the `geojson=true` endpoint. For production, implement server-side bbox filtering and pagination before returning GeoJSON so the browser receives only the features visible in the current viewport.
- POI usage: Overpass is rate-limited; for heavy traffic or repeated queries you should:
  - Cache results server-side per bbox/POI type
  - Or periodically pull focused POI datasets into PostGIS (if you opt to host data)
- Security: Be sure to enable HTTPS and secure cookies for auth endpoints in production.

Recommended production steps
1. Add server-side bounding-box query to `building_list_create` so frontend can request `?geojson=true&bbox=minLon,minLat,maxLon,maxLat` and get only relevant features.
2. Add server-side endpoints to query nearest POIs using PostGIS `ST_DWithin` and appropriate indexes when you decide to host POIs.
3. Add caching in front of Overpass or self-host static POI extracts for commonly queried regions.
4. Add rate-limiting and protection if you expose Overpass relay endpoints via your server.

How to run locally
- Start Django development server as usual:
  ```bash
  python3 rentals_root/manage.py runserver
  # then open http://127.0.0.1:8000/rentals/ in your browser
  ```

Files added in this change
- `rentals/views.py` — new `map_view`
- `rentals/urls.py` — added route for the map
- `rentals/templates/rentals/map.html` — frontend template
- `rentals/static/rentals/js/map.js` — Leaflet + Turf.js logic
- `rentals/static/rentals/css/map.css` — controls styling

Next improvements (short roadmap)
1. Implement server-side bbox filtering and support for `bbox` parameter.
2. Add API endpoints that return nearby POIs (server-side), optionally backed by PostGIS.
3. Add clustering of building markers for better performance at low zoom.
4. Add unit/integration tests for the frontend where applicable (Selenium/playwright) and API tests for bbox and POI endpoints.

Contact
If you'd like, I can implement server-side bbox filtering and add a sample PostGIS-based POI nearest endpoint next. Tell me which option you prefer (Overpass caching vs hosting POIs in PostGIS) and I will proceed.
