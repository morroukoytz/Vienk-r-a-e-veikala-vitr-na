/*
 * admin.js - logic of the admin panel (admin.html).
 *
 * Sections (tabs):
 *   Dashboard     summary numbers, latest orders, low stock
 *   Products      list + search + status filter, create / edit / archive
 *   Categories    create / edit / delete
 *   Orders        list + search + status filter, details, status change
 *   Users & audit (administrator only)
 *   Settings      (administrator only)
 *
 * Roles:
 *   admin    - everything
 *   standard - products (no archiving), categories (no deleting), orders, dashboard
 */

let categoriesCache = [];
let productsCache = [];
let filterTimer = null;

const ORDER_STATUSES = ["new", "confirmed", "shipped", "completed", "cancelled"];

function isAdmin() {
  const user = Auth.getUser();
  return user && user.role === "admin";
}

function adminMessage(text, type) {
  showMessage(document.getElementById("admin-message"), text, type);
  if (text) window.scrollTo({ top: 0, behavior: "smooth" });
}

/* Common handling of an API error: if the login expired -> back to login */
function handleError(error) {
  if (error.status === 401) {
    Auth.clear();
    showLogin("Your session has expired. Please log in again.");
    return;
  }
  adminMessage(error.message, "error");
}

function statusBadge(status) {
  return '<span class="status status-' + escapeHtml(status) + '">' + escapeHtml(status) + "</span>";
}

function emptyState(title, text) {
  return '<div class="empty-state"><h3>' + escapeHtml(title) + "</h3><p>" + escapeHtml(text) + "</p></div>";
}

/* ===================================================================== */
/* Login / logout                                                         */
/* ===================================================================== */
function showLogin(message) {
  document.getElementById("admin-section").hidden = true;
  document.getElementById("login-section").hidden = false;
  document.getElementById("current-user").hidden = true;
  document.getElementById("logout-btn").hidden = true;
  showMessage(document.getElementById("login-message"), message || "", "error");
}

function showPanel() {
  const user = Auth.getUser();
  document.getElementById("login-section").hidden = true;
  document.getElementById("admin-section").hidden = false;
  const userLabel = document.getElementById("current-user");
  userLabel.textContent = user.full_name + " (" + user.role + ")";
  userLabel.hidden = false;
  document.getElementById("logout-btn").hidden = false;

  // Hide administrator-only tabs from standard users
  document.querySelectorAll(".admin-only").forEach((el) => (el.hidden = !isAdmin()));
  openTab("dashboard");
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.target;
  const email = form.querySelector("#login-email").value.trim();
  const password = form.querySelector("#login-password").value;
  const messageBox = document.getElementById("login-message");

  const errors = [];
  if (!email) errors.push({ field: "email", message: "Please enter your e-mail." });
  if (!password) errors.push({ field: "password", message: "Please enter your password." });
  showFieldErrors(form, errors);
  if (errors.length) return;

  try {
    const result = await api.post("/auth/login", { email: email, password: password });
    Auth.save(result.token, result.user);
    form.reset();
    showMessage(messageBox, "", "info");
    showPanel();
  } catch (error) {
    showMessage(messageBox, error.message, "error");
  }
}

function logout() {
  Auth.clear();
  // Reload the page so that no data of the previous user stays on the screen
  window.location.reload();
}

/* ===================================================================== */
/* Tabs                                                                   */
/* ===================================================================== */
function openTab(name) {
  adminMessage("", "info");
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((panel) => (panel.hidden = panel.id !== "tab-" + name));

  if (name === "dashboard") loadDashboard();
  if (name === "products") loadAdminProducts();
  if (name === "categories") loadAdminCategories();
  if (name === "orders") loadOrders();
  if (name === "system") loadSystem();
  if (name === "settings") loadSettingsForm();
}

