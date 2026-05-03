/**
 * Login page: submits credentials to /auth/login, then redirects by role
 * (ADMIN -> admin-home, MANAGER -> manager-home, USER -> regular-user-home).
 */
const API_BASE_URL = "http://localhost:8080";

const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("userName");
const passwordInput = document.getElementById("password");
const badge = document.getElementById("loggedInBadge");
const badgeUsername = document.getElementById("loggedInUsername");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      username: usernameInput?.value?.trim(),
      password: passwordInput?.value ?? "",
    };

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text();
        alert(msg || "Login failed");
        return;
      }

      const data = await res.json();

      // Store user for home pages and redirect by role.
      sessionStorage.setItem("user", JSON.stringify({
        userId: data.userId,
        username: data.username,
        role: data.role,
        email: data.email
      }));

      const role = (data.role || "").toUpperCase();
      if (role === "ADMIN") {
        window.location.href = "admin-home.html";
      } else if (role === "MANAGER") {
        window.location.href = "manager-home.html";
      } else {
        window.location.href = "regular-user-home.html";
      }
    } catch (e) {
      console.error(e);
      alert("Could not reach backend. Make sure Spring Boot is running on port 8080.");
    }
  });
}

