const API_BASE_URL = "http://localhost:8080";

const moneyFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(n) {
  const num = typeof n === "number" ? n : parseFloat(String(n ?? "").replace(/,/g, ""));
  return Number.isNaN(num) ? "0.00" : moneyFmt.format(num);
}

// ----- Auth guard -----
(function () {
  const raw = sessionStorage.getItem("user");
  const u = raw ? JSON.parse(raw) : null;
  const r = u ? String(u.role || "").toUpperCase() : "";
  if (!u || !["ADMIN", "MANAGER", "USER"].includes(r)) {
    window.location.href = "index.html";
  }
})();

const user = (() => {
  try { return JSON.parse(sessionStorage.getItem("user")); } catch { return null; }
})();

// ----- State -----
let lineIdCounter = 0;
let lines = []; 
let accountsCache = []; 
let submitted = false;

// ----- DOM refs -----
const jeLinesBody = document.getElementById("jeLinesBody");
const jeTotalDebit = document.getElementById("jeTotalDebit");
const jeTotalCredit = document.getElementById("jeTotalCredit");
const jeBalanceIndicator = document.getElementById("jeBalanceIndicator");
const jeErrorBox = document.getElementById("jeErrorBox");
const jeErrorList = document.getElementById("jeErrorList");
const jeGlobalMessage = document.getElementById("jeGlobalMessage");
const jeFileList = document.getElementById("jeFileList");
const jeFilesInput = document.getElementById("jeFiles");

// ----- Load accounts for dropdowns -----
async function loadAccounts() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/accounts?active=true`);
    if (res.ok) accountsCache = await res.json();
  } catch (e) {
    console.error("Could not load accounts:", e);
  }
}

function buildAccountOptions(selectedId) {
  let html = '<option value="">— Select account —</option>';
  accountsCache.forEach((a) => {
    const sel = String(a.id) === String(selectedId) ? " selected" : "";
    html += `<option value="${a.id}"${sel}>${escapeHtml(a.accountNumber)} — ${escapeHtml(a.accountName)}</option>`;
  });
  return html;
}

// ----- Line management -----
function addLine(type) {
  if (submitted) return;
  const id = ++lineIdCounter;
  lines.push({ id, type, accountId: "", accountName: "", amount: "", description: "" });
  renderLines();
}

function removeLine(id) {
  if (submitted) return;
  lines = lines.filter((l) => l.id !== id);
  renderLines();
}

function renderLines() {
  if (!jeLinesBody) return;
  jeLinesBody.innerHTML = "";

  // Sort: debits before credits (req #60)
  const sorted = [...lines].sort((a, b) => {
    if (a.type === b.type) return a.id - b.id;
    return a.type === "DEBIT" ? -1 : 1;
  });

  sorted.forEach((line) => {
    const tr = document.createElement("tr");
    tr.dataset.lineId = line.id;
    tr.innerHTML = `
      <td><span class="je-type-badge je-type-${line.type.toLowerCase()}">${line.type}</span></td>
      <td>
        <select class="je-account-select" data-field="accountId" title="Select the account for this line">
          ${buildAccountOptions(line.accountId)}
        </select>
      </td>
      <td class="num-cell">
        <input type="text" class="je-amount-input" data-field="amount" value="${escapeHtml(line.amount)}"
          inputmode="decimal" placeholder="0.00" title="Enter the amount for this line">
      </td>
      <td>
        <input type="text" class="je-desc-input" data-field="description" value="${escapeHtml(line.description)}"
          maxlength="255" placeholder="Optional" title="Optional description for this line">
      </td>
      <td>
        <button type="button" class="btn-small je-remove-btn" data-remove="${line.id}"
          title="Remove this line from the entry">✕</button>
      </td>
    `;
    jeLinesBody.appendChild(tr);
  });

  updateTotals();
}

function readLinesFromDOM() {
  if (!jeLinesBody) return;
  [...jeLinesBody.querySelectorAll("tr[data-line-id]")].forEach((tr) => {
    const id = Number(tr.dataset.lineId);
    const line = lines.find((l) => l.id === id);
    if (!line) return;
    const sel = tr.querySelector("select[data-field='accountId']");
    const amtEl = tr.querySelector("input[data-field='amount']");
    const descEl = tr.querySelector("input[data-field='description']");
    if (sel) {
      line.accountId = sel.value;
      const opt = sel.options[sel.selectedIndex];
      line.accountName = opt ? opt.textContent.trim() : "";
    }
    if (amtEl) line.amount = amtEl.value.trim();
    if (descEl) line.description = descEl.value.trim();
  });
}

function updateTotals() {
  readLinesFromDOM();
  let debit = 0, credit = 0;
  lines.forEach((l) => {
    const n = parseFloat(String(l.amount).replace(/,/g, "")) || 0;
    if (l.type === "DEBIT") debit += n;
    else credit += n;
  });
  if (jeTotalDebit) jeTotalDebit.textContent = "$" + formatMoney(debit);
  if (jeTotalCredit) jeTotalCredit.textContent = "$" + formatMoney(credit);

  if (jeBalanceIndicator) {
    const balanced = Math.abs(debit - credit) < 0.005 && debit > 0;
    jeBalanceIndicator.textContent = balanced ? "✓ Balanced" : (debit > 0 || credit > 0) ? "⚠ Not balanced" : "";
    jeBalanceIndicator.className = "je-balance-indicator " + (balanced ? "je-balanced" : "je-unbalanced");
  }
  return { debit, credit };
}

// ----- Event delegation for lines table -----
if (jeLinesBody) {
  jeLinesBody.addEventListener("change", (e) => {
    const tr = e.target.closest("tr[data-line-id]");
    if (!tr) return;
    updateTotals();
    clearErrors();
  });
  jeLinesBody.addEventListener("input", (e) => {
    if (e.target.classList.contains("je-amount-input")) {
      updateTotals();
      clearErrors();
    }
  });
  jeLinesBody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (btn) {
      readLinesFromDOM();
      removeLine(Number(btn.dataset.remove));
      clearErrors();
    }
  });
}

document.getElementById("btnAddDebit")?.addEventListener("click", () => addLine("DEBIT"));
document.getElementById("btnAddCredit")?.addEventListener("click", () => addLine("CREDIT"));

// ----- File attachment display -----
if (jeFilesInput) {
  jeFilesInput.addEventListener("change", () => {
    if (!jeFileList) return;
    jeFileList.innerHTML = "";
    [...jeFilesInput.files].forEach((f) => {
      const li = document.createElement("li");
      li.textContent = `${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
      jeFileList.appendChild(li);
    });
  });
}