/* ===================================================================== */
/* Dashboard                                                              */
/* ===================================================================== */
async function loadDashboard() {
  try {
    const data = await api.get("/dashboard");
    const p = data.products_by_status;
    const o = data.orders_by_status;
    const stats = [
      ["Products", data.products_total, (p.active || 0) + " active, " + (p.draft || 0) + " draft, " + (p.archived || 0) + " archived"],
      ["Categories", data.categories_count, "product groups"],
      ["Orders", data.orders_total, (o.new || 0) + " new, " + (o.confirmed || 0) + " confirmed, " + (o.shipped || 0) + " shipped"],
      ["Revenue (simulated)", formatPrice(data.total_revenue), "all orders except cancelled"],
    ];
    document.getElementById("stats-grid").innerHTML = stats
      .map((s) =>
        '<div class="stat-card"><span class="stat-label">' + s[0] + '</span><strong class="stat-value">' +
        escapeHtml(s[1]) + '</strong><span class="stat-note">' + escapeHtml(s[2]) + "</span></div>")
      .join("");

    document.getElementById("latest-orders").innerHTML = data.latest_orders.length
      ? '<table class="table"><thead><tr><th>#</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>' +
        data.latest_orders
          .map((order) =>
            "<tr><td>" + order.id + "</td><td>" + escapeHtml(order.customer_name) + "</td><td>" +
            formatPrice(order.total_amount) + "</td><td>" + statusBadge(order.status) + "</td></tr>")
          .join("") + "</tbody></table>"
      : emptyState("No orders yet", "Orders sent from the catalogue will appear here.");

    document.getElementById("low-stock-threshold").textContent = "(stock <= " + data.low_stock_threshold + ")";
    document.getElementById("low-stock").innerHTML = data.low_stock_products.length
      ? '<table class="table"><thead><tr><th>Product</th><th>SKU</th><th>Stock</th></tr></thead><tbody>' +
        data.low_stock_products
          .map((item) =>
            "<tr><td>" + escapeHtml(item.name) + "</td><td>" + escapeHtml(item.sku) + "</td><td>" + item.stock + "</td></tr>")
          .join("") + "</tbody></table>"
      : emptyState("All good", "No active products with low stock.");
  } catch (error) {
    handleError(error);
  }
}

/* ===================================================================== */
/* Products                                                               */
/* ===================================================================== */
async function loadCategoriesCache() {
  categoriesCache = await api.get("/categories");
  const select = document.getElementById("product-category");
  select.innerHTML =
    '<option value="">- choose a category -</option>' +
    categoriesCache.map((c) => '<option value="' + c.id + '">' + escapeHtml(c.name) + "</option>").join("");
}

async function loadAdminProducts() {
  const search = document.getElementById("admin-product-search").value.trim();
  const status = document.getElementById("admin-product-status").value;
  const params = new URLSearchParams({ status: status, sort: "newest" });
  if (search) params.set("search", search);

  try {
    await loadCategoriesCache();
    productsCache = await api.get("/products?" + params.toString());
  } catch (error) {
    handleError(error);
    return;
  }

  const holder = document.getElementById("products-table");
  if (productsCache.length === 0) {
    holder.innerHTML = emptyState("No products found", "Change the filters or create a new product.");
    return;
  }
  holder.innerHTML =
    '<table class="table"><thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Price</th>' +
    "<th>Stock</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>" +
    productsCache
      .map(function (p) {
        return (
          "<tr>" +
          '<td><a href="product.html?id=' + p.id + '">' + escapeHtml(p.name) + "</a></td>" +
          "<td>" + escapeHtml(p.sku) + "</td>" +
          "<td>" + escapeHtml(p.category_name) + "</td>" +
          "<td>" + formatPrice(p.price) + "</td>" +
          "<td>" + p.stock + "</td>" +
          "<td>" + statusBadge(p.status) + "</td>" +
          "<td>" + formatDate(p.updated_at) + "</td>" +
          '<td class="actions">' +
          '<button type="button" class="btn btn-small" data-edit-product="' + p.id + '">Edit</button>' +
          (isAdmin() && p.status !== "archived"
            ? '<button type="button" class="btn btn-small btn-danger" data-archive-product="' + p.id + '">Archive</button>'
            : "") +
          "</td></tr>"
        );
      })
      .join("") +
    "</tbody></table>";
}

