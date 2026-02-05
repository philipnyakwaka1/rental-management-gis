// listings.js — reusable listing + pagination renderer
(function(){
  'use strict';

  function parseBuildingItem(item){
    try{
      if(typeof item === 'string'){
        return JSON.parse(item);
      }
      return item;
    }catch(e){ return null; }
  }

  // Create listings instance
  // options: { apiUrl, container (el or selector), pagination (el or selector), fetcher (fn(url,opts)), onShow(feature), onUpdate(feature) }
  function createListings(options){
    const apiUrl = options.apiUrl;
    const container = typeof options.container === 'string' ? document.querySelector(options.container) : options.container;
    const pagination = typeof options.pagination === 'string' ? document.querySelector(options.pagination) : options.pagination;
    const fetcher = options.fetcher || fetch;
    const onShow = options.onShow || function(){}, onUpdate = options.onUpdate || null;

    let currentPage = 1, pageNext = null, pagePrev = null;

    async function fetchPage(page=1){
      currentPage = page;
      const url = apiUrl + (apiUrl.indexOf('?')>-1 ? '&' : '?') + 'page=' + page;
      const resp = await fetcher(url, { method: 'GET' });
      if(!resp || !resp.ok){ console.error('Failed to fetch listings', resp && resp.status); return; }
      const data = await resp.json();
      pageNext = data.next; pagePrev = data.previous;
      const items = (data.results || []).map(parseBuildingItem).filter(Boolean);
      renderListings(items);
      renderPagination();
    }

    function renderListings(features){
      if(!container) return;
      container.innerHTML = '';
      features.forEach(f => {
        const feature = (f && f.features && Array.isArray(f.features) && f.features[0]) ? f.features[0] : f;
        const p = (feature && feature.properties) ? feature.properties : {};
        const card = document.createElement('div');
        card.className = 'card mb-2';
        card.style.minWidth = '0';
        const imgHtml = p.image ? `<img src="/media/${window.RentalsSharedUtils.escapeHtml(p.image)}" class="card-img-top img-fluid" style="object-fit:cover; height:180px;" alt="${window.RentalsSharedUtils.escapeHtml(p.title||p.address||'Listing')}">` : '';
        const title = window.RentalsSharedUtils.escapeHtml(p.title || '');
        const titleHtml = title ? `<h6 class="card-title mb-1">${title}</h6>` : '';
        const address = window.RentalsSharedUtils.escapeHtml(p.address || '—');
        const phone = window.RentalsSharedUtils.escapeHtml(p.owner_contact || (p.profile && p.profile.phone_number) || '—');
        const price = window.RentalsSharedUtils.escapeHtml(p.rental_price || 'N/A');
        const district = window.RentalsSharedUtils.escapeHtml(p.district || '—');
        const hasBedrooms = p.num_bedrooms !== undefined && p.num_bedrooms !== null && p.num_bedrooms !== '';
        const hasBathrooms = p.num_bathrooms !== undefined && p.num_bathrooms !== null && p.num_bathrooms !== '';
        const bedrooms = hasBedrooms ? window.RentalsSharedUtils.escapeHtml(p.num_bedrooms) : '';
        const bathrooms = hasBathrooms ? window.RentalsSharedUtils.escapeHtml(p.num_bathrooms) : '';
        const bedroomsHtml = hasBedrooms ? `<p class="mb-1 text-muted small">Bedrooms: ${bedrooms}</p>` : '';
        const bathroomsHtml = hasBathrooms ? `<p class="mb-1 text-muted small">Bathrooms: ${bathrooms}</p>` : '';

        // Check for description and amenities
        const hasDescription = p.description && p.description.trim();
        const hasAmenities = p.amenities && (Array.isArray(p.amenities) ? p.amenities.length > 0 : typeof p.amenities === 'string' && p.amenities.trim());
        const hasNearbyPois = p.nearby_pois && Object.keys(p.nearby_pois).length > 0;

        // Build details content only if there's content to show
        let detailsContent = '';
        if (hasDescription || hasAmenities || hasNearbyPois) {
          detailsContent = '<div class="card card-body p-2 small">';
          
          if (hasDescription) {
            detailsContent += `<div><strong>Description</strong></div><div class="mb-2">${window.RentalsSharedUtils.escapeHtml(p.description)}</div>`;
          }
          
          if (hasAmenities) {
            const amenitiesStr = Array.isArray(p.amenities) ? p.amenities.join(', ') : p.amenities;
            detailsContent += `<div><strong>Amenities:</strong> ${window.RentalsSharedUtils.escapeHtml(amenitiesStr)}</div>`;
          }
          
          if (hasNearbyPois) {
            if (hasDescription || hasAmenities) {
              detailsContent += '<hr/>';
            }
            
            if (p.nearby_pois.shops && p.nearby_pois.shops.length > 0) {
              detailsContent += '<div class="mb-2"><strong>Shops nearby:</strong><ul class="list-unstyled ms-3 small">';
              p.nearby_pois.shops.forEach(shop => {
                detailsContent += `<li>${window.RentalsSharedUtils.escapeHtml(shop.name)} (${window.RentalsSharedUtils.escapeHtml(shop.category)}): ${shop.distance_m}m away</li>`;
              });
              detailsContent += '</ul></div>';
            }
            
            if (p.nearby_pois.routes && p.nearby_pois.routes.length > 0) {
              detailsContent += '<div class="mb-2"><strong>Routes nearby:</strong><ul class="list-unstyled ms-3 small">';
              p.nearby_pois.routes.forEach(route => {
                detailsContent += `<li>${window.RentalsSharedUtils.escapeHtml(route.name)}: ${route.distance_m}m away</li>`;
              });
              detailsContent += '</ul></div>';
            }
            
            if (p.nearby_pois.bus_stops && p.nearby_pois.bus_stops.length > 0) {
              detailsContent += '<div class="mb-2"><strong>Bus stops nearby:</strong><ul class="list-unstyled ms-3 small">';
              p.nearby_pois.bus_stops.forEach(stop => {
                detailsContent += `<li>${window.RentalsSharedUtils.escapeHtml(stop.name)}: ${stop.distance_m}m away</li>`;
              });
              detailsContent += '</ul></div>';
            }
          }
          
          detailsContent += '</div>';
        }

        const descId = `desc-${Math.random().toString(36).slice(2,9)}`;
        const detailsBtn = hasDescription || hasAmenities || hasNearbyPois ? `<button class="btn btn-sm btn-outline-secondary btn-details d-flex align-items-center gap-1 ms-auto" data-bs-toggle="collapse" data-bs-target="#${descId}" aria-expanded="false">Details<i class="bi bi-chevron-down"></i></button>` : '';

        card.innerHTML = `
          ${imgHtml}
          <div class="card-body p-2">
            ${titleHtml}
            <p class="mb-1 fw-semibold small"> Address: ${address}</p>
            <p class="mb-1 text-muted small">Price (USD): ${price}</p>
            <p class="mb-1 text-muted small">Location (district): ${district}</p>
            ${bedroomsHtml}
            ${bathroomsHtml}
            <p class="mb-1 text-muted small">Owner's Contact: ${phone}</p>
              <div class="d-flex gap-2 mt-2">
              <button class="btn btn-sm btn-outline-primary btn-show">Show</button>
              ${ onUpdate ? '<button class="btn btn-sm btn-outline-secondary btn-update">Update</button>' : '' }
              ${ options.onDelete ? '<button class="btn btn-sm btn-outline-danger btn-delete">Delete</button>' : '' }
              ${detailsBtn}
            </div>
            ${detailsContent ? `<div class="collapse mt-2" id="${descId}">${detailsContent}</div>` : ''}
          </div>
        `;

        // store feature on the DOM node for convenience
        try { card.__feature = feature; } catch (e) {}

        // show button handler
        const showBtn = card.querySelector('.btn-show');
        showBtn.addEventListener('click', ()=> onShow(feature));

        // update button handler
        const updBtn = card.querySelector('.btn-update');
        if (updBtn) {
          updBtn.addEventListener('click', ()=> onUpdate(feature));
        }
        
        // delete handler
        const delBtn = card.querySelector('.btn-delete');
        if (delBtn) {
          delBtn.addEventListener('click', ()=> options.onDelete(feature));
        }

        container.appendChild(card);
      });
    }

    function renderPagination(){
      if(!pagination) return;
      // Ensure we have a UL with Bootstrap pagination classes
      let ul = null;
      if(pagination.tagName === 'UL' || pagination.classList.contains('pagination')){
        ul = pagination.tagName === 'UL' ? pagination : pagination.querySelector('ul') || pagination;
        ul.innerHTML = '';
      } else {
        // create UL inside the pagination container (useful when pagination is a <nav>)
        pagination.innerHTML = '';
        ul = document.createElement('ul');
        ul.className = 'pagination pagination-sm';
        pagination.appendChild(ul);
      }

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

    return { fetchPage, refresh: () => fetchPage(1) };
  }

  window.RentalsListings = { createListings };
})();