// ----- Validation -----
const ALLOWED_EXT = /\.(pdf|doc|docx|xls|xlsx|csv|jpg|jpeg|png)$/i;

function validate() {
  readLinesFromDOM();
  const errors = [];

  // At least one debit and one credit
  const debits = lines.filter((l) => l.type === "DEBIT");
  const credits = lines.filter((l) => l.type === "CREDIT");
  if (debits.length === 0) errors.push("At least one debit line is required.");
  if (credits.length === 0) errors.push("At least one credit line is required.");

  // All lines must have an account selected
  lines.forEach((l, i) => {
    if (!l.accountId) errors.push(`Line ${i + 1} (${l.type}): No account selected.`);
    const amt = parseFloat(String(l.amount).replace(/,/g, ""));
    if (!l.amount || Number.isNaN(amt) || amt <= 0) {
      errors.push(`Line ${i + 1} (${l.type}): Amount must be a positive number.`);
    }
  });

  // Debits must equal credits
  const totalDebit = lines.filter((l) => l.type === "DEBIT").reduce((s, l) => s + (parseFloat(String(l.amount).replace(/,/g, "")) || 0), 0);
  const totalCredit = lines.filter((l) => l.type === "CREDIT").reduce((s, l) => s + (parseFloat(String(l.amount).replace(/,/g, "")) || 0), 0);
  if (errors.length === 0 && Math.abs(totalDebit - totalCredit) >= 0.005) {
    errors.push(`Debits ($${formatMoney(totalDebit)}) must equal credits ($${formatMoney(totalCredit)}). Difference: $${formatMoney(Math.abs(totalDebit - totalCredit))}.`);
  }

  // Date required
  const dateEl = document.getElementById("jeDate");
  if (!dateEl?.value) errors.push("Entry date is required.");

  // File type check
  if (jeFilesInput) {
    [...jeFilesInput.files].forEach((f) => {
      if (!ALLOWED_EXT.test(f.name)) {
        errors.push(`File "${f.name}" is not an allowed type (PDF, Word, Excel, CSV, JPG, PNG).`);
      }
    });
  }

  return errors;
}