function openProductForm(product) {
  const form = document.getElementById("product-form");
  form.reset();
  clearFieldErrors(form);
  document.getElementById("product-form-card").hidden = false;
  document.getElementById("product-form-title").textContent = product ? "Edit product #" + product.id : "New product";
  document.getElementById("product-id").value = product ? product.id : "";

  // Standard users cannot choose "archived" (archiving = deleting)
  const archivedOption = document.querySelector('#product-status option[value="archived"]');
  archivedOption.disabled = !isAdmin() && !(product && product.status === "archived");

  if (product) {
    document.getElementById("product-name").value = product.name;
    document.getElementById("product-sku").value = product.sku;
    document.getElementById("product-category").value = product.category_id;
    document.getElementById("product-status").value = product.status;
    document.getElementById("product-price").value = product.price;
    document.getElementById("product-stock").value = product.stock;
    document.getElementById("product-description").value = product.description;
  }
  document.getElementById("product-name").focus();
}

function closeProductForm() {
  document.getElementById("product-form-card").hidden = true;
}

/* Client-side checks. The server repeats all checks, this is only for comfort. */
function validateProduct(values) {
  const errors = [];
  if (values.name.length < 2) errors.push({ field: "name", message: "Name must have at least 2 characters." });
  if (!/^[A-Za-z0-9-]{3,40}$/.test(values.sku))
    errors.push({ field: "sku", message: "SKU: 3-40 characters, only letters, digits and '-'." });
  if (!values.category_id) errors.push({ field: "category_id", message: "Please choose a category." });
  if (!(values.price > 0) || values.price > 100000 || !/^\d+(\.\d{1,2})?$/.test(String(values.price)))
    errors.push({ field: "price", message: "Price must be a positive number with max. 2 decimals (up to 100000)." });
  if (!Number.isInteger(values.stock) || values.stock < 0 || values.stock > 100000)
    errors.push({ field: "stock", message: "Stock must be a whole number from 0 to 100000." });
  return errors;
}

async function saveProduct(event) {
  event.preventDefault();
  const form = event.target;
  const id = document.getElementById("product-id").value;
  const priceText = document.getElementById("product-price").value.trim();
  const stockText = document.getElementById("product-stock").value.trim();

  const values = {
    name: document.getElementById("product-name").value.trim(),
    sku: document.getElementById("product-sku").value.trim().toUpperCase(),
    category_id: Number(document.getElementById("product-category").value) || null,
    status: document.getElementById("product-status").value,
    price: priceText === "" ? NaN : Number(priceText),
    stock: stockText === "" ? NaN : Number(stockText),
    description: document.getElementById("product-description").value.trim(),
  };

  const errors = validateProduct(values);
  showFieldErrors(form, errors);
  if (errors.length) {
    adminMessage("Please correct the highlighted fields.", "error");
    return;
  }

  try {
    if (id) {
      await api.put("/products/" + id, values);
      adminMessage("Product updated.", "success");
    } else {
      await api.post("/products", values);
      adminMessage("Product created.", "success");
    }
    closeProductForm();
    loadAdminProducts();
  } catch (error) {
    showFieldErrors(form, error.fieldErrors);
    handleError(error);
  }
}

async function archiveProduct(id) {
  const product = productsCache.find((p) => String(p.id) === String(id));
  if (!confirm('Archive "' + product.name + '"? It will disappear from the public catalogue.')) return;
  try {
    await api.delete("/products/" + id);
    adminMessage("Product archived.", "success");
    loadAdminProducts();
  } catch (error) {
    handleError(error);
  }
}

/* ===================================================================== */
/* Categories                                                             */
/* ===================================================================== */
async function loadAdminCategories() {
  try {
    await loadCategoriesCache();
  } catch (error) {
    handleError(error);
    return;
  }
  const holder = document.getElementById("categories-table");
  if (categoriesCache.length === 0) {
    holder.innerHTML = emptyState("No categories yet", "Create the first category with the form above.");
    return;
  }
  holder.innerHTML =
    '<table class="table"><thead><tr><th>Name</th><th>Description</th><th>Products</th>' +
    "<th>Updated</th><th>Actions</th></tr></thead><tbody>" +
    categoriesCache
      .map(
        (c) =>
          "<tr><td>" + escapeHtml(c.name) + "</td><td>" + escapeHtml(c.description) + "</td><td>" +
          c.active_products + " active / " + c.total_products + " total</td><td>" + formatDate(c.updated_at) +
          '</td><td class="actions"><button type="button" class="btn btn-small" data-edit-category="' + c.id + '">Edit</button>' +
          (isAdmin()
            ? '<button type="button" class="btn btn-small btn-danger" data-delete-category="' + c.id + '">Delete</button>'
            : "") +
          "</td></tr>"
      )
      .join("") +
    "</tbody></table>";
}

