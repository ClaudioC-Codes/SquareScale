/**
 * Financial reports UI: /reports/* APIs, print, JSON download, mailto summary.
 */
const API_BASE_URL = "http://localhost:8080";

const moneyFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(n) {
  if (n == null) return "—";
  const num = typeof n === "number" ? n : parseFloat(String(n));
  return Number.isNaN(num) ? "—" : moneyFmt.format(num);
}

function getSessionUser() {
  const raw = sessionStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const user = getSessionUser();
const role = user ? String(user.role || "").toUpperCase() : "";
if (!user || !["ADMIN", "MANAGER", "USER", "ACCOUNTANT"].includes(role)) {
  window.location.href = "index.html";
}

let lastPayload = null;
let lastReportKey = "";

const reportType = document.getElementById("reportType");
const asOfDate = document.getElementById("asOfDate");
const asOfWrap = document.getElementById("asOfWrap");
const periodWrap = document.getElementById("periodWrap");
const periodFrom = document.getElementById("periodFrom");
const periodTo = document.getElementById("periodTo");
const btnRun = document.getElementById("btnRunReport");
const btnPrint = document.getElementById("btnPrint");
const btnSave = document.getElementById("btnSaveJson");
const btnEmail = document.getElementById("btnEmail");
const reportOutput = document.getElementById("reportOutput");
const reportMessage = document.getElementById("reportMessage");

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function syncUiForType() {
  const t = reportType.value;
  const needsPeriod = t === "income-statement" || t === "retained-earnings";
  const needsAsOf = t !== "income-statement";
  periodWrap.classList.toggle("hidden", !needsPeriod);
  if (asOfWrap) asOfWrap.classList.toggle("hidden", !needsAsOf);
  if (needsPeriod && !periodTo.value) periodTo.value = todayIso();
  if (needsPeriod && !periodFrom.value) {
    const d = new Date();
    periodFrom.value = `${d.getFullYear()}-01-01`;
  }
  if (needsAsOf && !asOfDate.value) asOfDate.value = todayIso();
}

reportType.addEventListener("change", syncUiForType);
syncUiForType();

function showMessage(text, isError) {
  if (!reportMessage) return;
  reportMessage.textContent = text || "";
  reportMessage.classList.remove("hidden", "error-text", "success-text");
  if (text) {
    reportMessage.classList.add(isError ? "error-text" : "success-text");
  }
}

function escapeHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

function renderTrialBalance(data) {
  let html = `<h2 class="report-title">Trial balance <span class="report-asof">as of ${escapeHtml(data.asOf)}</span></h2>`;
  html += '<table class="admin-table report-table"><thead><tr><th>Account #</th><th>Name</th><th>Normal</th><th class="num-cell">Debit</th><th class="num-cell">Credit</th></tr></thead><tbody>';
  (data.rows || []).forEach((r) => {
    html += `<tr><td>${escapeHtml(r.accountNumber)}</td><td>${escapeHtml(r.accountName)}</td><td>${escapeHtml(r.normalSide)}</td>`;
    html += `<td class="num-cell">$${formatMoney(r.debit)}</td><td class="num-cell">$${formatMoney(r.credit)}</td></tr>`;
  });
  html += `</tbody><tfoot><tr><th colspan="3">Totals</th><th class="num-cell">$${formatMoney(data.totalDebit)}</th><th class="num-cell">$${formatMoney(data.totalCredit)}</th></tr></tfoot></table>`;
  return html;
}

function renderBalanceSheet(data) {
  const block = (title, lines, total) => {
    let h = `<h3 class="report-section-title">${title}</h3><table class="admin-table report-table"><thead><tr><th>Account #</th><th>Name</th><th class="num-cell">Amount</th></tr></thead><tbody>`;
    (lines || []).forEach((r) => {
      h += `<tr><td>${escapeHtml(r.accountNumber)}</td><td>${escapeHtml(r.accountName)}</td><td class="num-cell">$${formatMoney(r.amount)}</td></tr>`;
    });
    h += `</tbody><tfoot><tr><th colspan="2">Total ${title}</th><th class="num-cell">$${formatMoney(total)}</th></tr></tfoot></table>`;
    return h;
  };
  let html = `<h2 class="report-title">Balance sheet <span class="report-asof">as of ${escapeHtml(data.asOf)}</span></h2>`;
  html += block("Assets", data.assets, data.totalAssets);
  html += block("Liabilities", data.liabilities, data.totalLiabilities);
  html += block("Equity", data.equity, data.totalEquity);
  return html;
}

function renderIncomeStatement(data) {
  const linesTable = (title, rows) => {
    let h = `<h3 class="report-section-title">${title}</h3><table class="admin-table report-table"><thead><tr><th>Account #</th><th>Name</th><th class="num-cell">Amount</th></tr></thead><tbody>`;
    (rows || []).forEach((r) => {
      h += `<tr><td>${escapeHtml(r.accountNumber)}</td><td>${escapeHtml(r.accountName)}</td><td class="num-cell">$${formatMoney(r.amount)}</td></tr>`;
    });
    h += "</tbody></table>";
    return h;
  };
  let html = `<h2 class="report-title">Income statement <span class="report-asof">${escapeHtml(data.dateFrom)} – ${escapeHtml(data.dateTo)}</span></h2>`;
  html += linesTable("Revenue", data.revenues);
  html += `<p class="report-subtotal">Total revenue: <strong>$${formatMoney(data.totalRevenue)}</strong></p>`;
  html += linesTable("Expenses", data.expenses);
  html += `<p class="report-subtotal">Total expenses: <strong>$${formatMoney(data.totalExpense)}</strong></p>`;
  html += `<p class="report-net-income">Net income: <strong>$${formatMoney(data.netIncome)}</strong></p>`;
  return html;
}

function renderRetainedEarnings(data) {
  let html = `<h2 class="report-title">Statement of retained earnings <span class="report-asof">as of ${escapeHtml(data.asOf)}</span></h2>`;
  html += `<p class="report-meta">Period: <strong>${escapeHtml(data.periodFrom)}</strong> – <strong>${escapeHtml(data.periodTo)}</strong></p>`;
  html += `<ul class="report-re-list">
    <li>Retained earnings, beginning: <strong>$${formatMoney(data.retainedEarningsBeginning)}</strong></li>
    <li>Net income (period): <strong>$${formatMoney(data.netIncome)}</strong></li>
    <li>Retained earnings, ending: <strong>$${formatMoney(data.retainedEarningsEnding)}</strong></li>
  </ul>`;
  if (data.retainedEarningsAccounts?.length) {
    html += "<h3 class=\"report-section-title\">RE accounts (detail)</h3><table class=\"admin-table report-table\"><thead><tr><th>Account #</th><th>Name</th><th class=\"num-cell\">Amount</th></tr></thead><tbody>";
    data.retainedEarningsAccounts.forEach((r) => {
      html += `<tr><td>${escapeHtml(r.accountNumber)}</td><td>${escapeHtml(r.accountName)}</td><td class="num-cell">$${formatMoney(r.amount)}</td></tr>`;
    });
    html += "</tbody></table>";
  }
  return html;
}

async function runReport() {
  showMessage("", false);
  const t = reportType.value;
  let url = "";
  const q = new URLSearchParams();
  if (t === "trial-balance") {
    url = "/reports/trial-balance";
    if (asOfDate.value) q.set("asOf", asOfDate.value);
  } else if (t === "balance-sheet") {
    url = "/reports/balance-sheet";
    if (asOfDate.value) q.set("asOf", asOfDate.value);
  } else if (t === "income-statement") {
    url = "/reports/income-statement";
    if (periodFrom.value) q.set("dateFrom", periodFrom.value);
    if (periodTo.value) q.set("dateTo", periodTo.value);
  } else if (t === "retained-earnings") {
    url = "/reports/retained-earnings";
    if (asOfDate.value) q.set("asOf", asOfDate.value);
    if (periodFrom.value) q.set("periodFrom", periodFrom.value);
    if (periodTo.value) q.set("periodTo", periodTo.value);
  }
  const qs = q.toString();
  try {
    const res = await fetch(`${API_BASE_URL}${url}${qs ? `?${qs}` : ""}`);
    const text = await res.text();
    if (!res.ok) {
      showMessage(text || "Request failed.", true);
      reportOutput.innerHTML = '<p class="report-placeholder">Could not load report.</p>';
      lastPayload = null;
      return;
    }
    const data = JSON.parse(text);
    lastPayload = data;
    lastReportKey = t;
    let html = "";
    if (t === "trial-balance") html = renderTrialBalance(data);
    else if (t === "balance-sheet") html = renderBalanceSheet(data);
    else if (t === "income-statement") html = renderIncomeStatement(data);
    else html = renderRetainedEarnings(data);
    reportOutput.innerHTML = html;
  } catch (e) {
    console.error(e);
    showMessage("Could not reach backend.", true);
    lastPayload = null;
  }
}

btnRun?.addEventListener("click", runReport);

btnPrint?.addEventListener("click", () => {
  window.print();
});

btnSave?.addEventListener("click", () => {
  if (!lastPayload) {
    showMessage("Run a report first.", true);
    return;
  }
  const blob = new Blob([JSON.stringify(lastPayload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${lastReportKey || "report"}-${todayIso()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showMessage("JSON file downloaded.", false);
});

btnEmail?.addEventListener("click", () => {
  const addr = user?.email || "";
  const sub = encodeURIComponent(`SquareScale financial report: ${reportType.options[reportType.selectedIndex].text}`);
  const body = lastPayload
    ? encodeURIComponent(JSON.stringify(lastPayload, null, 2).slice(0, 12000))
    : encodeURIComponent("Run a report, then use Email again to attach details. Or use Save (JSON) and attach the file.");
  window.location.href = `mailto:${addr}?subject=${sub}&body=${body}`;
});
