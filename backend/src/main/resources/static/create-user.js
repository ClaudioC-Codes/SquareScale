/**
 * Create-user (request access) page: submits first name, last name, address, DOB, email
 * to POST /public/register. Admin is notified (simulated); user sees confirmation message.
 */
const API_BASE_URL = "http://localhost:8080";

const requestForm = document.getElementById("requestAccessForm");
const requestMsg = document.getElementById("requestMessage");

function showRequestMessage(text, isError) {
  if (!requestMsg) return;
  requestMsg.textContent = text;
  requestMsg.classList.remove("hidden", "error-text", "success-text");
  requestMsg.classList.add(isError ? "error-text" : "success-text");
}

if (requestForm) {
  requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      firstName: document.getElementById("firstName").value.trim(),
      lastName: document.getElementById("lastName").value.trim(),
      address: document.getElementById("address").value.trim(),
      dob: document.getElementById("dob").value,
      email: document.getElementById("email").value.trim()
    };

    try {
      const res = await fetch(`${API_BASE_URL}/public/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      if (res.ok) {
        showRequestMessage(text || "Request submitted. An administrator will contact you.", false);
        requestForm.reset();
      } else {
        showRequestMessage(text || "Unable to submit request.", true);
      }
    } catch (err) {
      console.error(err);
      showRequestMessage("Could not reach backend. Make sure the server is running on port 8080.", true);
    }
  });
}