function editCategory(id) {
  const category = categoriesCache.find((c) => String(c.id) === String(id));
  document.getElementById("category-id").value = category.id;
  document.getElementById("category-name").value = category.name;
  document.getElementById("category-description").value = category.description;
  document.getElementById("category-form-title").textContent = "Edit category #" + category.id;
  document.getElementById("cancel-category-btn").hidden = false;
  document.getElementById("category-name").focus();
}

function resetCategoryForm() {
  const form = document.getElementById("category-form");
  form.reset();
  clearFieldErrors(form);
  document.getElementById("category-id").value = "";
  document.getElementById("category-form-title").textContent = "New category";
  document.getElementById("cancel-category-btn").hidden = true;
}

async function saveCategory(event) {
  event.preventDefault();
  const form = event.target;
  const id = document.getElementById("category-id").value;
  const values = {
    name: document.getElementById("category-name").value.trim(),
    description: document.getElementById("category-description").value.trim(),
  };
  const errors = values.name.length < 2 ? [{ field: "name", message: "Name must have at least 2 characters." }] : [];
  showFieldErrors(form, errors);
  if (errors.length) return;

  try {
    if (id) {
      await api.put("/categories/" + id, values);
      adminMessage("Category updated.", "success");
    } else {
      await api.post("/categories", values);
      adminMessage("Category created.", "success");
    }
    resetCategoryForm();
    loadAdminCategories();
  } catch (error) {
    showFieldErrors(form, error.fieldErrors);
    handleError(error);
  }
}

async function deleteCategory(id) {
  const category = categoriesCache.find((c) => String(c.id) === String(id));
  if (!confirm('Delete category "' + category.name + '"?')) return;
  try {
    await api.delete("/categories/" + id);
    adminMessage("Category deleted.", "success");
    loadAdminCategories();
  } catch (error) {
    handleError(error);
  }
}

/* ===================================================================== */
/* Orders                                                                 */
/* ===================================================================== */
async function loadOrders() {
  const search = document.getElementById("order-search").value.trim();
  const status = document.getElementById("order-status-filter").value;
  const params = new URLSearchParams({ status: status });
  if (search) params.set("search", search);

  let orders;
  try {
    orders = await api.get("/orders?" + params.toString());
  } catch (error) {
    handleError(error);
    return;
  }
  const holder = document.getElementById("orders-table");
  if (orders.length === 0) {
    holder.innerHTML = emptyState("No orders found", "There are no orders for the selected filters.");
    return;
  }
  holder.innerHTML =
    '<table class="table"><thead><tr><th>#</th><th>Customer</th><th>E-mail</th><th>Items</th>' +
    "<th>Total</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>" +
    orders
      .map(
        (o) =>
          "<tr><td>" + o.id + "</td><td>" + escapeHtml(o.customer_name) + "</td><td>" + escapeHtml(o.customer_email) +
          "</td><td>" + o.items_count + "</td><td>" + formatPrice(o.total_amount) + "</td><td>" + statusBadge(o.status) +
          "</td><td>" + formatDate(o.created_at) + '</td><td><button type="button" class="btn btn-small" data-view-order="' +
          o.id + '">Details</button></td></tr>'
      )
      .join("") +
    "</tbody></table>";
}

