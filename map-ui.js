// map-ui.js: map + listing UI for rentals
(function(){
  const API_BASE = '/rentals/api/v1';
  const CENTER_COORDINATES = [-1.2921, 36.8219];
  const MAP_ZOOM_LEVEL = 10;

  // Map and layers
  let map = null;
  let markersLayer = null;
  let currentGeoJSON = null;
  let allBuildingsGeoJSON = null;
  let allBuildingsLayer = null; // base layer showing all buildings
  let highlightLayer = null; // highlights (filtered / page) on top of base layer

  // Pagination state
  let currentPage = 1;
  let pageNext = null;
  let pagePrev = null;

  function init(){
    // initialize map
    map = L.map('map').setView([0.5,0.5], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OSM contributors'}).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    // highlight layer sits above base markers
    highlightLayer = L.layerGroup().addTo(map);

    // load all buildings for map display (separate from paginated listings)
    loadAllBuildings();

    // bind UI events
    document.getElementById('apply-poi-filter').addEventListener('click', applyFilters);
    document.getElementById('reset-filters').addEventListener('click', resetFilters);
    document.getElementById('geo-locate').addEventListener('click', useMyLocation);
    document.getElementById('submit-create').addEventListener('click', submitCreate);

    // load first page
    fetchPage(1);
  }

  async function fetchPage(page=1){
    currentPage = page;
    const url = `${API_BASE}/buildings/?page=${page}`;
    const resp = await fetch(url);
    if(!resp.ok){
      console.error('Failed to fetch listings', resp.status);
      return;
    }
    const data = await resp.json();
    // data expected as paginated response with 'results' array where each item is a geojson string
    pageNext = data.next;
    pagePrev = data.previous;
    const items = (data.results || []).map(parseBuildingItem).filter(Boolean);
    currentGeoJSON = {type:'FeatureCollection', features: items};
    renderListings(items);
    // Render listings on map as highlights (map base always shows all buildings)
    renderMap(items);
    renderPagination();
  }

  // Load all buildings (GeoJSON) for map layer
  async function loadAllBuildings(){
    try{
      const url = `${API_BASE}/buildings/?geojson=true`;
      const resp = await fetch(url);
      if(!resp.ok) throw new Error('Failed to fetch all buildings: '+resp.status);
      let data = await resp.json();
      // some endpoints may return a JSON string; handle both
      if(typeof data === 'string') data = JSON.parse(data);
      allBuildingsGeoJSON = data;
      if(allBuildingsLayer) map.removeLayer(allBuildingsLayer);
      allBuildingsLayer = L.geoJSON(allBuildingsGeoJSON, {
        pointToLayer: function(feature, latlng){
          // small neutral marker for all buildings
          return L.circleMarker(latlng, {radius:5, color:'#2a6f97', fillOpacity:0.8});
        },
        onEachFeature: function(feature, layer){
          const props = feature.properties || {};
          const popup = `<div><strong>${escapeHtml(props.address||'Address')}</strong><br/>Price: ${escapeHtml(props.rental_price||'N/A')}</div>`;
          layer.bindPopup(popup);
        }
      }).addTo(map);
      // fit bounds only if no other data is present (don't override user view)
      try{ if(allBuildingsLayer && allBuildingsLayer.getBounds && !map._initialBoundsSet){ map.fitBounds(allBuildingsLayer.getBounds(), {maxZoom: 14}); map._initialBoundsSet = true; } }catch(e){}
    }catch(e){ console.error('loadAllBuildings error', e); }
  }

  function parseBuildingItem(item){
    try{
      // server sends serialized geojson string per item (FeatureCollection with single feature)
      if(typeof item === 'string'){
        const obj = JSON.parse(item);
        if(obj && obj.type === 'FeatureCollection' && obj.features && obj.features.length>0){
          return obj.features[0];
        }
      } else if(item && item.type === 'Feature'){
        return item;
      }
    }catch(e){ console.warn('parse error', e); }
    return null;
  }

  function renderMap(features){
    // Map always displays `allBuildingsLayer` (loaded separately).
    // `features` is an optional array used to highlight a subset (page or filtered results).
    highlightLayer.clearLayers();
    if(!features || !features.length) return; // nothing to highlight
    const bounds = [];
    features.forEach(f => {
      const coords = f.geometry.coordinates; // [lng,lat]
      const latlng = [coords[1], coords[0]];
      const marker = L.circleMarker(latlng, {radius:8, color:'#ff0000', fillOpacity:0.9}).addTo(highlightLayer);
      const props = f.properties || {};
      const popup = `<div><strong>${escapeHtml(props.address || 'Address')}</strong><br/>Price: ${escapeHtml(props.rental_price||'N/A')}</div>`;
      marker.bindPopup(popup);
      marker.featureId = props.id || props.pk || null;
      bounds.push(latlng);
    });
    if(bounds.length) map.fitBounds(bounds, {maxZoom:16});
  }

  function renderListings(features){
    const container = document.getElementById('listings');
    container.innerHTML = '';
    features.forEach((f, idx) => {
      const props = f.properties || {};
      const title = props.address || `Listing ${idx+1}`;
      const price = props.rental_price || 'N/A';
      const li = document.createElement('div');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      li.innerHTML = `<div>
          <div class="fw-bold">${escapeHtml(title)}</div>
          <div class="text-muted">Price: ${escapeHtml(price)}</div>
        </div>
        <div>
          <button class="btn btn-sm btn-outline-primary show-on-map">Show</button>
        </div>`;
      li.querySelector('.show-on-map').addEventListener('click', ()=>{
        const coords = f.geometry.coordinates;
        map.setView([coords[1], coords[0]], 16);
        // open popup on the corresponding marker in allBuildingsLayer (base layer)
        if(allBuildingsLayer){
          let opened = false;
          allBuildingsLayer.eachLayer(m => {
            const ll = m.getLatLng && m.getLatLng();
            if(!ll) return;
            if(Math.abs(ll.lat - coords[1])<1e-6 && Math.abs(ll.lng - coords[0])<1e-6){
              m.openPopup(); opened = true;
            }
          });
          // fallback: if not found in base layer, open popup from highlight layer
          if(!opened){
            highlightLayer.eachLayer(m => {
              const ll = m.getLatLng && m.getLatLng();
              if(!ll) return;
              if(Math.abs(ll.lat - coords[1])<1e-6 && Math.abs(ll.lng - coords[0])<1e-6){
                m.openPopup();
              }
            });
          }
        }
      });
      container.appendChild(li);
    });
  }

  function renderPagination(){
    const ul = document.getElementById('pagination');
    ul.innerHTML = '';
    const prevLi = document.createElement('li'); prevLi.className='page-item'+(pagePrev? '':' disabled');
    prevLi.innerHTML = `<a class="page-link" href="#">Prev</a>`;
    prevLi.addEventListener('click', (e)=>{ e.preventDefault(); if(pagePrev) fetchPage(currentPage-1); });
    ul.appendChild(prevLi);

    const curLi = document.createElement('li'); curLi.className='page-item active'; curLi.innerHTML = `<span class="page-link">${currentPage}</span>`;
    ul.appendChild(curLi);

    const nextLi = document.createElement('li'); nextLi.className='page-item'+(pageNext? '':' disabled');
    nextLi.innerHTML = `<a class="page-link" href="#">Next</a>`;
    nextLi.addEventListener('click', (e)=>{ e.preventDefault(); if(pageNext) fetchPage(currentPage+1); });
    ul.appendChild(nextLi);
  }

  async function applyFilters(){
    // currently we only filter by price and optionally by proximity to POI around map center
    const min = parseFloat(document.getElementById('price-min').value) || 0;
    const max = parseFloat(document.getElementById('price-max').value) || Number.POSITIVE_INFINITY;
    const poi = document.getElementById('poi-filter').value;
    const radius = parseFloat(document.getElementById('poi-radius').value) || 800;

    // Use current loaded features in currentGeoJSON
    if(!currentGeoJSON) return;
    let filtered = currentGeoJSON.features.filter(f => {
      const p = parseFloat(f.properties && f.properties.rental_price) || 0;
      return p>=min && p<=max;
    });

    if(poi){
      // fetch POIs near map center then compute which buildings are within radius of any POI
      const center = map.getCenter();
      let pois = [];
      try{
        const data = await fetchPOIs(center.lat, center.lng, radius, poi);
        pois = data.elements || [];
      }catch(e){ console.warn('POI fetch failed', e); pois = []; }

      if(pois.length){
        const poiPoints = pois.map(el => el.type==='node' ? [el.lon, el.lat] : (el.center? [el.center.lon, el.center.lat] : null)).filter(Boolean);
        filtered = filtered.filter(f => {
          const coords = f.geometry.coordinates; // [lng,lat]
          return poiPoints.some(pp => turf.distance(turf.point(coords), turf.point(pp), {units:'meters'}) <= radius);
        });
      } else {
        // no pois -> empty result
        filtered = [];
      }
    }

    renderListings(filtered);
    renderMap(filtered);
  }

  function resetFilters(){
    document.getElementById('price-min').value='';
    document.getElementById('price-max').value='';
    document.getElementById('poi-filter').value='';
    document.getElementById('poi-radius').value='800';
    if(currentGeoJSON) {
      renderListings(currentGeoJSON.features);
      renderMap(currentGeoJSON.features);
    }
  }

  function useMyLocation(){
    if(!navigator.geolocation) return alert('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(pos =>{
      const lat = pos.coords.latitude; const lng = pos.coords.longitude;
      document.getElementById('create-lat').value = lat; document.getElementById('create-lng').value = lng;
    }, err => alert('Geolocation error: '+err.message));
  }

  async function submitCreate(){
    const addr = document.getElementById('create-address').value;
    const price = document.getElementById('create-price').value;
    const lat = document.getElementById('create-lat').value;
    const lng = document.getElementById('create-lng').value;
    if(!addr || !price || !lat || !lng) return alert('Please fill all required fields and coordinates');
    const body = {
      user_id: null, // server will check session; if not logged-in this will fail
      address: addr,
      rental_price: price,
      location: `${lat},${lng}`,
      owner_contact: ''
    };
    try{
      const resp = await fetch(`${API_BASE}/buildings/`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      if(resp.status===201){
        alert('Created');
        fetchPage(1);
        const modal = bootstrap.Modal.getInstance(document.getElementById('createModal'));
        modal.hide();
      } else {
        const data = await resp.json(); alert('Create failed: '+JSON.stringify(data));
      }
    }catch(e){ console.error(e); alert('Create failed'); }
  }

  // Overpass POI fetch
  async function fetchPOIs(lat, lng, radius, amenity){
    // Overpass QL
    const q = `[out:json][timeout:25];(node(around:${radius},${lat},${lng})[amenity=${amenity}];way(around:${radius},${lat},${lng})[amenity=${amenity}];rel(around:${radius},${lat},${lng})[amenity=${amenity}];); out center;`;
    const resp = await fetch('https://overpass-api.de/api/interpreter', {method:'POST', body: q, headers:{'Content-Type':'application/x-www-form-urlencoded'}});
    if(!resp.ok) throw new Error('Overpass error');
    return await resp.json();
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // bootstrap
  document.addEventListener('DOMContentLoaded', init);
  window.RentalsUI = { fetchPage };
})();
