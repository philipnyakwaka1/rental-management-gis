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
        const imgHtml = p.image ? `<img src="/media/${escapeHtml(p.image)}" class="card-img-top img-fluid" style="object-fit:cover; height:180px;" alt="${escapeHtml(p.title||p.address||'Listing')}">` : '';
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
            <p class="mb-1">Price (USD): ${price}</p>
            <p class="mb-1">Location: ${district}</p>
            <p class="mb-1">Specs: ${escapeHtml(specs)}</p>
            <p class="mb-1">Owner's Contact: ${phone}</p>
              <div class="d-flex gap-2 mt-2">
              <button class="btn btn-sm btn-outline-primary btn-show">Show</button>
              ${ onUpdate ? '<button class="btn btn-sm btn-outline-secondary btn-update">Update</button>' : '' }
              ${ options.onDelete ? '<button class="btn btn-sm btn-outline-danger btn-delete">Delete</button>' : '' }
              <button class="btn btn-sm btn-link btn-details" data-bs-toggle="collapse" data-bs-target="#${descId}">Details</button>
            </div>
            <div class="collapse mt-2" id="${descId}">
              <div class="card card-body p-2 small">
                <div>Description</div>
                <div>${escapeHtml(p.description || '')}</div>
                <hr/>
                <div>Amenities: ${escapeHtml(typeof p.amenities === 'string' ? p.amenities : (Array.isArray(p.amenities)? p.amenities.join(', '): ''))}</div>
              </div>
            </div>
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
          delBtn.addEventListener('click', ()=> options.onDelete(feature, card));
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