function showErrors(errors) {
  if (!jeErrorBox || !jeErrorList) return;
  jeErrorList.innerHTML = "";
  errors.forEach((e) => {
    const li = document.createElement("li");
    li.textContent = e;
    jeErrorList.appendChild(li);
  });
  jeErrorBox.classList.remove("hidden");
}

function clearErrors() {
  jeErrorBox?.classList.add("hidden");
  if (jeErrorList) jeErrorList.innerHTML = "";
}

function showGlobalMessage(text, isError) {
  if (!jeGlobalMessage) return;
  jeGlobalMessage.textContent = text;
  jeGlobalMessage.classList.remove("hidden", "error-text", "success-text");
  jeGlobalMessage.classList.add(isError ? "error-text" : "success-text");
}

// ----- Submit -----
document.getElementById("btnSubmitEntry")?.addEventListener("click", async () => {
  if (submitted) return;
  clearErrors();

  const errors = validate();
  if (errors.length > 0) {
    showErrors(errors);
    return;
  }

  const dateVal = document.getElementById("jeDate").value;
  const description = document.getElementById("jeDescription").value.trim();
  const entryType = document.getElementById("jeType").value;

  readLinesFromDOM();
  const entryPayload = {
    date: dateVal,
    description: description || null,
    entryType,
    createdByUserId: user?.userId,
    lines: lines.map((l) => ({
      type: l.type,
      accountId: Number(l.accountId),
      amount: parseFloat(String(l.amount).replace(/,/g, "")),
      description: l.description || null,
    })),
  };

  try {
    const formData = new FormData();
    formData.append("entry", new Blob([JSON.stringify(entryPayload)], { type: "application/json" }));
    if (jeFilesInput) {
      [...jeFilesInput.files].forEach((f) => formData.append("files", f));
    }

    const res = await fetch(`${API_BASE_URL}/journal/entries`, {
      method: "POST",
      headers: user?.userId ? { "X-User-Id": String(user.userId) } : {},
      body: formData,
    });
    const text = await res.text();
    if (res.ok) {
      submitted = true;
      showGlobalMessage(text || "Journal entry submitted for approval.", false);
      document.getElementById("btnSubmitEntry").disabled = true;
      document.getElementById("btnResetEntry").disabled = true;
    } else {
      showErrors([text || "Submission failed. Please correct the error and try again."]);
    }
  } catch (err) {
    console.error(err);
    showErrors(["Could not reach backend. Make sure the server is running on port 8080."]);
  }
});

// ----- Reset -----
document.getElementById("btnResetEntry")?.addEventListener("click", () => {
  if (submitted) return;
  if (!confirm("Reset all lines and start over?")) return;
  lines = [];
  lineIdCounter = 0;
  renderLines();
  clearErrors();
  document.getElementById("jeDate").value = "";
  document.getElementById("jeDescription").value = "";
  document.getElementById("jeType").value = "REGULAR";
  if (jeFilesInput) jeFilesInput.value = "";
  if (jeFileList) jeFileList.innerHTML = "";
  if (jeGlobalMessage) jeGlobalMessage.classList.add("hidden");
});

// ----- Init -----
(async function init() {
  await loadAccounts();
  // Start with one debit and one credit line by default
  addLine("DEBIT");
  addLine("CREDIT");

  // Pre-fill today's date
  const dateEl = document.getElementById("jeDate");
  if (dateEl && !dateEl.value) {
    dateEl.value = new Date().toISOString().slice(0, 10);
  }
})();

function escapeHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}