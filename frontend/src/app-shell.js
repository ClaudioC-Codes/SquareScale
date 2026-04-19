
(function () {
  if (!document.body || !document.body.classList.contains("has-app-shell")) {
    return;
  }

  const userRaw = sessionStorage.getItem("user");
  let user = null;
  try {
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    user = null;
  }
  const role = user ? String(user.role || "").toUpperCase() : "";
  const isAdmin = role === "ADMIN";
  const isStaff = isAdmin || role === "MANAGER" || role === "USER";
  const isLoggedIn = !!user;

  let homeHref = "index.html";
  if (isLoggedIn) {
    if (isAdmin) homeHref = "admin-home.html";
    else if (role === "MANAGER") homeHref = "manager-home.html";
    else homeHref = "regular-user-home.html";
  }

  const navAccountsAndLog =
    isStaff ?
      `<a href="admin-accounts.html" class="app-nav-link" title="View the chart of accounts (administrators can also add, edit, or deactivate)">Chart of Accounts</a>
       <a href="admin-event-log.html" class="app-nav-link" title="View audit trail of data changes">Event log</a>`
    : "";

  /** Journal is hidden on the login screen and other guest pages; shown after sign-in. */
  const navJournal = isLoggedIn
    ? `<a href="journal.html" class="app-nav-link" title="Record journal entries and view the general journal">Journal</a>`
    : "";

  const navLogout = isLoggedIn
    ? `<button type="button" class="app-nav-link app-nav-logout" id="shellLogoutBtn" title="Sign out and return to the login page">Log out</button>`
    : "";

  const shellHtml = `
<header class="app-top-bar" role="banner">
  <div class="app-top-left">
    <a href="${homeHref}" class="app-logo-link" title="Go to home dashboard">
      <img src="src/images/logo.png" alt="SquareScale" class="app-logo-small" width="44" height="44">
    </a>
    <span class="app-user-name" id="shellUsername" title="Currently signed-in user">${escapeHtml(user ? user.username : "Guest")}</span>
    <div class="app-calendar-wrap">
      <button type="button" class="app-calendar-btn" id="shellCalendarBtn" title="Open calendar — pick a date (reference only)" aria-expanded="false" aria-controls="shellCalendarPopover">📅</button>
      <div id="shellCalendarPopover" class="app-calendar-popover hidden" role="dialog" aria-label="Calendar">
        <label for="shellCalendarInput">Select date</label>
        <input type="date" id="shellCalendarInput" title="Choose a date">
      </div>
    </div>
  </div>
  <nav class="app-service-nav" aria-label="Application services">
    <a href="${homeHref}" class="app-nav-link" title="Return to your role home page">Home</a>
    ${navAccountsAndLog}
    ${navJournal}
    ${navLogout}
  </nav>
  <div class="app-top-right">
    <button type="button" class="btn-help" id="appHelpBtn" title="Open help topics for SquareScale">Help</button>
  </div>
</header>
<div id="appHelpModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="appHelpTitle">
  <div class="modal-content app-help-modal">
    <h3 id="appHelpTitle">SquareScale Help</h3>
    <div class="app-help-topics">
      <section>
        <h4>Getting started</h4>
        <p>Sign in from the login page. Your role (Administrator, Manager, or Regular User) determines which home page you see. Use <strong>Log out</strong> in the top bar to sign out.</p>
      </section>
      <section>
        <h4>Chart of accounts</h4>
        <p><strong>Administrators</strong> can add, edit, or deactivate accounts (service menu). <strong>Managers and regular users</strong> can view and search the chart, use filters, and open account ledgers. Account numbers are numeric and must start with 1–5.</p>
      </section>
      <section>
        <h4>Search &amp; filters</h4>
        <p>Use <strong>Quick search</strong> to find accounts by name or number. Refine the list with filters for name, number, category, balance range, and active status.</p>
      </section>
      <section>
        <h4>Ledgers</h4>
        <p>Click a row in the chart of accounts table to open that account’s ledger page. Journal postings will extend ledger detail in future updates.</p>
      </section>
      <section>
        <h4>Journal</h4>
        <p>The Journal area is for recording transactions. Full journalizing workflows may be expanded in later releases.</p>
      </section>
      <section>
        <h4>Event log</h4>
        <p>See account changes (create, update, deactivate) with the <strong>signed-in user</strong> who made each change (user ID and username), plus timestamp.</p>
      </section>
      <section>
        <h4>Security</h4>
        <p>Passwords must meet complexity rules on registration and admin-created users. Change passwords regularly.</p>
      </section>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-submit" id="appHelpClose" title="Close this help window">Close</button>
    </div>
  </div>
</div>`;

  document.body.insertAdjacentHTML("afterbegin", shellHtml);

  const logoutBtn = document.getElementById("shellLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      sessionStorage.removeItem("user");
      window.location.href = "index.html";
    });
  }

  const btn = document.getElementById("shellCalendarBtn");
  const pop = document.getElementById("shellCalendarPopover");
  const inp = document.getElementById("shellCalendarInput");
  if (btn && pop) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !pop.classList.contains("hidden");
      pop.classList.toggle("hidden", open);
      btn.setAttribute("aria-expanded", String(!open));
      if (!open && inp) {
        try {
          inp.showPicker();
        } catch {
          /* older browsers */
        }
      }
    });
    document.addEventListener("click", (e) => {
      if (!pop.contains(e.target) && e.target !== btn) {
        pop.classList.add("hidden");
        btn.setAttribute("aria-expanded", "false");
      }
    });
  }

  const helpBtn = document.getElementById("appHelpBtn");
  const helpModal = document.getElementById("appHelpModal");
  const helpClose = document.getElementById("appHelpClose");
  if (helpBtn && helpModal) {
    helpBtn.addEventListener("click", () => helpModal.classList.remove("hidden"));
  }
  if (helpClose && helpModal) {
    helpClose.addEventListener("click", () => helpModal.classList.add("hidden"));
  }
  if (helpModal) {
    helpModal.addEventListener("click", (e) => {
      if (e.target === helpModal) helpModal.classList.add("hidden");
    });
  }

  function escapeHtml(s) {
    if (s == null) return "";
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
})();
