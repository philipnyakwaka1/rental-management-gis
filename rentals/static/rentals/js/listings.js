// listings.js — reusable listing + pagination renderer
(function(){
  'use strict';

  // Helper to escape HTML
  function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

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
      const items = (data.results || []).map(parseBuildingItem).filter(Boolean).map(normalizeFeature);
      renderListings(items);
      renderPagination();
    }

    function normalizeFeature(obj){
      // If object is Feature already, return as-is
      if(obj && obj.type === 'Feature') return obj;
      // else construct a feature from properties
      const props = obj || {};
      const coords = (props.location && typeof props.location === 'string') ? props.location.split(',').map(s=>parseFloat(s.trim())) : null;
      const geometry = coords && coords.length===2 ? { type: 'Point', coordinates: [coords[1], coords[0]] } : (props.geometry || null);
      return { type: 'Feature', geometry: geometry, properties: props };
    }

    function renderListings(features){
      if(!container) return;
      container.innerHTML = '';
      features.forEach(f => {
        const p = f.properties || {};
        const card = document.createElement('div');
        card.className = 'card mb-2';
        card.style.minWidth = '0';
        const imgHtml = p.image ? `<img src="${escapeHtml(p.image)}" class="card-img-top img-fluid" style="object-fit:cover; height:180px;" alt="${escapeHtml(p.title||p.address||'Listing')}">` : '';
        const title = escapeHtml(p.title || p.address || 'Listing');
        const address = escapeHtml(p.address || '—');
        const phone = escapeHtml(p.owner_contact || (p.profile && p.profile.phone_number) || '—');
        const price = escapeHtml(p.rental_price || 'N/A');
        const district = escapeHtml(p.district || '—');
        const specs = `${p.num_bedrooms||0} + ${p.num_bathrooms||0}`;

        const descId = `desc-${Math.random().toString(36).slice(2,9)}`;

        card.innerHTML = `
          ${imgHtml}
          <div class="card-body p-2">
            <h6 class="card-title mb-1">${title}</h6>
            <p class="mb-1 text-muted small">${address}</p>
            <p class="mb-1"><strong>Price:</strong> ${price} &middot; <strong>District:</strong> ${district}</p>
            <p class="mb-1"><strong>Specs:</strong> ${escapeHtml(specs)}</p>
            <p class="mb-1"><strong>Owner:</strong> ${phone}</p>
            <div class="d-flex gap-2 mt-2">
              <button class="btn btn-sm btn-outline-primary btn-show">Show</button>
              ${ onUpdate ? '<button class="btn btn-sm btn-outline-secondary btn-update">Update</button>' : '' }
              <button class="btn btn-sm btn-link btn-details" data-bs-toggle="collapse" data-bs-target="#${descId}">Details</button>
            </div>
            <div class="collapse mt-2" id="${descId}">
              <div class="card card-body p-2 small">
                <div><strong>Description</strong></div>
                <div>${escapeHtml(p.description || '')}</div>
                <hr/>
                <div><strong>Attributes</strong></div>
                <div>Title: ${escapeHtml(p.title||'')}</div>
                <div>Owner: ${phone}</div>
                <div>Amenities: ${escapeHtml(typeof p.amenities === 'string' ? p.amenities : (Array.isArray(p.amenities)? p.amenities.join(', '): ''))}</div>
              </div>
            </div>
          </div>
        `;

        // attach handlers
        const showBtn = card.querySelector('.btn-show');
        showBtn.addEventListener('click', ()=> onShow(f));
        if(onUpdate){
          const upd = card.querySelector('.btn-update');
          if(upd) upd.addEventListener('click', ()=> onUpdate(f));
        }

        container.appendChild(card);
      });
    }

    function renderPagination(){
      if(!pagination) return;
      pagination.innerHTML = '';
      const prevLi = document.createElement('li'); prevLi.className='page-item'+(pagePrev? '':' disabled');
      prevLi.innerHTML = `<a class="page-link" href="#">Prev</a>`;
      prevLi.addEventListener('click', (e)=>{ e.preventDefault(); if(pagePrev) fetchPage(currentPage-1); });
      pagination.appendChild(prevLi);

      const curLi = document.createElement('li'); curLi.className='page-item active'; curLi.innerHTML = `<span class="page-link">${currentPage}</span>`;
      pagination.appendChild(curLi);

      const nextLi = document.createElement('li'); nextLi.className='page-item'+(pageNext? '':' disabled');
      nextLi.innerHTML = `<a class="page-link" href="#">Next</a>`;
      nextLi.addEventListener('click', (e)=>{ e.preventDefault(); if(pageNext) fetchPage(currentPage+1); });
      pagination.appendChild(nextLi);
    }

    return { fetchPage, refresh: () => fetchPage(1) };
  }

  window.RentalsListings = { createListings };
})();
