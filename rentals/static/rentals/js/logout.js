(function () {
  async function doLogout(e) {
    if (e) e.preventDefault();

    const token = window.sessionStorage.getItem('access_token')

    try {
      await fetch('/rentals/api/v1/users/logout/', {
        method: 'GET',
        credentials: 'include',
        headers: token
          ? { 'Authorization': 'Bearer ' + token }
          : {}
      });
    } catch (err) {
      console.warn('Logout request failed, clearing client state anyway.');
    }

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