async function showOrderDetails(id) {
  const box = document.getElementById("order-details");
  let order;
  try {
    order = await api.get("/orders/" + id);
  } catch (error) {
    handleError(error);
    return;
  }
  const isFinal = order.status === "completed" || order.status === "cancelled";
  box.innerHTML =
    '<div class="panel-header"><h2>Order #' + order.id + " " + statusBadge(order.status) + "</h2>" +
    '<button type="button" class="btn btn-small btn-secondary" id="close-order-btn">Close</button></div>' +
    '<dl class="details-list">' +
    "<dt>Customer</dt><dd>" + escapeHtml(order.customer_name) + "</dd>" +
    "<dt>E-mail</dt><dd>" + escapeHtml(order.customer_email) + "</dd>" +
    "<dt>Phone</dt><dd>" + (escapeHtml(order.customer_phone) || "-") + "</dd>" +
    "<dt>Address</dt><dd>" + escapeHtml(order.shipping_address) + "</dd>" +
    "<dt>Comment</dt><dd>" + (escapeHtml(order.comment) || "-") + "</dd>" +
    "<dt>Created</dt><dd>" + formatDate(order.created_at) + "</dd>" +
    "<dt>Updated</dt><dd>" + formatDate(order.updated_at) + "</dd>" +
    "</dl>" +
    '<div class="table-wrap"><table class="table"><thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Line total</th></tr></thead><tbody>' +
    order.items
      .map(
        (i) =>
          "<tr><td>" + escapeHtml(i.product_name) + "</td><td>" + formatPrice(i.unit_price) + "</td><td>" +
          i.quantity + "</td><td>" + formatPrice(i.line_total) + "</td></tr>"
      )
      .join("") +
    '</tbody><tfoot><tr><th colspan="3">Total</th><th>' + formatPrice(order.total_amount) + "</th></tr></tfoot></table></div>" +
    (isFinal
      ? '<p class="hint">This order is ' + escapeHtml(order.status) + " and can no longer be changed.</p>"
      : '<div class="toolbar"><div class="form-row"><label for="new-order-status">Change status</label>' +
        '<select id="new-order-status">' +
        ORDER_STATUSES.map(
          (s) => '<option value="' + s + '"' + (s === order.status ? " selected" : "") + ">" + s + "</option>"
        ).join("") +
        '</select></div><button type="button" class="btn btn-primary" id="save-order-status-btn" data-order-id="' +
        order.id + '">Save status</button></div>' +
        '<p class="hint">Cancelling an order returns its items to stock.</p>');
  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth" });
}

async function saveOrderStatus(orderId) {
  const status = document.getElementById("new-order-status").value;
  if (status === "cancelled" && !confirm("Cancel order #" + orderId + "? This cannot be undone.")) return;
  try {
    await api.patch("/orders/" + orderId + "/status", { status: status });
    adminMessage("Order #" + orderId + " status changed to " + status + ".", "success");
    loadOrders();
    showOrderDetails(orderId);
  } catch (error) {
    handleError(error);
  }
}

/* ===================================================================== */
/* Users & audit log, Settings (administrator only)                      */
/* ===================================================================== */
async function loadSystem() {
  try {
    const [users, logs] = await Promise.all([api.get("/users"), api.get("/audit-logs?limit=50")]);
    document.getElementById("users-table").innerHTML =
      '<table class="table"><thead><tr><th>#</th><th>Name</th><th>E-mail</th><th>Role</th><th>Active</th><th>Created</th></tr></thead><tbody>' +
      users
        .map(
          (u) =>
            "<tr><td>" + u.id + "</td><td>" + escapeHtml(u.full_name) + "</td><td>" + escapeHtml(u.email) + "</td><td>" +
            escapeHtml(u.role) + "</td><td>" + (u.is_active ? "yes" : "no") + "</td><td>" + formatDate(u.created_at) + "</td></tr>"
        )
        .join("") +
      "</tbody></table>";

    document.getElementById("audit-table").innerHTML = logs.length
      ? '<table class="table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th></tr></thead><tbody>' +
        logs
          .map(
            (l) =>
              "<tr><td>" + formatDate(l.created_at) + "</td><td>" + escapeHtml(l.user_email) + "</td><td>" +
              escapeHtml(l.action) + "</td><td>" + escapeHtml(l.entity_name) + "</td><td>" + (l.entity_id ?? "-") + "</td></tr>"
          )
          .join("") +
        "</tbody></table>"
      : emptyState("No audit records", "Actions will be recorded here.");
  } catch (error) {
    handleError(error);
  }
}

