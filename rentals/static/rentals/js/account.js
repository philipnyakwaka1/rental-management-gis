(function(){
  'use strict';

  // Toggle password change area
  (function(){
    const toggle = document.getElementById('toggle-password-area');
    const area = document.getElementById('password-area');
    if (toggle && area) {
      toggle.addEventListener('click', function(e){
        e.preventDefault();
        const showing = area.classList.toggle('show');
        ['id_old_password','id_new_password1','id_new_password2'].forEach(id=>{
          const el = document.getElementById(id);
          if (!el) return;
          if (showing) el.setAttribute('required','required'); else el.removeAttribute('required');
        });
      });
    }
  })();

  // Reusable authenticated fetch with auto-refresh
  async function authFetch(url, options = {}) {
    options.method = options.method || 'GET';
    options.headers = options.headers || {};
    const accessToken = window.sessionStorage.getItem('access_token');

    if (accessToken) {
      options.headers['Authorization'] = 'Bearer ' + accessToken;
    }

    // send cookies for refresh
    options.credentials = 'include';

    let response = await fetch(url, options);

    if (response.status === 401) {
      console.warn('Access token expired. Attempting refresh...');
      const refreshResponse = await fetch('/rentals/api/v1/users/refresh/', {
        method: 'GET',
        credentials: 'include'
      });

      if (!refreshResponse.ok) {
        console.warn('Refresh failed. Redirecting to login.');
        window.location.href = '/rentals/user/login/';
        return;
      }

      const refreshData = await refreshResponse.json();
      const newAccess = refreshData.access;
      window.sessionStorage.setItem('access_token', newAccess);

      options.headers['Authorization'] = 'Bearer ' + newAccess;
      response = await fetch(url, options);
    }

    return response;
  }

  // Fetch account details and populate the form
  (async function () {
    const form = document.getElementById('account-update-form');
    if (!form) return;

    try {
      const response = await authFetch('/rentals/api/v1/users/me/', { method: 'GET' });
      if (!response || !response.ok)
        throw new Error(`Error fetching user data: ${response?.status} ${response?.statusText}`);

      const data = await response.json();

      ['username', 'email', 'first_name', 'last_name', 'phone', 'address'].forEach(field => {
        let input = null;
        if (field === 'username') input = form.querySelector('#current-username');
        if (!input) input = form.querySelector(`[name="${field}"]`);
        if (input) {
          if (field === 'phone') input.value = data.profile ? data.profile.phone_number : '';
          else if (field === 'address') input.value = data.profile ? data.profile.address : '';
          else if (data[field] !== undefined) input.value = data[field];
        }
      });
    } catch (error) {
      console.error('Failed to load account details:', error);
    }
  })();

  // Building create/edit modal handling
  (function(){
    const openBtn = document.getElementById('open-create-modal');
    const buildingModalEl = document.getElementById('buildingModal');
    const buildingForm = document.getElementById('building-form');
    const useDeviceBtn = document.getElementById('use-device-location');
    
    function clearForm(){
      if (!buildingForm) return;
      buildingForm.reset();
      const idEl = document.getElementById('building-id'); if (idEl) idEl.value = '';
    }

    const BuildingModalController = (function() {
        if (!buildingModalEl) return { show: () => {}, hide: () => {} };
        let closeHandlersAttached = false;
        let backdrop = null;

        function attachCloseHandlers() {
            if (closeHandlersAttached) return;
            const closeButtons = buildingModalEl.querySelectorAll('[data-bs-dismiss], .btn-close');
            closeButtons.forEach(btn => btn.addEventListener('click', BuildingModalController.hide));
            
            document.addEventListener('keydown', function onEsc(e){ 
                if (e.key === 'Escape') BuildingModalController.hide(); 
            });
            closeHandlersAttached = true;
        }

        function createBackdrop() {
            if (backdrop) return;
            backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show fallback';
            document.body.appendChild(backdrop);
            backdrop.addEventListener('click', BuildingModalController.hide);
        }

        function removeBackdrop() {
            if (backdrop && backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
                backdrop = null;
            }
        }
        
        function show() {
            buildingModalEl.classList.add('show');
            buildingModalEl.style.display = 'block';
            buildingModalEl.setAttribute('aria-modal','true');
            buildingModalEl.removeAttribute('aria-hidden');

            createBackdrop();
            document.body.classList.add('modal-open');
            attachCloseHandlers();
        }

        function hide() {
            buildingModalEl.classList.remove('show');
            buildingModalEl.style.display = 'none';
            buildingModalEl.setAttribute('aria-hidden','true');
            
            removeBackdrop();
            document.body.classList.remove('modal-open');
        }

        return { show, hide };
    })();

    if (openBtn){
        openBtn.addEventListener('click', function(e){
            e.preventDefault();
            clearForm();
            BuildingModalController.show();
        });
    }

    if (useDeviceBtn){
        useDeviceBtn.addEventListener('click', function(){
            if (!navigator.geolocation) return alert('Geolocation not supported by your browser');
            navigator.geolocation.getCurrentPosition(function(pos){
                const lat = pos.coords.latitude.toFixed(6);
                const lon = pos.coords.longitude.toFixed(6);
                const coordsEl = document.getElementById('b-coords');
                if (coordsEl) coordsEl.value = `${lat}, ${lon}`;
            }, function(err){
                alert('Unable to fetch device location: ' + (err && err.message ? err.message : 'unknown'));
            });
        });
    }

    // shared prefill function for update (used by onUpdate callback)
    function prefillFeature(f){
      if(!f) return;
      const p = f.properties || {};
      const idEl = document.getElementById('building-id');
      if (idEl) idEl.value = p.id || p.pk || '';
      const set = (sel, v) => { const el = document.getElementById(sel); if(el) el.value = v || ''; };
      set('b-title', p.title);
      set('b-address', p.address);
      set('b-district', p.district);
      set('b-price', p.rental_price);
      set('b-bedrooms', p.num_bedrooms);
      set('b-bathrooms', p.num_bathrooms);
      set('b-sqft', p.square_footage);
      set('b-amenities', Array.isArray(p.amenities) ? p.amenities.join(', ') : (typeof p.amenities === 'string' ? p.amenities : ''));
      set('b-contact', p.owner_contact);
      set('b-description', p.description);
      if(p.location && typeof p.location === 'string'){
        set('b-coords', p.location);
      } else if (f.geometry && f.geometry.coordinates){
        set('b-coords', `${f.geometry.coordinates[1]}, ${f.geometry.coordinates[0]}`);
      }
      BuildingModalController.show();
    }

    // shared delete function for listings (used by onDelete callback)
    async function deleteFeature(f){
      if(!f) return;
      const p = f.properties || {};
      const id = p.id || p.pk;
      
      if(!confirm('Delete this listing? This action cannot be undone.')) {
        return;
      }
      
      try {
        const resp = await authFetch(`/rentals/api/v1/buildings/${id}/`, { method: 'DELETE' });
        if (!resp.ok) {
          const err = await resp.json().catch(()=>null);
          alert('Failed to delete: ' + (err ? JSON.stringify(err) : resp.statusText));
          return;
        }
        alert('Building successfully deleted');
        const refreshBtn = document.getElementById('refresh-list');
        if (refreshBtn) refreshBtn.click();
      } catch (err) {
        console.error('Delete failed', err);
        alert('Network error: ' + String(err));
      }
    }

    // wire building listings for this account page (fetch user buildings)
    let listings = null;
    try {
      listings = window.RentalsListings.createListings({
        apiUrl: '/rentals/api/v1/users/me/buildings/',
        container: '#user-buildings-list',
        pagination: '#listing-pagination',
        fetcher: authFetch,
        onShow: function(f){
          // redirect to map page with highlight query param (attempt id first, else lat,lng)
          const props = f.properties || {};
          const id = props.id || props.pk;
          if(id) return window.location.href = `/rentals/?highlight=${id}`;
        },
        onUpdate: function(f){ prefillFeature(f); },
        onDelete: function(f){ deleteFeature(f); }
      });
      // wire refresh button
      const refreshBtn = document.getElementById('refresh-list'); if (refreshBtn) refreshBtn.addEventListener('click', function(e){ e.preventDefault(); if(listings) listings.refresh(); });
      // initial load
      if (listings) listings.fetchPage(1);
    } catch (e) { console.warn('Listings init failed', e); }

    if (buildingForm){
        buildingForm.addEventListener('submit', async function(e){
            e.preventDefault();

            // Gather and validate fields
            const title = buildingForm.querySelector('#b-title')?.value.trim() || '';
            const address = buildingForm.querySelector('#b-address')?.value.trim() || '';
            const district = buildingForm.querySelector('#b-district')?.value.trim() || '';
            const rental_price = buildingForm.querySelector('#b-price')?.value || '';
            const num_bedrooms = buildingForm.querySelector('#b-bedrooms')?.value || '';
            const num_bathrooms = buildingForm.querySelector('#b-bathrooms')?.value || '';
            const square_meters = buildingForm.querySelector('#b-sqft')?.value || '';
            const amenitiesRaw = buildingForm.querySelector('#b-amenities')?.value || '';
            const owner_contact = buildingForm.querySelector('#b-contact')?.value || '';
            const description = buildingForm.querySelector('#b-description')?.value.trim() || '';
            const locationRaw = buildingForm.querySelector('#b-coords')?.value.trim() || '';
            const imageInput = buildingForm.querySelector('#b-image');
            const imageFile = imageInput?.files[0] || null;

            if (!address) return alert('Address is required');
            if (!locationRaw) return alert('Location is required');
            if (!rental_price) return alert('Rental price is required');

            if (title.length > 150) return alert('Title must not exceed 150 characters.');
            if (description.length > 500) return alert('Description must not exceed 500 characters.');

            const amenities = amenitiesRaw.split(',').map(a=>a.trim()).filter(a=>a.length>0);

            const coords = locationRaw.split(',').map(c=>c.trim());
            if (coords.length !==2 || isNaN(coords[0]) || isNaN(coords[1])) 
                return alert('Location must be in format "latitude, longitude"');

            if (imageFile){
                if (!imageFile.type.startsWith('image/')) return alert('Uploaded file must be an image.');
                if (imageFile.size > 2*1024*1024) return alert('Image size must not exceed 2 MB.');
            }

            const formData = new FormData();
            if (title) formData.append('title', title);
            formData.append('address', address);
            if (district) formData.append('district', district);
            formData.append('rental_price', rental_price);
            if (num_bedrooms) formData.append('num_bedrooms', num_bedrooms);
            if (num_bathrooms) formData.append('num_bathrooms', num_bathrooms);
            if (square_meters) formData.append('square_meters', square_meters);
            if (amenities.length) formData.append('amenities', JSON.stringify(amenities));
            if (owner_contact) formData.append('owner_contact', owner_contact);
            if (description) formData.append('description', description);
            formData.append('location', `${parseFloat(coords[0])},${parseFloat(coords[1])}`);
            if (imageFile) formData.append('image', imageFile);

            try {
                const buildingId = document.getElementById('building-id')?.value || null;
                if (buildingId){
                  // update existing building
                  const url = `/rentals/api/v1/buildings/${buildingId}/`;
                  const response = await authFetch(url, { method: 'PATCH', body: formData });
                  if (!response.ok){
                    const err = await response.json().catch(()=>null);
                    alert('Failed to update listing: ' + (err ? JSON.stringify(err) : response.statusText));
                    return;
                  }
                } else {
                  // create new building
                  const response = await authFetch('/rentals/api/v1/buildings/', { method: 'PUT', body: formData });
                  if (!response.ok){
                    const err = await response.json().catch(()=>null);
                    alert('Failed to create listing: ' + (err ? JSON.stringify(err) : response.statusText));
                    return;
                  }
                }

                BuildingModalController.hide();
                const refreshBtn = document.getElementById('refresh-list');
                if (refreshBtn) refreshBtn.click();

            } catch (err){
                console.error('Failed to submit building:', err);
                alert('Network error creating/updating listing: ' + String(err));
            }
        });
    }
})();

//Listings

})();
