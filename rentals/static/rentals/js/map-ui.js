// map-ui.js: map + listing UI for rentals
(function(){
  const API_BASE = '/rentals/api/v1';
  const CENTER_COORDINATES = [-1.281058090000000, 36.712155400000000];
  const MAP_ZOOM_LEVEL = 15;


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
        
        // Scroll the map card into view at the top of the viewport before zooming
        const mapContainer = document.getElementById('map');
        if(mapContainer){
            const mapCard = mapContainer.closest('.card');
            if(mapCard){
                mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

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
          try{ 
            baseLayerMarker.setIcon(redIcon);
            // Use markerCluster's zoomToShowLayer to uncluster and zoom to the marker
            if(allBuildingsLayer && allBuildingsLayer.zoomToShowLayer){
              allBuildingsLayer.zoomToShowLayer(baseLayerMarker, function(){
                // Open popup after unclustering completes
                setTimeout(() => baseLayerMarker.openPopup(), 300);
              });
            } else {
              // Fallback if cluster method not available
              map.flyTo(baseLayerMarker.getLatLng(), 16);
              setTimeout(() => baseLayerMarker.openPopup(), 300);
            }
            activeHighlight = {layer: baseLayerMarker, prevIcon: prev}; 
          }catch(e){ console.warn('setIcon/zoomToShowLayer failed', e); }
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

    // Load administrative boundary
    const overlayLayers = {};
    const layerControl = L.control.layers(baseLayers, overlayLayers);
    layerControl.addTo(map);
    
    // Load boundary layer asynchronously and add to map when ready
    fetch('/static/rentals/data/nairobi_outline.geojson')
      .then(resp => resp.json())
      .then(data => {
        const boundaryLayer = L.geoJSON(data, {
          style: { color: '#1f77b4', weight: 2, opacity: 0.7, fillOpacity: 0.05 }
        });
        boundaryLayer.addTo(map);
        overlayLayers['Nairobi County Boundary'] = boundaryLayer;
        layerControl.addOverlay(boundaryLayer, 'Nairobi County Boundary');
      })
      .catch(e => console.warn('Boundary layer load failed', e));
    
    // highlight layer sits above base markers
    highlightLayer = L.layerGroup().addTo(map);

    // Watch for container size changes and invalidate map size
    // This ensures the map redraws when listings expand/contract the viewport
    const mapContainer = document.getElementById('map');
    let resizeObserver = null;
    if(mapContainer && window.ResizeObserver){
      resizeObserver = new ResizeObserver(() => {
        if(map) {
          map.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainer);
      
      // Clean up observer when page unloads
      window.addEventListener('unload', () => {
        if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
        }
      });
    }

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

  // Load all buildings (GeoJSON) for map layer with clustering
  async function loadAllBuildings(){
    try{
      const url = `${API_BASE}/buildings/?geojson=true`;
      const resp = await fetch(url);
      if(!resp.ok) throw new Error('Failed to fetch all buildings: '+resp.status);
      let data = await resp.json();
      if(typeof data === 'string') data = JSON.parse(data);
      allBuildingsGeoJSON = data;
      if(allBuildingsLayer) map.removeLayer(allBuildingsLayer);

      // Create marker cluster group with custom styling (no hover polygon)
      allBuildingsLayer = L.markerClusterGroup({
        maxClusterRadius: 60,
        showCoverageOnHover: false,  // Disable hover polygon
        zoomToBoundsOnClick: true,   // Enable default clustering behavior
        iconCreateFunction: function(cluster) {
          const count = cluster.getChildCount();
          return new L.DivIcon({
            html: `<div class="cluster-marker"><img src="/static/rentals/icons/building-icon.svg" alt="cluster"/><span class="cluster-count">${count}</span></div>`,
            className: '',
            iconSize: [40, 45],
            iconAnchor: [20, 45]
          });
        }
      });

      // Add markers to cluster group
      (allBuildingsGeoJSON.features || []).forEach(feature => {
        const coords = feature.geometry && feature.geometry.coordinates;
        if(!coords) return;
        
        const latlng = [coords[1], coords[0]];
        const marker = L.marker(latlng, {icon: new customBuildingIcon()});
        
        const props = feature.properties || {};
        const popup = `<div>Address: <strong>${window.RentalsSharedUtils.escapeHtml(props.address||'Address')}</strong><br/>District: ${window.RentalsSharedUtils.escapeHtml(props.district||'N/A')}<br/>Price (USD): ${window.RentalsSharedUtils.escapeHtml(props.rental_price||'N/A')}<br/>Owner's contact: ${window.RentalsSharedUtils.escapeHtml(props.owner_contact||'N/A')}</div>`;
        marker.bindPopup(popup);
        
        // register layer by id (fallback to coordinate key)
        const key = props.id || props.pk || `${coords[0].toFixed(6)}_${coords[1].toFixed(6)}`;
        if(key) idToLayer.set(String(key), marker);
        
        // Store feature reference for highlighting
        marker.feature = feature;
        
        allBuildingsLayer.addLayer(marker);
      });

      allBuildingsLayer.addTo(map);
      
      // fit bounds only if no other data is present (don't override user view)
      try{ if(allBuildingsLayer && allBuildingsLayer.getBounds && !map._initialBoundsSet){ map.fitBounds(allBuildingsLayer.getBounds(), {maxZoom: 14}); map._initialBoundsSet = true; } }catch(e){}
    }catch(e){ 
      console.error('loadAllBuildings error', e); 
      // Initialize with empty GeoJSON on error to prevent null reference issues
      if (!allBuildingsGeoJSON) {
        allBuildingsGeoJSON = {type: 'FeatureCollection', features: []};
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
