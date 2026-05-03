/**
 * Journal page: optional login badge + role-based home link.
 */
(function () {
  const userRaw = sessionStorage.getItem("user");
  let user = null;
  try {
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    user = null;
  }
  const badge = document.getElementById("loggedInBadge");
  const badgeUsername = document.getElementById("loggedInUsername");
  if (user && badge && badgeUsername) {
    badgeUsername.textContent = user.username;
    badge.style.display = "flex";
  }
  const shell = document.getElementById("shellUsername");
  if (shell && user) shell.textContent = user.username;
})();
