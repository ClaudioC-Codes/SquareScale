/**
 * Shared script for regular-user-home, manager-home, admin-home, etc.
 * Ensures user is in sessionStorage (else redirect to login), shows username in badge.
 * Sign out uses the Log out control in app-shell.js.
 */
(function () {
  const userJson = sessionStorage.getItem("user");
  if (!userJson) {
    window.location.href = "index.html";
    return;
  }
  const user = JSON.parse(userJson);

  const badge = document.getElementById("loggedInBadge");
  const badgeUsername = document.getElementById("loggedInUsername");
  if (badge && badgeUsername) {
    badgeUsername.textContent = user.username;
    badge.style.display = "flex";
  }

  const shellUsername = document.getElementById("shellUsername");
  if (shellUsername) {
    shellUsername.textContent = user.username;
  }
})();
