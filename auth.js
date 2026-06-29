/* ============ Portia — auth guard ============ */
/* Include this script as early as possible in <head> on every protected page.
   Redirects to login.html immediately if no valid session flag is present. */

(function () {
  if (localStorage.getItem('portia_auth') !== 'true') {
    window.location.replace('login.html');
  }
})();
