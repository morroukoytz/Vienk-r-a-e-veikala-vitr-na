/*
 * api.js - small helper layer for talking to the backend API.
 *
 * Every page loads this file first. It provides:
 *   - apiRequest()      one function for all HTTP calls (GET/POST/PUT/PATCH/DELETE)
 *   - Auth              keeps the login token in localStorage
 *   - helper functions  escapeHtml, formatPrice, formatDate, showMessage
 *
 * All requests go to "/api/..." on the SAME address as the page.
 * nginx forwards them to the backend container (see 04_docker/nginx.conf).
 */

const API_BASE = "/api";

/* Error object that also keeps the list of field errors from the server */
class ApiError extends Error {
  constructor(message, status, fieldErrors) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors || []; // [{field: "price", message: "..."}]
  }
}

/* --------------------------------------------------------------------- */
/* Login token storage                                                    */
/* --------------------------------------------------------------------- */
const Auth = {
  getToken() {
    return localStorage.getItem("authToken");
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem("authUser"));
    } catch (e) {
      return null;
    }
  },
  save(token, user) {
    localStorage.setItem("authToken", token);
    localStorage.setItem("authUser", JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
  },
};

/* --------------------------------------------------------------------- */
/* Main request function                                                  */
/* --------------------------------------------------------------------- */
async function apiRequest(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = Auth.getToken();
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }

  let response;
  try {
    response = await fetch(API_BASE + path, {
      method: method,
      headers: headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new ApiError("Cannot reach the server. Please check that the backend is running.", 0);
  }

  // Try to read JSON (some error pages may not be JSON)
  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  if (!response.ok) {
    const message = (data && data.detail) || "Request failed (HTTP " + response.status + ").";
    throw new ApiError(message, response.status, data && data.errors);
  }
  return data;
}

/* Shortcuts so the code in other files is easier to read */
const api = {
  get: (path) => apiRequest("GET", path),
  post: (path, body) => apiRequest("POST", path, body),
  put: (path, body) => apiRequest("PUT", path, body),
  patch: (path, body) => apiRequest("PATCH", path, body),
  delete: (path) => apiRequest("DELETE", path),
};

/* --------------------------------------------------------------------- */
/* Helper functions used on all pages                                    */
/* --------------------------------------------------------------------- */

/* Protects against XSS: text from the database is never inserted as HTML */
function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let shopCurrency = "EUR";

function formatPrice(value) {
  const number = Number(value) || 0;
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: shopCurrency }).format(number);
  } catch (e) {
    return number.toFixed(2) + " " + shopCurrency;
  }
}

function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleString("en-GB", {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

/* Shows a coloured message box. type = "success" | "error" | "info" */
function showMessage(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.className = "message message-" + (type || "info");
  element.hidden = !text;
}

/* Shows field errors from the server next to the matching inputs.
 * Inputs must have the attribute data-field="price" etc.,
 * and an element with class "field-error" inside the same .form-row. */
function showFieldErrors(form, fieldErrors) {
  clearFieldErrors(form);
  (fieldErrors || []).forEach(function (error) {
    const input = form.querySelector('[data-field="' + error.field + '"]');
    if (!input) return;
    input.classList.add("invalid");
    const holder = input.closest(".form-row").querySelector(".field-error");
    if (holder) holder.textContent = error.message;
  });
}

function clearFieldErrors(form) {
  form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
  form.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
}

/* Loads the shop name and currency for the header (public settings) */
async function loadShopSettings() {
  try {
    const settings = await api.get("/settings");
    if (settings.currency) shopCurrency = settings.currency;
    document.querySelectorAll("[data-store-name]").forEach(function (el) {
      el.textContent = settings.store_name || "Simple Catalogue Shop";
    });
    document.querySelectorAll("[data-contact-email]").forEach(function (el) {
      el.textContent = settings.contact_email || "";
    });
  } catch (e) {
    // Not critical - the page still works with default values
  }
}
