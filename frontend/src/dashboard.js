/**
 * dashboard.js — Sprint 5
 * Injects a financial ratio dashboard + notifications banner into
 * admin-home.html, admin-add-user.html, manager-home.html, and regular-user-home.html.
 *
 * Add ONE script tag to each home page (after post-login.js):
 *   <script src="src/dashboard.js"></script>
 *
 * Backend endpoint needed (new):
 *   GET /reports/ratios  → JSON object with ratio fields (see RATIO_DEFS)
 *
 * Existing endpoints re-used for notifications:
 *   GET /journal/entries?status=PENDING
 *   GET /admin/users/expired-passwords  (admin only)
 */

(async function initDashboard() {

  // ── Read session user ────────────────────────────────────────────────────
  const user = (() => {
    try { return JSON.parse(sessionStorage.getItem("user")); } catch { return null; }
  })();
  if (!user) return;

  const role      = String(user.role || "").toUpperCase();
  const isAdmin   = role === "ADMIN";
  const isManager = role === "MANAGER";
  const API       = "http://localhost:8080";

  // ── Inject dashboard HTML at the top of <main> ───────────────────────────
  const main = document.querySelector("main.home-main");
  if (!main) return;

  main.insertAdjacentHTML("afterbegin", `
    <div id="dashRoot">

      <section id="dashNotifications" class="dash-notifications hidden" aria-live="polite"></section>

      <section id="dashQuickNav" class="dash-quicknav" aria-label="Quick navigation"></section>

      <section class="add-user-section dash-ratios-section">
        <div class="dash-ratios-header">
          <h2 class="dash-section-heading">Financial Ratios Dashboard</h2>
          <button type="button" class="btn-small dash-refresh-btn" id="dashRefreshBtn"
            title="Reload ratio data from the server">&#8635; Refresh</button>
        </div>
        <p class="add-user-hint" id="dashTimestamp">Loading financial data&hellip;</p>
        <div class="dash-ratio-grid" id="dashRatioGrid">
          <p class="dash-loading">Fetching ratios&hellip;</p>
        </div>
        <div class="dash-legend">
          <span class="dash-legend-item"><span class="dash-dot dash-dot-green"></span>Good</span>
          <span class="dash-legend-item"><span class="dash-dot dash-dot-yellow"></span>Borderline</span>
          <span class="dash-legend-item"><span class="dash-dot dash-dot-red"></span>Needs attention</span>
          <span class="dash-legend-item"><span class="dash-dot dash-dot-na"></span>No data</span>
        </div>
      </section>

    </div>
  `);

  // ── Quick-nav cards ───────────────────────────────────────────────────────
  const ALL_NAV = [
    { href: "admin-accounts.html",  icon: "📊", label: "Chart of Accounts", desc: "View and manage accounts",          roles: ["ADMIN","MANAGER","USER"] },
    { href: "journal.html",         icon: "📝", label: "Journal",           desc: "Create and review journal entries", roles: ["ADMIN","MANAGER","USER"] },
    { href: "admin-event-log.html", icon: "🔍", label: "Event Log",         desc: "Audit trail of account changes",    roles: ["ADMIN","MANAGER","USER"] },
    { href: "admin-home.html",      icon: "👥", label: "Users & reports",   desc: "All users, status, expired passwords", roles: ["ADMIN"] },
    { href: "admin-add-user.html",  icon: "➕", label: "Add User",          desc: "Create a new administrator, manager, or accountant", roles: ["ADMIN"] },
  ];

  const navEl = document.getElementById("dashQuickNav");
  if (navEl) {
    navEl.innerHTML = ALL_NAV
      .filter(c => c.roles.includes(role))
      .map(c => `
        <a href="${c.href}" class="dash-nav-card" title="${c.desc}">
          <span class="dash-nav-icon">${c.icon}</span>
          <strong class="dash-nav-label">${c.label}</strong>
          <span class="dash-nav-desc">${c.desc}</span>
        </a>`).join("");
  }

  // ── Load data ─────────────────────────────────────────────────────────────
  await loadNotifications(API, isAdmin, isManager);
  await loadRatios(API);

  document.getElementById("dashRefreshBtn")
    ?.addEventListener("click", () => loadRatios(API));

})();


