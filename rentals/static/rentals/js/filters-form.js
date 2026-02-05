document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('filters-form');
    if(!form) return;

    const districtSelect = form.querySelector('select[name="district"]');
    const priceMin = form.querySelector('input[name="price_min"]');
    const priceMax = form.querySelector('input[name="price_max"]');
    const poiFiltersContainer = document.getElementById('poi-filters-container');
    const addPoiFilterBtn = document.getElementById('add-poi-filter');
    const resetBtn = form.querySelector('button[type="reset"]');

    // Check if required elements exist
    if (!poiFiltersContainer || !addPoiFilterBtn) {
        console.error('Required POI filter elements not found');
        return;
    }

    const MAX_POI_FILTERS = 3; // shops, bus_stop, route
    const POI_OPTIONS = [
        { value: 'bus_stop', label: 'Bus stop' },
        { value: 'shops', label: 'Shopping' },
        { value: 'route', label: 'Route' }
    ];

    let filterCount = 0;

    // Create a single POI filter entry
    function createPoiFilterEntry() {
        const filterId = `poi-filter-${Date.now()}`;
        const div = document.createElement('div');
        div.className = 'poi-filter-entry mb-2 d-flex gap-2 align-items-center';
        div.dataset.filterId = filterId;

        const selectWrapper = document.createElement('div');
        selectWrapper.className = 'flex-grow-1';
        
        const select = document.createElement('select');
        select.className = 'form-select form-select-sm';
        select.name = 'poi_type';
        select.innerHTML = '<option value="">Select type...</option>';
        
        POI_OPTIONS.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });
        
        selectWrapper.appendChild(select);

        const input = document.createElement('input');
        input.type = 'number';
        input.name = 'poi_radius';
        input.className = 'form-control form-control-sm';
        input.placeholder = 'Radius (m)';
        input.min = '1';
        input.style.width = '120px';
        input.disabled = true;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-sm btn-outline-danger';
        removeBtn.innerHTML = '&times;';
        removeBtn.style.width = '32px';
        removeBtn.addEventListener('click', () => {
            div.remove();
            filterCount--;
            updateAddButtonState();
        });

        select.addEventListener('change', () => {
            if (select.value) {
                input.disabled = false;
                if (!input.value) input.value = '500';
            } else {
                input.disabled = true;
                input.value = '';
            }
            updateAddButtonState();
        });

        div.appendChild(selectWrapper);
        div.appendChild(input);
        div.appendChild(removeBtn);

        return div;
    }

    // Check which POI types are already selected
    function getSelectedPoiTypes() {
        const selects = poiFiltersContainer.querySelectorAll('select[name="poi_type"]');
        return Array.from(selects).map(s => s.value).filter(v => v);
    }

    // Update add button state
    function updateAddButtonState() {
        const selectedTypes = getSelectedPoiTypes();
        if (filterCount >= MAX_POI_FILTERS || selectedTypes.length >= POI_OPTIONS.length) {
            addPoiFilterBtn.disabled = true;
        } else {
            addPoiFilterBtn.disabled = false;
        }
    }

    // Add filter handler
    addPoiFilterBtn.addEventListener('click', () => {
        if (filterCount < MAX_POI_FILTERS) {
            const entry = createPoiFilterEntry();
            poiFiltersContainer.appendChild(entry);
            filterCount++;
            updateAddButtonState();
        }
    });

    // Form validation
    form.addEventListener('submit', (e) => {
        const entries = poiFiltersContainer.querySelectorAll('.poi-filter-entry');
        let hasError = false;

        entries.forEach(entry => {
            const select = entry.querySelector('select[name="poi_type"]');
            const input = entry.querySelector('input[name="poi_radius"]');
            
            if (select.value && (!input.value || isNaN(input.value) || input.value <= 0)) {
                hasError = true;
            }
        });

        if (hasError) {
            e.preventDefault();
            alert('Please enter a valid radius for all selected POI filters.');
            return false;
        }
    });

    // Reset handler
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (districtSelect) districtSelect.value = '';
            if (priceMin) priceMin.value = '';
            if (priceMax) priceMax.value = '';
            poiFiltersContainer.innerHTML = '';
            filterCount = 0;
            updateAddButtonState();
        });
    }
    
    // Initialize with one filter
    addPoiFilterBtn.click();
});