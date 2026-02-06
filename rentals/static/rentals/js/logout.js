(function () {
  // Get CSRF token from cookie
  function getCsrfToken() {
    const name = 'csrftoken';
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  async function doLogout(e) {
    if (e) e.preventDefault();

    const token = window.sessionStorage.getItem('access_token');
    const csrfToken = getCsrfToken();

    try {
      await fetch('/rentals/api/v1/users/logout/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        }
      });
    } catch (err) {
      console.warn('Logout request failed, clearing client state anyway.');
    }

    // Wait a moment for server logout to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    window.sessionStorage.removeItem('access_token');
    window.sessionStorage.setItem('logout_message', 'You have been logged out.');
    window.location.href = '/rentals/';
  }

  document.addEventListener('click', function (e) {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;

    if (href.endsWith('/user/logout/') || href.endsWith('/user/logout')) {
      doLogout(e);
    }
  });
})();

