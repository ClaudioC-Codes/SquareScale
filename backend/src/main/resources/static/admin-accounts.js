/**
 * Admin chart of accounts: service selector (Add / View / Edit / Deactivate),
 * API calls to /admin/accounts, money display with commas and 2 decimals.
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

/** Strip commas; return string suitable for JSON number parse. */
function parseMoneyInput(str) {
  const s = String(str ?? "").replace(/,/g, "").trim();
  if (s === "") return "0";
  return s;
}

/** Headers for mutating requests: JSON + acting user for audit log. */
function auditHeaders(json = true) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  if (user?.userId != null) h["X-User-Id"] = String(user.userId);
  return h;
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

let accountsCache = [];
let currentEditAccount = null;

const user = getSessionUser();
const role = user ? String(user.role || "").toUpperCase() : "";
const isAdmin = role === "ADMIN";

if (!user || !["ADMIN", "MANAGER", "USER"].includes(role)) {
  window.location.href = "index.html";
} else {
  init();
}

function setupViewOnlyUi() {
  document.getElementById("serviceSection")?.classList.add("hidden");
  document.getElementById("panelAdd")?.classList.add("hidden");
  document.getElementById("panelEdit")?.classList.add("hidden");
  document.getElementById("panelDeactivate")?.classList.add("hidden");
  document.getElementById("panelView")?.classList.remove("hidden");
  const ht = document.querySelector(".home-title");
  if (ht) {
    ht.textContent = "Chart of accounts (view only)";
  }
  const desc = document.querySelector(".home-desc");
  if (desc) {
    desc.textContent =
      "Search and filter accounts. Click a row to open the ledger. Only administrators can add, edit, or deactivate accounts.";
  }
}

