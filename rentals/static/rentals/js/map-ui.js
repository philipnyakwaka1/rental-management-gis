// map-ui.js: map + listing UI for rentals
(function(){
  const API_BASE = '/rentals/api/v1';
  const CENTER_COORDINATES = [0.5, 0.5]; //-1.2921, 36.8219
  const MAP_ZOOM_LEVEL = 10;


  let map = null;
  let allBuildingsGeoJSON = null;
  let allBuildingsLayer = null;
  let idToLayer = new Map();
  let activeHighlight = null;


  const baseLayers = 
  {
        "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }),

        "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: '&copy; Esri'
        }),
    };

 
    const customBuildingIcon = L.Icon.extend(
    {
        options: {
            iconUrl: '/static/rentals/icons/building-icon.svg',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize:     [32, 37],
            iconAnchor:   [16, 37],
            popupAnchor:  [0, -28] 
        }
    });
  
    function showOnMap(f){
        const coords = f.geometry && f.geometry.coordinates;
        if(!coords) return;
        map.flyTo([coords[1], coords[0]], 16);

        const props = f.properties || {};
        const key = props.id || props.pk || `${coords[0].toFixed(6)}_${coords[1].toFixed(6)}`;

        if(activeHighlight && activeHighlight.layer){
          try{ activeHighlight.layer.setIcon(activeHighlight.prevIcon); }catch(e){}
          activeHighlight = null;
        }

        const baseLayerMarker = idToLayer.get(String(key));
        if(baseLayerMarker){
          const prev = baseLayerMarker.options && baseLayerMarker.options.icon ? baseLayerMarker.options.icon : null;
          const redIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25,41],
            iconAnchor: [12,41],
            popupAnchor: [1,-34],
            shadowSize: [41,41]
          });
          try{ baseLayerMarker.setIcon(redIcon); baseLayerMarker.openPopup(); activeHighlight = {layer: baseLayerMarker, prevIcon: prev}; }catch(e){ console.warn('setIcon failed', e); }
          return;
        }
    }


  function init(){
    // initialize map
    map = L.map('map', {
      center: CENTER_COORDINATES,
      zoom: MAP_ZOOM_LEVEL,
      layers: [baseLayers['OpenStreetMap']]
    })

    L.control.layers(baseLayers).addTo(map)
    
    // highlight layer sits above base markers
    highlightLayer = L.layerGroup().addTo(map);

    loadAllBuildings().then(() => {
      const params = new URLSearchParams(window.location.search);
      highlight = params.get('highlight');
      if(highlight){
        // try to find and highlight
        const layer = idToLayer.get(String(highlight));
        if(layer && layer.feature && layer.feature.geometry){
            showOnMap(layer.feature);
        }
      }
    });
    
    // add event listeners for filtering listings
    const filtersForm = document.getElementById('filters-form');
    const resetBtn = filtersForm ? filtersForm.querySelector('button[type="reset"]') : null;
    let activeFilters = null;

    function buildFilterParams(){
      if(!filtersForm) return null;
      const params = new URLSearchParams();
      const formData = new FormData(filtersForm);
      for(const [key, value] of formData.entries()){
        if(value !== null && value !== undefined && String(value).trim() !== ''){
          params.append(key, String(value).trim());
        }
      }
      return params.toString() ? params : null;
    }

    function applyFiltersToUrl(url){
      if(!activeFilters) return url;
      const u = new URL(url, window.location.origin);
      activeFilters.forEach((value, key) => {
        u.searchParams.append(key, value);
      });
      return u.toString();
    }

    // Initialize shared listings renderer
    const listings = window.RentalsListings.createListings({
      apiUrl: `${API_BASE}/buildings/`,
      container: '#listings',
      pagination: '#pagination',
      onShow: function(f){ showOnMap(f); },
      fetcher: async function(url, opts){
        const finalUrl = applyFiltersToUrl(url);
        const resp = await fetch(finalUrl, opts);
        if(resp && resp.status === 404){
          return {
            ok: true,
            status: 200,
            json: async () => ({ results: [], next: null, previous: null })
          };
        }
        return resp;
      }
    });

    if(filtersForm){
      filtersForm.addEventListener('submit', (e) => {
        if(e.defaultPrevented) return;
        e.preventDefault();
        activeFilters = buildFilterParams();
        listings.fetchPage(1);
      });
    }

    if(resetBtn){
      resetBtn.addEventListener('click', () => {
        activeFilters = null;
        listings.fetchPage(1);
      });
    }

    listings.fetchPage(1);
  }

  // Load all buildings (GeoJSON) for map layer
  async function loadAllBuildings(){
    try{
      const url = `${API_BASE}/buildings/?geojson=true`;
      const resp = await fetch(url);
      if(!resp.ok) throw new Error('Failed to fetch all buildings: '+resp.status);
      let data = await resp.json();
      if(typeof data === 'string') data = JSON.parse(data);
      allBuildingsGeoJSON = data;
      if(allBuildingsLayer) map.removeLayer(allBuildingsLayer);

      allBuildingsLayer = L.geoJSON(allBuildingsGeoJSON, {
        pointToLayer: function(feature, latlng){
          return L.marker(latlng, {icon: new customBuildingIcon()});
        },
        onEachFeature: function(feature, layer){
          const props = feature.properties || {};
          const popup = `<div><strong>${window.RentalsSharedUtils.escapeHtml(props.address||'Address')}</strong><br/>Price: ${window.RentalsSharedUtils.escapeHtml(props.rental_price||'N/A')}</div>`;
          layer.bindPopup(popup);

          // register layer by id (fallback to coordinate key)
          const coords = feature.geometry && feature.geometry.coordinates;
          const key = props.id || props.pk || (coords ? `${coords[0].toFixed(6)}_${coords[1].toFixed(6)}` : null);
          if(key) idToLayer.set(String(key), layer);
        }
      }).addTo(map);
      // fit bounds only if no other data is present (don't override user view)
      try{ if(allBuildingsLayer && allBuildingsLayer.getBounds && !map._initialBoundsSet){ map.fitBounds(allBuildingsLayer.getBounds(), {maxZoom: 14}); map._initialBoundsSet = true; } }catch(e){}
    }catch(e){ console.error('loadAllBuildings error', e); }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