// ════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════
async function loadNotifications(API, isAdmin, isManager) {
  const banner = document.getElementById("dashNotifications");
  if (!banner) return;

  const messages = [];

  // Pending journal entries (all roles)
  try {
    const res = await fetch(`${API}/journal/entries?status=PENDING`);
    if (res.ok) {
      const entries = await res.json();
      const count = Array.isArray(entries) ? entries.length : 0;
      if (count > 0) {
        messages.push({
          type: "warning", icon: "&#9888;",
          text: (isAdmin || isManager)
            ? `${count} journal entr${count === 1 ? "y" : "ies"} awaiting your approval.`
            : `${count} journal entr${count === 1 ? "y" : "ies"} pending approval.`,
          href: "journal-list.html",
          linkText: (isAdmin || isManager) ? "Review now &rarr;" : "View entries &rarr;"
        });
      }
    }
  } catch { /* backend offline — skip */ }

  // Expired passwords (admin only)
  if (isAdmin) {
    try {
      const res = await fetch(`${API}/admin/users/expired-passwords`);
      if (res.ok) {
        const expired = await res.json();
        const count = Array.isArray(expired) ? expired.length : 0;
        if (count > 0) {
          messages.push({
            type: "warning", icon: "&#128273;",
            text: `${count} user${count === 1 ? "" : "s"} ${count === 1 ? "has" : "have"} an expired password (older than 3 months).`,
            href: "admin-home.html",
            linkText: "View users &rarr;"
          });
        }
      }
    } catch { /* skip */ }
  }

  if (messages.length === 0) {
    banner.innerHTML = `<div class="dash-notification dash-notification-info">
      <span>&#10003; No pending items &mdash; everything is up to date.</span>
    </div>`;
  } else {
    banner.innerHTML = messages.map(m => `
      <div class="dash-notification dash-notification-${m.type}">
        <span>${m.icon} ${m.text}</span>
        ${m.href ? `<a href="${m.href}" class="dash-notif-link">${m.linkText}</a>` : ""}
      </div>`).join("");
  }

  banner.classList.remove("hidden");
}


// ════════════════════════════════════════════════════════════════════════════
// RATIO DEFINITIONS & THRESHOLDS
//
// Normal ranges sourced from standard references (Investopedia, CFA Institute):
//   Current ratio:       >= 2 good, 1-2 borderline, <1 red
//   Quick ratio:         >= 1 good, 0.5-1 borderline, <0.5 red
//   Debt-to-equity:      <= 1 good, 1-2 borderline, >2 red
//   Gross profit margin: >= 40% good, 20-40% borderline, <20% red
//   Net profit margin:   >= 10% good, 0-10% borderline, <0% red
//   Return on assets:    >= 5% good, 1-5% borderline, <1% red
//   Return on equity:    >= 15% good, 5-15% borderline, <5% red
//   Asset turnover:      >= 1.0 good, 0.5-1.0 borderline, <0.5 red
//   Inventory turnover:  >= 6.0 good, 3.0-6.0 borderline, <3.0 red
// ════════════════════════════════════════════════════════════════════════════
const RATIO_DEFS = [
  {
    key: "currentRatio",
    label: "Current Ratio",
    format: "ratio",
    desc: "Current assets / current liabilities. Measures short-term liquidity.",
    normal: ">=2.0 good | 1.0-2.0 borderline | <1.0 red",
    green:  v => v >= 2.0,
    yellow: v => v >= 1.0,
  },
  {
    key: "quickRatio",
    label: "Quick Ratio",
    format: "ratio",
    desc: "(Current assets - inventory) / current liabilities. Conservative liquidity test.",
    normal: ">=1.0 good | 0.5-1.0 borderline | <0.5 red",
    green:  v => v >= 1.0,
    yellow: v => v >= 0.5,
  },
  {
    key: "debtToEquity",
    label: "Debt-to-Equity",
    format: "ratio",
    desc: "Total liabilities / shareholders equity. Lower = less leverage.",
    normal: "<=1.0 good | 1.0-2.0 borderline | >2.0 red",
    green:  v => v <= 1.0,
    yellow: v => v <= 2.0,
  },
  {
    key: "grossProfitMargin",
    label: "Gross Profit Margin",
    format: "percent",
    desc: "(Revenue - COGS) / revenue x 100. Core production efficiency.",
    normal: ">=40% good | 20-40% borderline | <20% red",
    green:  v => v >= 40,
    yellow: v => v >= 20,
  },
  {
    key: "netProfitMargin",
    label: "Net Profit Margin",
    format: "percent",
    desc: "Net income / revenue x 100. Overall profitability after all expenses.",
    normal: ">=10% good | 0-10% borderline | <0% red",
    green:  v => v >= 10,
    yellow: v => v >= 0,
  },
  {
    key: "returnOnAssets",
    label: "Return on Assets",
    format: "percent",
    desc: "Net income / total assets x 100. Efficiency of asset use.",
    normal: ">=5% good | 1-5% borderline | <1% red",
    green:  v => v >= 5,
    yellow: v => v >= 1,
  },
  {
    key: "returnOnEquity",
    label: "Return on Equity",
    format: "percent",
    desc: "Net income / shareholders equity x 100. Return on owners investment.",
    normal: ">=15% good | 5-15% borderline | <5% red",
    green:  v => v >= 15,
    yellow: v => v >= 5,
  },
  {
    key: "assetTurnover",
    label: "Asset Turnover",
    format: "times",
    desc: "Revenue / total assets. How efficiently assets generate revenue.",
    normal: ">=1.0 good | 0.5-1.0 borderline | <0.5 red",
    green:  v => v >= 1.0,
    yellow: v => v >= 0.5,
  },
  {
    key: "inventoryTurnover",
    label: "Inventory Turnover",
    format: "times",
    desc: "COGS / average inventory. How quickly inventory is sold.",
    normal: ">=6.0 good | 3.0-6.0 borderline | <3.0 red",
    green:  v => v >= 6.0,
    yellow: v => v >= 3.0,
  },
];

