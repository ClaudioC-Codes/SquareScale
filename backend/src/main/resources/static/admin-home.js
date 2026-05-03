/**
 * Admin home: Add User (POST /admin/users), All Users table with Activate/Deactivate/Suspend/Send Email/Edit,
 * Expired Passwords report, and Edit User modal (PUT /admin/users/{id}). Password rules enforced on add/edit.
 */
(function enforceAdminHomeOnly() {
  try {
    const raw = sessionStorage.getItem("user");
    const u = raw ? JSON.parse(raw) : null;
    const r = u ? String(u.role || "").toUpperCase() : "";
    if (!u || r !== "ADMIN") {
      if (r === "MANAGER") window.location.replace("manager-home.html");
      else if (r === "USER") window.location.replace("regular-user-home.html");
      else window.location.replace("index.html");
    }
  } catch {
    window.location.replace("index.html");
  }
})();

const API_BASE_URL = "http://localhost:8080";

/** Password rules: min 8 chars, start with letter, at least one letter/number/special. Returns error string or null. */
function validatePassword(password) {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/^[a-zA-Z]/.test(password)) {
    return "Password must start with a letter.";
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "Password must contain at least one letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return "Password must contain at least one special character.";
  }
  return null;
}

const form = document.getElementById("addUserForm");
const passwordInput = document.getElementById("addPassword");
const passwordError = document.getElementById("addPasswordError");
const messageEl = document.getElementById("addUserMessage");

function showMessage(text, isError) {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.classList.remove("hidden", "error-text", "success-text");
  messageEl.classList.add(isError ? "error-text" : "success-text");
  messageEl.classList.remove("hidden");
}

function showPasswordError(text) {
  if (!passwordError) return;
  passwordError.textContent = text || "";
  passwordError.classList.toggle("hidden", !text);
}

if (form) {
  passwordInput.addEventListener("input", function () {
    showPasswordError(validatePassword(passwordInput.value));
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    showPasswordError(null);
    showMessage("");

    const firstName = document.getElementById("addFirstName").value.trim();
    const lastName = document.getElementById("addLastName").value.trim();
    const email = document.getElementById("addEmail").value.trim();
    const password = document.getElementById("addPassword").value;
    const role = document.getElementById("addRole").value;

    const pwdErr = validatePassword(password);
    if (pwdErr) {
      showPasswordError(pwdErr);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          role
        })
      });
      const text = await res.text();
      if (res.ok) {
        showMessage(text || "User created successfully.", false);
        form.reset();
        showPasswordError(null);
      } else {
        showMessage(text || "Failed to create user.", true);
      }
    } catch (err) {
      console.error(err);
      showMessage("Could not reach backend. Make sure the server is running on port 8080.", true);
    }
  });
}

// ----- All Users table and Expired Passwords report -----

const userTableBody = document.querySelector("#userTable tbody");
const expiredTableBody = document.querySelector("#expiredTable tbody");

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request to ${url} failed with status ${res.status}`);
  }
  return res.json();
}

function renderUsers(users) {
  if (!userTableBody) return;
  userTableBody.innerHTML = "";
  users.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.username}</td>
      <td>${u.role}</td>
      <td>${u.email}</td>
      <td>${u.active ? "Yes" : "No"}</td>
      <td>${u.suspendedUntil ? u.suspendedUntil : "-"}</td>
      <td>
        <button type="button" class="btn-small" data-action="activate" data-id="${u.id}">Activate</button>
        <button type="button" class="btn-small" data-action="deactivate" data-id="${u.id}">Deactivate</button>
        <button type="button" class="btn-small" data-action="suspend" data-id="${u.id}">Suspend</button>
        <button type="button" class="btn-small btn-email" data-action="email" data-id="${u.id}" data-username="${(u.username || '').replace(/"/g, '&quot;')}">Send Email</button>
        <button type="button" class="btn-small" data-action="edit" data-id="${u.id}" data-firstname="${(u.firstName || '').replace(/"/g, '&quot;')}" data-lastname="${(u.lastName || '').replace(/"/g, '&quot;')}" data-email="${(u.email || '').replace(/"/g, '&quot;')}" data-role="${u.role || ''}">Edit</button>
      </td>
    `;
    userTableBody.appendChild(tr);
  });
}

function renderExpired(users) {
  if (!expiredTableBody) return;
  expiredTableBody.innerHTML = "";
  users.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.username}</td>
      <td>${u.email}</td>
      <td>${u.passwordLastSet ? u.passwordLastSet : "-"}</td>
    `;
    expiredTableBody.appendChild(tr);
  });
}

async function refreshAdminData() {
  try {
    const [users, expired] = await Promise.all([
      fetchJson(`${API_BASE_URL}/admin/users`),
      fetchJson(`${API_BASE_URL}/admin/users/expired-passwords`)
    ]);
    renderUsers(users);
    renderExpired(expired);
  } catch (e) {
    console.error(e);
  }
}

async function postNoBody(url) {
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with status ${res.status}`);
  }
}

