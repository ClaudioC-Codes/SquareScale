/**
 * Journal list page: view all journal entries (filter by status, type, date range, search).
 * Managers can open an entry and approve or reject it (with required reason on rejection).
 * All roles can view entry details.
 */
const API_BASE_URL = "http://localhost:8080";

const moneyFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function formatMoney(n) {
  const num = typeof n === "number" ? n : parseFloat(String(n ?? "").replace(/,/g, ""));
  return Number.isNaN(num) ? "—" : moneyFmt.format(num);
}

function formatDate(val) {
  if (!val) return "—";
  if (Array.isArray(val)) {
    const [y, mo, d] = val;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const dt = new Date(val);
  return Number.isNaN(dt.getTime()) ? String(val) : dt.toLocaleDateString();
}

function escapeHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

// ----- Auth -----
const user = (() => {
  try { return JSON.parse(sessionStorage.getItem("user")); } catch { return null; }
})();
const role = user ? String(user.role || "").toUpperCase() : "";
if (!user || !["ADMIN", "MANAGER", "USER", "ACCOUNTANT"].includes(role)) {
  window.location.href = "index.html";
}
const isManager = role === "ADMIN" || role === "MANAGER";

// ----- DOM refs -----
const jlBody = document.getElementById("jlBody");
const jlMessage = document.getElementById("jlMessage");
const jlDetailModal = document.getElementById("jlDetailModal");
const jlDetailLinesBody = document.getElementById("jlDetailLinesBody");
const jlDetailMeta = document.getElementById("jlDetailMeta");
const jlDetailId = document.getElementById("jlDetailId");
const jlRejectReason = document.getElementById("jlRejectReason");
const jlDetailMessage = document.getElementById("jlDetailMessage");
const jlManagerControls = document.getElementById("jlManagerControls");
const jlViewControls = document.getElementById("jlViewControls");
const jlAttachList = document.getElementById("jlAttachList");

let currentEntryId = null;

// ----- Fetch entries -----
function buildQuery() {
  const params = new URLSearchParams();
  const status = document.getElementById("jlFilterStatus")?.value;
  if (status) params.set("status", status);
  const type = document.getElementById("jlFilterType")?.value;
  if (type) params.set("entryType", type);
  const from = document.getElementById("jlDateFrom")?.value;
  if (from) params.set("dateFrom", from);
  const to = document.getElementById("jlDateTo")?.value;
  if (to) params.set("dateTo", to);
  const search = document.getElementById("jlSearch")?.value?.trim();
  if (search) params.set("search", search);
  return params.toString();
}

async function loadEntries() {
  if (!jlBody) return;
  jlBody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#888;">Loading…</td></tr>';
  if (jlMessage) jlMessage.classList.add("hidden");
  try {
    const qs = buildQuery();
    const res = await fetch(`${API_BASE_URL}/journal/entries${qs ? "?" + qs : ""}`);
    if (!res.ok) throw new Error(await res.text());
    const entries = await res.json();
    renderEntries(entries);
  } catch (err) {
    console.error(err);
    jlBody.innerHTML = "";
    if (jlMessage) {
      jlMessage.textContent = "Could not load journal entries.";
      jlMessage.classList.remove("hidden");
      jlMessage.classList.add("error-text");
    }
  }
}

function statusBadge(status) {
  const map = { PENDING: "je-status-pending", APPROVED: "je-status-approved", REJECTED: "je-status-rejected" };
  return `<span class="je-status-badge ${map[status] || ""}">${escapeHtml(status)}</span>`;
}

function renderEntries(entries) {
  if (!jlBody) return;
  jlBody.innerHTML = "";
  if (!entries || entries.length === 0) {
    jlBody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#888;">No entries found.</td></tr>';
    return;
  }
  entries.forEach((e) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(e.id)}</td>
      <td>${formatDate(e.date)}</td>
      <td>${escapeHtml(e.entryType || "REGULAR")}</td>
      <td>${escapeHtml(e.description || "—")}</td>
      <td class="num-cell">$${formatMoney(e.totalDebit)}</td>
      <td class="num-cell">$${formatMoney(e.totalCredit)}</td>
      <td>${statusBadge(e.status)}</td>
      <td>${escapeHtml(e.createdByUsername || e.createdByUserId || "—")}</td>
      <td>
        <button type="button" class="btn-small" data-view="${e.id}" title="View details of this journal entry">View</button>
      </td>
    `;
    jlBody.appendChild(tr);
  });
}

// ----- Entry detail modal -----
async function openDetail(id) {
  currentEntryId = id;
  if (jlDetailId) jlDetailId.textContent = id;
  if (jlDetailMessage) jlDetailMessage.classList.add("hidden");
  if (jlRejectReason) jlRejectReason.value = "";
  if (jlAttachList) jlAttachList.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE_URL}/journal/entries/${id}`);
    if (!res.ok) throw new Error(await res.text());
    const entry = await res.json();

    // Meta line
    if (jlDetailMeta) {
      const parts = [
        `Date: ${formatDate(entry.date)}`,
        `Type: ${entry.entryType || "REGULAR"}`,
        `Status: ${entry.status}`,
        `Created by: ${entry.createdByUsername || entry.createdByUserId || "—"}`,
      ];
      if (entry.rejectionReason) parts.push(`Rejection reason: ${entry.rejectionReason}`);
      jlDetailMeta.textContent = parts.join("  ·  ");
    }

    // Lines
    if (jlDetailLinesBody) {
      jlDetailLinesBody.innerHTML = "";
      (entry.lines || []).forEach((line) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><span class="je-type-badge je-type-${(line.type || "").toLowerCase()}">${escapeHtml(line.type)}</span></td>
          <td>${escapeHtml(line.accountNumber ? line.accountNumber + " — " + line.accountName : line.accountName || "—")}</td>
          <td class="num-cell">$${formatMoney(line.amount)}</td>
          <td>${escapeHtml(line.description || "—")}</td>
        `;
        jlDetailLinesBody.appendChild(tr);
      });
    }

    // Attachments
    if (jlAttachList && entry.attachments?.length) {
      entry.attachments.forEach((a) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = `${API_BASE_URL}/journal/entries/${id}/attachments/${a.id}`;
        link.textContent = a.filename || `Attachment ${a.id}`;
        link.target = "_blank";
        link.title = "Download this attachment";
        li.appendChild(link);
        jlAttachList.appendChild(li);
      });
    }

    // Manager controls: only show approve/reject on PENDING entries for managers
    const isPending = entry.status === "PENDING";
    if (jlManagerControls && jlViewControls) {
      if (isManager && isPending) {
        jlManagerControls.classList.remove("hidden");
        jlViewControls.classList.add("hidden");
      } else {
        jlManagerControls.classList.add("hidden");
        jlViewControls.classList.remove("hidden");
      }
    }

    jlDetailModal?.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    alert("Could not load entry details.");
  }
}

function closeModal() {
  jlDetailModal?.classList.add("hidden");
  currentEntryId = null;
}

// ----- Table click delegation -----
if (jlBody) {
  jlBody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (btn) openDetail(btn.dataset.view);
  });
}

// ----- Approve -----
document.getElementById("btnJlApprove")?.addEventListener("click", async () => {
  if (!currentEntryId) return;
  if (!confirm("Approve this journal entry? It will be posted to account ledgers.")) return;
  await submitDecision("approve", "");
});

// ----- Reject -----
document.getElementById("btnJlReject")?.addEventListener("click", async () => {
  if (!currentEntryId) return;
  const reason = jlRejectReason?.value.trim();
  if (!reason) {
    if (jlDetailMessage) {
      jlDetailMessage.textContent = "A rejection reason is required.";
      jlDetailMessage.classList.remove("hidden", "success-text");
      jlDetailMessage.classList.add("error-text");
    }
    return;
  }
  await submitDecision("reject", reason);
});

async function submitDecision(action, reason) {
  try {
    const body = { action, reason: reason || null, reviewedByUserId: user?.userId };
    const res = await fetch(`${API_BASE_URL}/journal/entries/${currentEntryId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(user?.userId ? { "X-User-Id": String(user.userId) } : {}) },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) {
      closeModal();
      loadEntries();
    } else {
      if (jlDetailMessage) {
        jlDetailMessage.textContent = text || `${action} failed.`;
        jlDetailMessage.classList.remove("hidden", "success-text");
        jlDetailMessage.classList.add("error-text");
      }
    }
  } catch (err) {
    console.error(err);
    if (jlDetailMessage) {
      jlDetailMessage.textContent = "Could not reach backend.";
      jlDetailMessage.classList.remove("hidden", "success-text");
      jlDetailMessage.classList.add("error-text");
    }
  }
}

// ----- Close buttons -----
document.getElementById("btnJlClose")?.addEventListener("click", closeModal);
document.getElementById("btnJlCloseView")?.addEventListener("click", closeModal);
jlDetailModal?.addEventListener("click", (e) => { if (e.target === jlDetailModal) closeModal(); });

// ----- Filters -----
document.getElementById("btnJlApply")?.addEventListener("click", loadEntries);
document.getElementById("btnJlClear")?.addEventListener("click", () => {
  ["jlFilterStatus", "jlFilterType", "jlDateFrom", "jlDateTo", "jlSearch"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  loadEntries();
});

// ----- Init -----
loadEntries();