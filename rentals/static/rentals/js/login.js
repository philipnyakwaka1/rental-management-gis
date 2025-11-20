(function(){
  'use strict';

  // Utility: clear any existing alert
  function clearAlerts(){
    const existing = document.getElementById('alert-container');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  }

  // Utility: show an alert. Prefers an element with id "parent", falls back to <main> or document.body.
  function showAlert(message, type='danger'){
    clearAlerts();
    const parentEl = document.querySelector('#parent') || document.querySelector('main') || document.body;
    const alertDiv = document.createElement('div');
    alertDiv.id = 'alert-container';
    alertDiv.className = `alert alert-${type}`;
    alertDiv.setAttribute('role','alert');
    alertDiv.innerHTML = message;
    parentEl.prepend(alertDiv);
  }

  // Main handler
  const form = document.querySelector('form');
  if (!form) return;

  form.addEventListener('submit', async function(evt){
    evt.preventDefault();
    clearAlerts();

    const formData = new FormData(form);
    const payload = {
      username: formData.get('username') || '',
      password: formData.get('password') || ''
    };

    if (!payload.username || !payload.password){
      showAlert('Please enter both username and password.', 'danger');
      return;
    }

    // Build headers; include CSRF token when present
    const headers = { 'Content-Type': 'application/json' };
    const csrfInput = form.querySelector('input[name="csrfmiddlewaretoken"]');
    if (csrfInput && csrfInput.value) headers['X-CSRFToken'] = csrfInput.value;

    try {
      const resp = await fetch(form.action, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!resp.ok){
        let msg = 'Login failed. Please check your username and password and try again.';
        showAlert(msg, 'danger');
        return;
      }

      const data = await resp.json().catch(()=>null);
      if (data && data.access){
        sessionStorage.setItem('access_token', data.access);
        // Redirect to account page
        window.location.href = '/rentals/user/account/';
      } else {
        showAlert('Unexpected response from server. Please try again later.', 'danger');
      }
    } catch (err){
      showAlert('Network error: ' + (err && err.message ? err.message : String(err)), 'danger');
    }
  });
})();