if (userTableBody) {
  userTableBody.addEventListener("click", async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const action = target.getAttribute("data-action");
    const id = target.getAttribute("data-id");
    if (!action || !id) return;

    try {
      if (action === "activate") {
        await postNoBody(`${API_BASE_URL}/admin/users/${id}/activate`);
        alert("User has been activated.");
      } else if (action === "deactivate") {
        await postNoBody(`${API_BASE_URL}/admin/users/${id}/deactivate`);
        alert("User has been deactivated.");
      } else if (action === "suspend") {
        const start = prompt("Enter suspension start date/time (YYYY-MM-DDTHH:MM), or leave blank for now:", "");
        const until = prompt("Enter suspension end date/time (YYYY-MM-DDTHH:MM):", "");
        if (!until) return;
        const startParam = start && start.trim() !== "" ? start.trim() : new Date().toISOString().slice(0,16);
        const url = `${API_BASE_URL}/admin/users/${id}/suspend?startDateTime=${encodeURIComponent(startParam)}&untilDateTime=${encodeURIComponent(until.trim())}`;
        await postNoBody(url);
        alert("User has been suspended.");
      } else if (action === "email") {
        const username = target.getAttribute("data-username") || "User";
        const message = prompt("Enter the email message to send to " + username + ":", "");
        if (message == null || message.trim() === "") return;
        const res = await fetch(`${API_BASE_URL}/admin/users/${id}/send-email?message=${encodeURIComponent(message.trim())}`, { method: "POST" });
        if (!res.ok) throw new Error(await res.text());
        alert("Email sent (simulated in server console).");
      } else if (action === "edit") {
        openEditModal({
          id,
          firstName: target.getAttribute("data-firstname") || "",
          lastName: target.getAttribute("data-lastname") || "",
          email: target.getAttribute("data-email") || "",
          role: target.getAttribute("data-role") || "USER"
        });
        return;
      }
      await refreshAdminData();
    } catch (err) {
      console.error(err);
      alert(err.message || "Something went wrong.");
    }
  });
}

// ----- Edit User modal: load current user, submit PUT with optional newPassword -----
const editModal = document.getElementById("editUserModal");
const editUserForm = document.getElementById("editUserForm");
const editUserCancel = document.getElementById("editUserCancel");
const editUserMessage = document.getElementById("editUserMessage");
const editPasswordError = document.getElementById("editPasswordError");

function openEditModal(user) {
  if (!editModal) return;
  document.getElementById("editUserId").value = user.id;
  document.getElementById("editFirstName").value = user.firstName || "";
  document.getElementById("editLastName").value = user.lastName || "";
  document.getElementById("editEmail").value = user.email || "";
  document.getElementById("editRole").value = user.role || "USER";
  document.getElementById("editNewPassword").value = "";
  editPasswordError.classList.add("hidden");
  editUserMessage.classList.add("hidden");
  editModal.classList.remove("hidden");
}

function closeEditModal() {
  if (editModal) editModal.classList.add("hidden");
}

if (editUserCancel) editUserCancel.addEventListener("click", closeEditModal);

if (editUserForm) {
  editUserForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const id = document.getElementById("editUserId").value;
    const firstName = document.getElementById("editFirstName").value.trim();
    const lastName = document.getElementById("editLastName").value.trim();
    const email = document.getElementById("editEmail").value.trim();
    const role = document.getElementById("editRole").value;
    const newPassword = document.getElementById("editNewPassword").value;
    editPasswordError.classList.add("hidden");
    editUserMessage.classList.add("hidden");
    const pwdErr = newPassword ? validatePassword(newPassword) : null;
    if (pwdErr) {
      editPasswordError.textContent = pwdErr;
      editPasswordError.classList.remove("hidden");
      return;
    }
    const body = { firstName, lastName, email, role };
    if (newPassword && newPassword.trim()) body.newPassword = newPassword.trim();
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const text = await res.text();
      if (res.ok) {
        alert("User updated.");
        closeEditModal();
        refreshAdminData();
      } else {
        editUserMessage.textContent = text || "Update failed.";
        editUserMessage.classList.remove("hidden");
        editUserMessage.classList.add("error-text");
      }
    } catch (err) {
      editUserMessage.textContent = err.message || "Request failed.";
      editUserMessage.classList.remove("hidden");
      editUserMessage.classList.add("error-text");
    }
  });
}

// Initial load of lists when admin page is opened.
refreshAdminData().catch(console.error);