/** Table row → ledger, filter Apply/Clear — used by admins (view panel) and view-only users. */
function wireAccountsViewControls() {
  const table = document.getElementById("accountsTable");
  if (table) {
    table.addEventListener("click", (e) => {
      const tr = e.target.closest("tr.account-row");
      if (!tr || !tr.dataset.id) return;
      window.location.href = `account-ledger.html?accountId=${encodeURIComponent(tr.dataset.id)}`;
    });
  }

  const btnApply = document.getElementById("btnApplyFilters");
  const btnClear = document.getElementById("btnClearFilters");
  if (btnApply) {
    btnApply.addEventListener("click", async () => {
      try {
        await refreshAccountTable();
      } catch (err) {
        console.error(err);
      }
    });
  }
  if (btnClear) {
    btnClear.addEventListener("click", async () => {
      ["filterSearch", "filterName", "filterNumber", "filterCategory", "filterMinBal", "filterMaxBal"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      const fa = document.getElementById("filterActive");
      if (fa) fa.value = "";
      try {
        await refreshAccountTable();
      } catch (err) {
        console.error(err);
      }
    });
  }
}

const ACCOUNT_CATEGORY_OPTIONS = ["Asset", "Liability", "Equity"];

/** Ensures standard options plus an extra option when the saved value is not Asset/Liability/Equity. */
function fillCategorySelect(selectEl, currentValue) {
  if (!selectEl) return;
  const cur = (currentValue || "").trim();
  selectEl.innerHTML = '<option value="">— Choose —</option>';
  ACCOUNT_CATEGORY_OPTIONS.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
  if (cur && !ACCOUNT_CATEGORY_OPTIONS.includes(cur)) {
    const opt = document.createElement("option");
    opt.value = cur;
    opt.textContent = `${cur} (legacy)`;
    selectEl.appendChild(opt);
  }
  selectEl.value = cur;
}

function accountFormFieldsHTML(prefix) {
  const subcategoryBlock =
    prefix === "add"
      ? ""
      : `
    <label for="${prefix}_accountSubcategory">Account subcategory * (e.g. Current assets)</label>
    <input type="text" id="${prefix}_accountSubcategory" required maxlength="100">
`;
  return `
    <label for="${prefix}_accountName">Account name *</label>
    <input type="text" id="${prefix}_accountName" required maxlength="255">

    <label for="${prefix}_accountNumber">Account number * (digits only, starts with 1–5)</label>
    <input type="text" id="${prefix}_accountNumber" required maxlength="20" inputmode="numeric" autocomplete="off">

    <label for="${prefix}_description">Account description</label>
    <input type="text" id="${prefix}_description" maxlength="500">

    <label for="${prefix}_normalSide">Normal side *</label>
    <select id="${prefix}_normalSide" required>
      <option value="">—</option>
      <option value="Debit">Debit</option>
      <option value="Credit">Credit</option>
    </select>

    <label for="${prefix}_accountCategory">Account category *</label>
    <select id="${prefix}_accountCategory" required>
      <option value="">— Choose —</option>
      <option value="Asset">Asset</option>
      <option value="Liability">Liability</option>
      <option value="Equity">Equity</option>
    </select>
${subcategoryBlock}
    <label for="${prefix}_initialBalance">Initial balance *</label>
    <input type="text" id="${prefix}_initialBalance" required inputmode="decimal" placeholder="0.00">

    <label for="${prefix}_debit">Debit *</label>
    <input type="text" id="${prefix}_debit" required inputmode="decimal" placeholder="0.00">

    <label for="${prefix}_credit">Credit *</label>
    <input type="text" id="${prefix}_credit" required inputmode="decimal" placeholder="0.00">

    <label for="${prefix}_balance">Balance (optional — leave blank to use Initial + Debit − Credit)</label>
    <input type="text" id="${prefix}_balance" inputmode="decimal" placeholder="auto">

    <label for="${prefix}_accountOrder">Order * (e.g. 01)</label>
    <input type="text" id="${prefix}_accountOrder" required maxlength="10">

    <label for="${prefix}_statementType">Statement *</label>
    <select id="${prefix}_statementType" required>
      <option value="">—</option>
      <option value="IS">IS — Income Statement</option>
      <option value="BS">BS — Balance Sheet</option>
      <option value="RE">RE — Retained Earnings</option>
    </select>

    <label for="${prefix}_commentText">Comment</label>
    <input type="text" id="${prefix}_commentText" maxlength="500">

    <button type="submit" class="btn-submit" title="${prefix === "add" ? "Save the new account to the chart of accounts" : "Save changes to the selected account"}">Submit</button>
    <p id="${prefix}_message" class="message-text hidden"></p>
  `;
}

function wireAccountNumberDigits(prefix) {
  const el = document.getElementById(`${prefix}_accountNumber`);
  if (!el) return;
  el.addEventListener("input", () => {
    el.value = el.value.replace(/\D/g, "");
  });
}

function showFormMessage(prefix, text, isError) {
  const p = document.getElementById(`${prefix}_message`);
  if (!p) return;
  p.textContent = text || "";
  p.classList.remove("hidden", "error-text", "success-text");
  if (text) {
    p.classList.add(isError ? "error-text" : "success-text");
    p.classList.remove("hidden");
  }
}

function readFormPayload(prefix, includeUserId) {
  const num = document.getElementById(`${prefix}_accountNumber`).value.trim();
  if (!/^[1-5][0-9]*$/.test(num)) {
    return { error: "Account number must be digits only and start with 1–5." };
  }

  const balRaw = document.getElementById(`${prefix}_balance`).value.trim();
  const subEl = document.getElementById(`${prefix}_accountSubcategory`);
  const payload = {
    accountName: document.getElementById(`${prefix}_accountName`).value.trim(),
    accountNumber: num,
    description: document.getElementById(`${prefix}_description`).value.trim() || null,
    normalSide: document.getElementById(`${prefix}_normalSide`).value,
    accountCategory: document.getElementById(`${prefix}_accountCategory`).value.trim(),
    accountSubcategory: subEl ? subEl.value.trim() : "N/A",
    initialBalance: parseFloat(parseMoneyInput(document.getElementById(`${prefix}_initialBalance`).value)),
    debit: parseFloat(parseMoneyInput(document.getElementById(`${prefix}_debit`).value)),
    credit: parseFloat(parseMoneyInput(document.getElementById(`${prefix}_credit`).value)),
    balance: balRaw === "" ? null : parseFloat(parseMoneyInput(balRaw)),
    accountOrder: document.getElementById(`${prefix}_accountOrder`).value.trim(),
    statementType: document.getElementById(`${prefix}_statementType`).value,
    commentText: document.getElementById(`${prefix}_commentText`).value.trim() || null,
  };
  if (includeUserId) {
    payload.userId = user.userId;
  }
  if (Number.isNaN(payload.initialBalance) || Number.isNaN(payload.debit) || Number.isNaN(payload.credit)) {
    return { error: "Enter valid numbers for monetary fields." };
  }
  if (payload.balance != null && Number.isNaN(payload.balance)) {
    return { error: "Balance must be a valid number or left blank." };
  }
  return { payload };
}

function buildFilterQuery() {
  const params = new URLSearchParams();
  const s = document.getElementById("filterSearch")?.value?.trim();
  if (s) params.set("search", s);
  const n = document.getElementById("filterName")?.value?.trim();
  if (n) params.set("name", n);
  const num = document.getElementById("filterNumber")?.value?.trim();
  if (num) params.set("accountNumber", num);
  const c = document.getElementById("filterCategory")?.value?.trim();
  if (c) params.set("category", c);
  const minB = document.getElementById("filterMinBal")?.value?.trim();
  if (minB) params.set("minBalance", parseMoneyInput(minB));
  const maxB = document.getElementById("filterMaxBal")?.value?.trim();
  if (maxB) params.set("maxBalance", parseMoneyInput(maxB));
  const act = document.getElementById("filterActive")?.value;
  if (act === "true" || act === "false") params.set("active", act);
  return params.toString();
}

async function fetchAccountsFiltered() {
  const qs = buildFilterQuery();
  const url = `${API_BASE_URL}/admin/accounts${qs ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchAccountsAll() {
  const res = await fetch(`${API_BASE_URL}/admin/accounts`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function renderTable(accounts) {
  const tbody = document.querySelector("#accountsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  accounts.forEach((a, i) => {
    const tr = document.createElement("tr");
    tr.className = "account-row";
    tr.dataset.id = String(a.id);
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(a.accountName)}</td>
      <td>${escapeHtml(a.accountNumber)}</td>
      <td>${escapeHtml(a.accountCategory)}</td>
      <td class="num-cell">${formatMoney(a.balance)}</td>
      <td>${a.active ? "Yes" : "No"}</td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function fillSelect(selectEl, accounts) {
  if (!selectEl) return;
  const cur = selectEl.value;
  selectEl.innerHTML = '<option value="">— Select —</option>';
  accounts.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = String(a.id);
    opt.textContent = `${a.accountNumber} — ${a.accountName}`;
    selectEl.appendChild(opt);
  });
  if ([...selectEl.options].some((o) => o.value === cur)) selectEl.value = cur;
}

/** Table uses current filters; dropdowns use full list. */
async function refreshAccountTable() {
  accountsCache = await fetchAccountsFiltered();
  renderTable(accountsCache);
}

async function refreshDropdowns() {
  const all = await fetchAccountsAll();
  fillSelect(document.getElementById("editPick"), all);
  fillSelect(document.getElementById("deactPick"), all);
}

async function refreshAccounts() {
  await refreshAccountTable();
  await refreshDropdowns();
}

function hideAllPanels() {
  ["panelAdd", "panelView", "panelEdit", "panelDeactivate"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
}

function init() {
  if (!isAdmin) {
    setupViewOnlyUi();
    wireAccountsViewControls();
    refreshAccountTable().catch((e) => console.error(e));
    return;
  }

  const formAdd = document.getElementById("formAdd");
  const formEdit = document.getElementById("formEdit");
  if (formAdd) {
    formAdd.innerHTML = accountFormFieldsHTML("add");
    wireAccountNumberDigits("add");
    formAdd.addEventListener("submit", async (e) => {
      e.preventDefault();
      showFormMessage("add", "", false);
      const r = readFormPayload("add", true);
      if (r.error) {
        showFormMessage("add", r.error, true);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/admin/accounts`, {
          method: "POST",
          headers: auditHeaders(),
          body: JSON.stringify(r.payload),
        });
        const text = await res.text();
        if (!res.ok) {
          showFormMessage("add", text || "Request failed", true);
          return;
        }
        showFormMessage("add", text, false);
        formAdd.reset();
        try {
          await refreshAccounts();
        } catch (_) {
          /* ignore refresh errors */
        }
      } catch (err) {
        console.error(err);
        showFormMessage("add", "Could not reach backend.", true);
      }
    });
  }

  if (formEdit) {
    formEdit.innerHTML = accountFormFieldsHTML("edit");
    wireAccountNumberDigits("edit");
    formEdit.addEventListener("submit", async (e) => {
      e.preventDefault();
      showFormMessage("edit", "", false);
      const id = document.getElementById("editPick").value;
      if (!id) {
        showFormMessage("edit", "Select an account first.", true);
        return;
      }
      const r = readFormPayload("edit", false);
      if (r.error) {
        showFormMessage("edit", r.error, true);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/admin/accounts/${id}`, {
          method: "PUT",
          headers: auditHeaders(),
          body: JSON.stringify(r.payload),
        });
        const text = await res.text();
        if (!res.ok) {
          showFormMessage("edit", text || "Request failed", true);
          return;
        }
        showFormMessage("edit", text, false);
        await refreshAccounts();
      } catch (err) {
        console.error(err);
        showFormMessage("edit", "Could not reach backend.", true);
      }
    });
  }

  const editPick = document.getElementById("editPick");
  if (editPick) {
    editPick.addEventListener("change", async () => {
      showFormMessage("edit", "", false);
      const id = editPick.value;
      if (!id) {
        currentEditAccount = null;
        formEdit.reset();
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/admin/accounts/${id}`);
        if (!res.ok) {
          showFormMessage("edit", "Could not load account.", true);
          return;
        }
        const a = await res.json();
        currentEditAccount = a;
        document.getElementById("edit_accountName").value = a.accountName || "";
        document.getElementById("edit_accountNumber").value = a.accountNumber || "";
        document.getElementById("edit_description").value = a.description || "";
        document.getElementById("edit_normalSide").value =
          a.normalSide === "Credit" ? "Credit" : "Debit";
        fillCategorySelect(document.getElementById("edit_accountCategory"), a.accountCategory);
        document.getElementById("edit_accountSubcategory").value = a.accountSubcategory || "";
        document.getElementById("edit_initialBalance").value = formatMoney(a.initialBalance);
        document.getElementById("edit_debit").value = formatMoney(a.debit);
        document.getElementById("edit_credit").value = formatMoney(a.credit);
        document.getElementById("edit_balance").value = formatMoney(a.balance);
        document.getElementById("edit_accountOrder").value = a.accountOrder || "";
        document.getElementById("edit_statementType").value = a.statementType || "";
        document.getElementById("edit_commentText").value = a.commentText || "";
      } catch (err) {
        console.error(err);
        showFormMessage("edit", "Could not load account.", true);
      }
    });
  }

  const serviceSelect = document.getElementById("serviceSelect");
  if (serviceSelect) {
    serviceSelect.addEventListener("change", async () => {
      hideAllPanels();
      const v = serviceSelect.value;
      const globalMsg = document.getElementById("accountsGlobalMessage");
      if (globalMsg) {
        globalMsg.classList.add("hidden");
        globalMsg.textContent = "";
      }
      if (v === "add") {
        document.getElementById("panelAdd")?.classList.remove("hidden");
      } else if (v === "view") {
        document.getElementById("panelView")?.classList.remove("hidden");
        try {
          await refreshAccounts();
        } catch (e) {
          console.error(e);
          if (globalMsg) {
            globalMsg.textContent = "Could not load accounts.";
            globalMsg.classList.remove("hidden");
          }
        }
      } else if (v === "edit") {
        document.getElementById("panelEdit")?.classList.remove("hidden");
        try {
          await refreshAccounts();
        } catch (e) {
          console.error(e);
        }
      } else if (v === "deactivate") {
        document.getElementById("panelDeactivate")?.classList.remove("hidden");
        try {
          await refreshAccounts();
        } catch (e) {
          console.error(e);
        }
      }
    });
  }

  wireAccountsViewControls();

  const btnDeactivate = document.getElementById("btnDeactivate");
  const deactMessage = document.getElementById("deactMessage");
  if (btnDeactivate) {
    btnDeactivate.addEventListener("click", async () => {
      const sel = document.getElementById("deactPick");
      const id = sel?.value;
      if (!id) {
        if (deactMessage) {
          deactMessage.textContent = "Select an account.";
          deactMessage.classList.remove("hidden");
        }
        return;
      }
      if (!window.confirm("Deactivate this account? (Only allowed when balance is 0 or less.)")) return;
      try {
        const res = await fetch(`${API_BASE_URL}/admin/accounts/${id}/deactivate`, {
          method: "POST",
          headers: auditHeaders(false),
        });
        const text = await res.text();
        if (deactMessage) {
          deactMessage.textContent = text;
          deactMessage.classList.remove("hidden", "error-text", "success-text");
          deactMessage.classList.add(res.ok ? "success-text" : "error-text");
        }
        if (res.ok) await refreshAccounts();
      } catch (err) {
        console.error(err);
        if (deactMessage) {
          deactMessage.textContent = "Could not reach backend.";
          deactMessage.classList.remove("hidden");
          deactMessage.classList.add("error-text");
        }
      }
    });
  }
}