async function loadSettingsForm() {
  try {
    const settings = await api.get("/settings");
    document.getElementById("setting-store-name").value = settings.store_name || "";
    document.getElementById("setting-contact-email").value = settings.contact_email || "";
    document.getElementById("setting-currency").value = settings.currency || "";
    document.getElementById("setting-low-stock").value = settings.low_stock_threshold || "5";
  } catch (error) {
    handleError(error);
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const form = event.target;
  const values = {
    store_name: document.getElementById("setting-store-name").value.trim(),
    contact_email: document.getElementById("setting-contact-email").value.trim(),
    currency: document.getElementById("setting-currency").value.trim().toUpperCase(),
    low_stock_threshold: Number(document.getElementById("setting-low-stock").value),
  };
  const errors = [];
  if (values.store_name.length < 2) errors.push({ field: "store_name", message: "At least 2 characters." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.contact_email))
    errors.push({ field: "contact_email", message: "Please enter a valid e-mail." });
  if (!/^[A-Z]{3}$/.test(values.currency)) errors.push({ field: "currency", message: "Use a 3-letter code, e.g. EUR." });
  if (!Number.isInteger(values.low_stock_threshold) || values.low_stock_threshold < 0)
    errors.push({ field: "low_stock_threshold", message: "Whole number, 0 or more." });
  showFieldErrors(form, errors);
  if (errors.length) return;

  try {
    await api.put("/settings", values);
    adminMessage("Settings saved.", "success");
    loadShopSettings();
  } catch (error) {
    showFieldErrors(form, error.fieldErrors);
    handleError(error);
  }
}

/* ===================================================================== */
/* Start-up: connect all event handlers                                  */
/* ===================================================================== */
document.addEventListener("DOMContentLoaded", async function () {
  await loadShopSettings();

  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("tabs").addEventListener("click", function (event) {
    const tab = event.target.closest(".tab");
    if (tab) openTab(tab.dataset.tab);
  });

  // Products
  document.getElementById("new-product-btn").addEventListener("click", () => openProductForm(null));
  document.getElementById("cancel-product-btn").addEventListener("click", closeProductForm);
  document.getElementById("product-form").addEventListener("submit", saveProduct);
  document.getElementById("admin-product-status").addEventListener("change", loadAdminProducts);
  document.getElementById("admin-product-search").addEventListener("input", function () {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(loadAdminProducts, 300);
  });
  document.getElementById("products-table").addEventListener("click", function (event) {
    const edit = event.target.closest("[data-edit-product]");
    const archive = event.target.closest("[data-archive-product]");
    if (edit) openProductForm(productsCache.find((p) => String(p.id) === edit.dataset.editProduct));
    if (archive) archiveProduct(archive.dataset.archiveProduct);
  });

  // Categories
  document.getElementById("category-form").addEventListener("submit", saveCategory);
  document.getElementById("cancel-category-btn").addEventListener("click", resetCategoryForm);
  document.getElementById("categories-table").addEventListener("click", function (event) {
    const edit = event.target.closest("[data-edit-category]");
    const del = event.target.closest("[data-delete-category]");
    if (edit) editCategory(edit.dataset.editCategory);
    if (del) deleteCategory(del.dataset.deleteCategory);
  });

  // Orders
  document.getElementById("order-status-filter").addEventListener("change", loadOrders);
  document.getElementById("order-search").addEventListener("input", function () {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(loadOrders, 300);
  });
  document.getElementById("orders-table").addEventListener("click", function (event) {
    const view = event.target.closest("[data-view-order]");
    if (view) showOrderDetails(view.dataset.viewOrder);
  });
  document.getElementById("order-details").addEventListener("click", function (event) {
    if (event.target.id === "close-order-btn") document.getElementById("order-details").hidden = true;
    if (event.target.id === "save-order-status-btn") saveOrderStatus(event.target.dataset.orderId);
  });

  // Settings
  document.getElementById("settings-form").addEventListener("submit", saveSettings);

  // Already logged in? Check that the saved token is still valid.
  if (Auth.getToken()) {
    try {
      const user = await api.get("/auth/me");
      Auth.save(Auth.getToken(), user);
      showPanel();
      return;
    } catch (error) {
      Auth.clear();
    }
  }
  showLogin("");
});
