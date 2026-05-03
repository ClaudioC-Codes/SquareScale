/**
 * Admin Add User page only: POST /admin/users. Requires ADMIN role.
 */
(function enforceAdminAddUserOnly() {
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

if (form && passwordInput) {
  passwordInput.addEventListener("input", function () {
    showPasswordError(validatePassword(passwordInput.value));
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    showPasswordError(null);
    if (messageEl) {
      messageEl.classList.add("hidden");
      messageEl.textContent = "";
    }

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