function ratioColorClass(def, value) {
  if (value == null || Number.isNaN(value)) return "dash-card-na";
  if (def.green(value))  return "dash-card-green";
  if (def.yellow(value)) return "dash-card-yellow";
  return "dash-card-red";
}

function ratioStatusLabel(cls) {
  const map = {
    "dash-card-green":  "Good",
    "dash-card-yellow": "Borderline",
    "dash-card-red":    "Needs attention",
    "dash-card-na":     "No data",
  };
  return map[cls] || "";
}

function formatRatioValue(def, value) {
  if (value == null || Number.isNaN(value)) return "N/A";
  if (def.format === "percent") return value.toFixed(1) + "%";
  if (def.format === "times")   return value.toFixed(2) + "\u00D7";
  return value.toFixed(2);
}


// ════════════════════════════════════════════════════════════════════════════
// LOAD AND RENDER RATIOS
// ════════════════════════════════════════════════════════════════════════════
async function loadRatios(API) {
  const grid      = document.getElementById("dashRatioGrid");
  const timestamp = document.getElementById("dashTimestamp");
  if (!grid) return;

  grid.innerHTML = `<p class="dash-loading">Fetching financial data&hellip;</p>`;

  let data    = {};
  let offline = false;

  try {
    const res = await fetch(`${API}/reports/ratios`);
    if (res.ok) {
      data = await res.json();
    } else {
      offline = true;
    }
  } catch {
    offline = true;
  }

  if (timestamp) {
    const now = new Date().toLocaleString();
    timestamp.textContent = offline
      ? `Backend unavailable — ratio cards show N/A. Last attempt: ${now}`
      : `Last updated: ${now}`;
  }

  grid.innerHTML = "";

  RATIO_DEFS.forEach(def => {
    const raw   = data[def.key];
    const value = (raw != null && raw !== "") ? parseFloat(raw) : null;
    const cls   = ratioColorClass(def, value);
    const status = ratioStatusLabel(cls);
    const display = formatRatioValue(def, value);

    const card = document.createElement("div");
    card.className = `dash-ratio-card ${cls}`;
    card.setAttribute("title", `${def.desc}\nNormal ranges: ${def.normal}`);

    card.innerHTML = `
      <div class="dash-card-status-row">
        <span class="dash-card-status dash-card-status-${cls.replace("dash-card-","")}">${status}</span>
      </div>
      <div class="dash-card-value">${display}</div>
      <div class="dash-card-label">${def.label}</div>
      <div class="dash-card-desc">${def.desc}</div>
      <div class="dash-card-normal">${def.normal}</div>
    `;
    grid.appendChild(card);
  });
}