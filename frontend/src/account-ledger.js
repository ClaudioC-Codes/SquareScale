/**
 * Load ledger JSON for account id from query string (?accountId=).
 */
const API_BASE_URL = "http://localhost:8080";

const moneyFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(n) {
  if (n == null || n === "") return "—";
  const num = typeof n === "number" ? n : parseFloat(String(n).replace(/,/g, ""));
  if (Number.isNaN(num)) return "—";
  return moneyFmt.format(num);
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
const ledgerRole = user ? String(user.role || "").toUpperCase() : "";
if (!user || !["ADMIN", "MANAGER", "USER", "ACCOUNTANT"].includes(ledgerRole)) {
  window.location.href = "index.html";
} else {
  loadStaffRecipients();
  loadLedger();
}

function formatDateTime(val) {
  if (val == null) return "—";
  if (Array.isArray(val) && val.length >= 3) {
    const [y, mo, d, h = 0, mi = 0, s = 0] = val;
    const dt = new Date(y, mo - 1, d, h, mi, s);
    return Number.isNaN(dt.getTime()) ? String(val) : dt.toLocaleString();
  }
  const dt = new Date(val);
  if (!Number.isNaN(dt.getTime())) return dt.toLocaleString();
  return String(val);
}

async function loadLedger() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("accountId");
  const sub = document.getElementById("ledgerSubtitle");
  const msg = document.getElementById("ledgerMessage");
  if (!id) {
    if (sub) sub.textContent = "Missing account id.";
    return;
  }
  try {
    const qs = buildLedgerQuery(id);
    const res = await fetch(`${API_BASE_URL}/admin/accounts/${id}/ledger${qs ? "?" + qs : ""}`);
    if (!res.ok) {
      const t = await res.text();
      if (msg) {
        msg.textContent = t || "Could not load ledger.";
        msg.classList.remove("hidden");
      }
      if (sub) sub.textContent = "Error";
      return;
    }
    const data = await res.json();
    const acc = data.account;
    const lines = data.lines || [];
    const subj = document.getElementById("ledgerEmailSubject");
    if (subj && acc) {
      subj.value = `Question about account ${acc.accountNumber} — ${acc.accountName}`;
    }
    if (sub) {
      sub.textContent = `${acc.accountNumber} — ${acc.accountName} (normal balance: ${acc.normalSide})`;
    }
    const title = document.getElementById("ledgerAccountTitle");
    if (title) {
      title.textContent = `Ledger: ${acc.accountName}`;
    }
    const tbody = document.querySelector("#ledgerTable tbody");
    if (tbody) {
      tbody.innerHTML = "";
      lines.forEach((line) => {
        const tr = document.createElement("tr");
        const prCell = line.journalEntryId
        ? `<td><a href="journal-list.html?entryId=${encodeURIComponent(line.journalEntryId)}" class="link-inline pr-link" title="View the journal entry that created this line">JE-${escapeHtml(line.journalEntryId)}</a></td>`
        : `<td class="pr-cell">—</td>`;

        tr.innerHTML = `
          <td>${formatDateTime(line.date)}</td>
          <td>${escapeHtml(line.description)}</td>
          ${prCell}
          <td class="num-cell">${formatMoney(line.debit)}</td>
          <td class="num-cell">${formatMoney(line.credit)}</td>
          <td class="num-cell">${formatMoney(line.balance)}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (e) {
    console.error(e);
    if (msg) {
      msg.textContent = "Could not reach backend.";
      msg.classList.remove("hidden");
    }
  }
}

function escapeHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function buildLedgerQuery(id) {
  const p = new URLSearchParams();
  p.set("accountId", id);
  const from = document.getElementById("ledgerDateFrom")?.value;
  if (from) p.set("dateFrom", from);
  const to = document.getElementById("ledgerDateTo")?.value;
  if (to) p.set("dateTo", to);
  const search = document.getElementById("ledgerSearch")?.value?.trim();
  if (search) p.set("search", search);
  return p.toString();
}

document.getElementById("btnLedgerApply")?.addEventListener("click", loadLedger);
document.getElementById("btnLedgerClear")?.addEventListener("click", () => {
  ["ledgerDateFrom", "ledgerDateTo", "ledgerSearch"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  loadLedger();
});

async function loadStaffRecipients() {
  const sel = document.getElementById("ledgerEmailRecipient");
  if (!sel) return;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/contact-recipients`);
    if (!res.ok) {
      sel.innerHTML = "<option value=\"\">Could not load contacts</option>";
      return;
    }
    const list = await res.json();
    sel.innerHTML = "<option value=\"\">— Select recipient —</option>";
    list.forEach((c) => {
      const o = document.createElement("option");
      o.value = String(c.userId);
      o.textContent = `${c.username} (${c.role})`;
      sel.appendChild(o);
    });
  } catch {
    sel.innerHTML = "<option value=\"\">Could not load contacts</option>";
  }
}

document.getElementById("btnLedgerSendEmail")?.addEventListener("click", async () => {
  const sel = document.getElementById("ledgerEmailRecipient");
  const bodyEl = document.getElementById("ledgerEmailBody");
  const subjEl = document.getElementById("ledgerEmailSubject");
  const status = document.getElementById("ledgerEmailStatus");
  const rid = sel?.value?.trim();
  const body = bodyEl?.value?.trim() || "";
  const subject = subjEl?.value?.trim() || "SquareScale message";
  if (!rid) {
    if (status) {
      status.textContent = "Choose a recipient.";
      status.classList.remove("hidden");
    }
    return;
  }
  if (!body) {
    if (status) {
      status.textContent = "Enter a message.";
      status.classList.remove("hidden");
    }
    return;
  }
  const params = new URLSearchParams();
  params.set("message", body);
  params.set("subject", subject);
  try {
    const res = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(rid)}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const t = await res.text();
    if (status) {
      status.textContent = t || (res.ok ? "Sent." : "Failed.");
      status.classList.remove("hidden", "error-text", "success-text");
      status.classList.add(res.ok ? "success-text" : "error-text");
    }
    if (res.ok && bodyEl) bodyEl.value = "";
  } catch {
    if (status) {
      status.textContent = "Could not reach server.";
      status.classList.remove("hidden");
      status.classList.add("error-text");
    }
  }
});
