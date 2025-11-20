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

  // Fetch account details and populate the form
(async function () {
  const form = document.getElementById('account-update-form');
  if (!form) return;

  // Reusable authenticated fetch with auto-refresh
  async function authFetch(url, options = {}) {
    const accessToken = window.sessionStorage.getItem('access_token');

    options.headers = {
      ...(options.headers || {}),
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken
    };

    let response = await fetch(url, options);

    // If access token expired → attempt refresh
    if (response.status === 401) {
      console.warn('Access token expired. Attempting refresh...');

      const refreshResponse = await fetch('/rentals/api/v1/users/refresh-token/', {
        method: 'GET',
        credentials: 'include' // send refresh cookie
      });

      if (!refreshResponse.ok) {
        console.warn('Refresh failed. Redirecting to login.');
        window.location.href = '/rentals/user/login/';
        return;
      }

      // Save new access token
      const refreshData = await refreshResponse.json();
      const newAccess = refreshData.access;
      window.sessionStorage.setItem('access_token', newAccess);

      // Retry original request with new token
      options.headers['Authorization'] = 'Bearer ' + newAccess;
      response = await fetch(url, options);
    }

    return response;
  }

  try {
    // Use the authFetch wrapper
    const response = await authFetch('/rentals/api/v1/users/me/', { method: 'GET' });
    if (!response || !response.ok)
      throw new Error(`Error fetching user data: ${response?.status} ${response?.statusText}`);

    const data = await response.json();

    // Populate form fields
    ['username', 'email', 'first_name', 'last_name', 'phone', 'address'].forEach(field => {
      let input = null;

      // username is stored in special field #current-username
      if (field === 'username') {
        input = form.querySelector('#current-username');
      }

      if (!input) {
        input = form.querySelector(`[name="${field}"]`);
      }

      // Populate only if exists
      if (input) {
        if (field === 'phone') {
          input.value = data.profile ? data.profile.phone_number : '';
        } else if (field === 'address') {
          input.value = data.profile ? data.profile.address : '';
        } else if (data[field] !== undefined) {
          input.value = data[field];
        }
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
            // Optionally, allow clicking the backdrop to close the modal
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

    // wire open button to use the modal controller
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

    if (buildingForm){
        buildingForm.addEventListener('submit', async function(e){
            e.preventDefault();
            // Validate required fields
            const address = document.getElementById('b-address').value.trim();
            const location = document.getElementById('b-coords').value.trim();
            const rentalPriceEl = document.getElementById('b-price');
            const rental_price = rentalPriceEl ? rentalPriceEl.value.trim() : '';
            if (!address) return alert('Address is required');
            if (!location) return alert('Location is required');
            if (!rental_price) return alert('Rental price is required');

            // Validate location format: lat, long
            const coords = location.replace(/\s+/g,'').split(',');
            if (coords.length !== 2 || isNaN(Number(coords[0])) || isNaN(Number(coords[1]))) return alert('Coordinates must be "lat, long"');

            // Validate image file (if provided): must be an image and <= 2MB
            const imageInput = document.getElementById('b-image');
            if (imageInput && imageInput.files && imageInput.files.length > 0) {
              const f = imageInput.files[0];
              const maxSize = 2 * 1024 * 1024; // 2MB
              if (f.size > maxSize) {
                return alert('Image size must not exceed 2 MB. Please choose a smaller image.');
              }
              if (f.type && !f.type.startsWith('image/')) {
                return alert('Selected file is not an image. Please choose an image file.');
              }
            }

            const formData = new FormData(buildingForm);
            // ensure the location field is passed as 'location' (already named)

            // append image file if present (already included by FormData automatically)

            try {
                const resp = await fetch('/rentals/api/v1/buildings/', {
                    method: 'PUT',
                    headers: {
                        'Authorization': 'Bearer ' + window.sessionStorage.getItem('access_token')
                    },
                    body: formData
                });
                if (!resp.ok){
                    const err = await resp.json().catch(()=>null);
                    alert('Failed to create listing: ' + (err ? JSON.stringify(err) : resp.statusText));
                    return;
                }
                // success
                BuildingModalController.hide(); // Refactored call
                // Refresh listing if refresh button exists
                const refreshBtn = document.getElementById('refresh-list'); if (refreshBtn) refreshBtn.click();
            } catch (err){
                alert('Network error creating listing: ' + String(err));
            }
        });
    }
})();
})();