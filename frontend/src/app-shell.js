/**
 * Shared top layout: logo + username (top-left), calendar popover, service nav, Help modal.
 * Add class "has-app-shell" to <body>. Place this script immediately after <body> opens, before main content.
 */
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
  const isStaff = isAdmin || role === "MANAGER" || role === "USER" || role === "ACCOUNTANT";
  const isManagerOrAdmin = isAdmin || role === "MANAGER";
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

  const navReports = isStaff
    ? `<a href="financial-reports.html" class="app-nav-link" title="Trial balance, balance sheet, income statement, retained earnings">Reports</a>`
    : "";

  const navLogout = isLoggedIn
    ? `<button type="button" class="app-nav-link app-nav-logout" id="shellLogoutBtn" title="Sign out and return to the login page">Log out</button>`
    : "";

  const notifyBellHtml =
    isLoggedIn && isManagerOrAdmin
      ? `<div class="app-notify-wrap">
    <button type="button" class="app-notify-btn" id="shellNotifyBtn" title="Notifications" aria-expanded="false" aria-controls="shellNotifyPanel">
      <span class="app-notify-icon" aria-hidden="true">\uD83D\uDD14</span>
      <span id="shellNotifyBadge" class="app-notify-badge hidden">0</span>
    </button>
    <div id="shellNotifyPanel" class="app-notify-panel hidden" role="menu" aria-label="Notifications"></div>
  </div>`
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
    ${navReports}
    ${navLogout}
  </nav>
  <div class="app-top-right">
    ${notifyBellHtml}
    <button type="button" class="btn-help" id="appHelpBtn" title="Open help topics for SquareScale">Help</button>
  </div>
</header>
<div id="appHelpModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="appHelpTitle">
  <div class="modal-content app-help-modal">
    <h3 id="appHelpTitle">SquareScale Help</h3>
    <div class="app-help-topics">
      <section>
        <h4>Getting started</h4>
        <p>Sign in from the login page. Your role (Administrator, Manager, Accountant, or Regular User) determines which home page you see. Use <strong>Log out</strong> in the top bar to sign out.</p>
      </section>
      <section>
        <h4>Chart of accounts</h4>
        <p><strong>Administrators</strong> can add, edit, or deactivate accounts (service menu). <strong>Managers, accountants, and regular users</strong> can view and search the chart, use filters, and open account ledgers. Account numbers are numeric and must start with 1–5.</p>
      </section>
      <section>
        <h4>Search &amp; filters</h4>
        <p>Use <strong>Quick search</strong> to find accounts by name or number. Refine the list with filters for name, number, category, balance range, and active status.</p>
      </section>
      <section>
        <h4>Ledgers</h4>
        <p>Click a row in the chart of accounts table to open that account’s ledger page. On the ledger page you can <strong>email a manager or administrator</strong> about that account (simulated delivery in the server log unless mail is configured).</p>
      </section>
      <section>
        <h4>Journal</h4>
        <p>The Journal area is for recording transactions. When an accountant submits an entry for approval, <strong>managers and administrators</strong> see a notification (bell in the top bar). Only managers and administrators can approve or reject.</p>
      </section>
      <section>
        <h4>Event log</h4>
        <p>See account changes (create, update, deactivate) with the <strong>account name</strong>, <strong>username</strong> of who made the change, and timestamp.</p>
      </section>
      <section>
        <h4>Financial reports</h4>
        <p>Open <strong>Reports</strong> for trial balance, balance sheet, income statement (from posted journals in the period), and retained earnings. Use <strong>Print</strong>, <strong>Save (JSON)</strong>, or <strong>Email</strong> from that page.</p>
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
  if (btn && pop) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willShow = pop.classList.contains("hidden");
      pop.classList.toggle("hidden", !willShow);
      btn.setAttribute("aria-expanded", String(willShow));
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

  const API_BASE_URL = "http://localhost:8080";
  const notifyBtn = document.getElementById("shellNotifyBtn");
  const notifyPanel = document.getElementById("shellNotifyPanel");
  const notifyBadge = document.getElementById("shellNotifyBadge");

  function updateNotifyBadge(n) {
    if (!notifyBadge) return;
    if (n > 0) {
      notifyBadge.textContent = n > 99 ? "99+" : String(n);
      notifyBadge.classList.remove("hidden");
    } else {
      notifyBadge.classList.add("hidden");
    }
  }

  async function fetchUnreadCount() {
    if (!user || user.userId == null) return;
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
        headers: { "X-User-Id": String(user.userId) },
      });
      if (!res.ok) return;
      const data = await res.json();
      updateNotifyBadge(Number(data.unread) || 0);
    } catch {
      /* ignore */
    }
  }

  async function loadNotifyList() {
    if (!notifyPanel || !user || user.userId == null) return;
    notifyPanel.innerHTML = "<p class=\"app-notify-loading\">Loading…</p>";
    try {
      const res = await fetch(`${API_BASE_URL}/notifications`, {
        headers: { "X-User-Id": String(user.userId) },
      });
      if (!res.ok) {
        notifyPanel.textContent = "Could not load notifications.";
        return;
      }
      const items = await res.json();
      if (!items.length) {
        notifyPanel.innerHTML = "<p class=\"app-notify-empty\">No notifications.</p>";
        return;
      }
      notifyPanel.innerHTML = "";
      items.forEach((it) => {
        const row = document.createElement("div");
        row.className = "app-notify-item" + (it.read ? " app-notify-read" : "");
        const uid = String(user.userId);
        if (it.journalEntryId) {
          const link = document.createElement("a");
          link.href = "journal-list.html?entryId=" + encodeURIComponent(it.journalEntryId);
          link.className = "app-notify-link";
          link.textContent = it.message || "";
          link.addEventListener("click", async (ev) => {
            ev.preventDefault();
            if (!it.read && it.id != null) {
              try {
                await fetch(`${API_BASE_URL}/notifications/${it.id}/read`, {
                  method: "POST",
                  headers: { "X-User-Id": uid },
                });
              } catch {
                /* ignore */
              }
            }
            window.location.href = link.href;
          });
          row.appendChild(link);
        } else {
          const span = document.createElement("span");
          span.textContent = it.message || "";
          row.appendChild(span);
        }
        notifyPanel.appendChild(row);
      });
    } catch {
      notifyPanel.textContent = "Could not reach server.";
    }
  }

  if (notifyBtn && notifyPanel && user && user.userId != null) {
    notifyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = notifyPanel.classList.contains("hidden");
      notifyPanel.classList.toggle("hidden", !willOpen);
      notifyBtn.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) loadNotifyList();
    });
    document.addEventListener("click", (e) => {
      if (!notifyPanel.contains(e.target) && e.target !== notifyBtn) {
        notifyPanel.classList.add("hidden");
        notifyBtn.setAttribute("aria-expanded", "false");
      }
    });
    fetchUnreadCount();
    setInterval(fetchUnreadCount, 60000);
  }

  function escapeHtml(s) {
    if (s == null) return "";
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
})();
