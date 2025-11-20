(function(){
  async function doLogout(e){
    if (e) e.preventDefault();
    const token = window.localStorage.getItem('access_token');
    try {
      // attempt to call API logout so server can clear refresh cookie if present
      await fetch('/rentals/api/v1/users/logout/', { method: 'GET', headers: token ? {'Authorization':'Bearer '+token} : {} });
    } catch (err) {
      // ignore network errors, continue clearing client state
    }
    window.localStorage.removeItem('access_token');
    window.localStorage.setItem('logout_message', 'You have been logged out.');
    // redirect to map root
    window.location.href = '/';
  }

  // attach to any logout link that matches the path
  document.addEventListener('click', function(e){
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    if (href.endsWith('/user/logout/') || href.endsWith('/user/logout')) {
      doLogout(e);
    }
  });
})();
