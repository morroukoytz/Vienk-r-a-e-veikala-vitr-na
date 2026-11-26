/*
 * catalog.js - public catalogue pages.
 *
 * index.html   : product list with search, category filter, sorting, empty-state
 * product.html : details of one product (product.html?id=5)
 *
 * The file checks which elements exist on the page and runs the matching code.
 */

let productsCache = []; // products currently shown (used by "Add to cart")
let searchTimer = null;

/* --------------------------------------------------------------------- */
/* Catalogue list (index.html)                                            */
/* --------------------------------------------------------------------- */
async function loadCategories() {
  const select = document.getElementById("category-select");
  const chips = document.getElementById("category-chips");
  try {
    const categories = await api.get("/categories");
    const visible = categories.filter((c) => c.active_products > 0);

    visible.forEach(function (category) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name + " (" + category.active_products + ")";
      select.appendChild(option);
    });

    chips.innerHTML =
      '<button type="button" class="chip active" data-id="">All</button>' +
      visible
        .map((c) => '<button type="button" class="chip" data-id="' + c.id + '">' + escapeHtml(c.name) + "</button>")
        .join("");
  } catch (error) {
    chips.innerHTML = "";
  }
}

/* Reads the filters, calls the API and draws the cards */
async function loadProducts() {
  const grid = document.getElementById("product-grid");
  const info = document.getElementById("result-info");
  const messageBox = document.getElementById("catalogue-message");
  if (!grid) return;

  const search = document.getElementById("search-input").value.trim();
  const categoryId = document.getElementById("category-select").value;
  const sort = document.getElementById("sort-select").value;

  // URLSearchParams encodes special characters safely
  const params = new URLSearchParams({ sort: sort });
  if (search) params.set("search", search);
  if (categoryId) params.set("category_id", categoryId);

  grid.innerHTML = '<p class="loading">Loading products...</p>';
  showMessage(messageBox, "", "info");

  try {
    productsCache = await api.get("/products?" + params.toString());
  } catch (error) {
    grid.innerHTML = "";
    info.textContent = "";
    showMessage(messageBox, error.message, "error");
    return;
  }

  info.textContent = productsCache.length + " product(s) found";

  // Empty-state: nothing matches the filters
  if (productsCache.length === 0) {
    grid.innerHTML =
      '<div class="empty-state">' +
      "  <h3>No products found</h3>" +
      "  <p>Try another search word or choose a different category.</p>" +
      '  <button type="button" class="btn btn-secondary" id="reset-filters-btn">Reset filters</button>' +
      "</div>";
    document.getElementById("reset-filters-btn").addEventListener("click", resetFilters);
    return;
  }

  grid.innerHTML = productsCache.map(renderProductCard).join("");
}

function renderProductCard(product) {
  const outOfStock = product.stock <= 0;
  return (
    '<article class="product-card">' +
    '  <a href="product.html?id=' + product.id + '" class="product-image" aria-hidden="true" tabindex="-1">' +
    "    <span>" + escapeHtml(product.name.charAt(0)) + "</span>" +
    "  </a>" +
    '  <div class="product-body">' +
    '    <span class="tag">' + escapeHtml(product.category_name) + "</span>" +
    '    <h3><a href="product.html?id=' + product.id + '">' + escapeHtml(product.name) + "</a></h3>" +
    '    <p class="price">' + formatPrice(product.price) + "</p>" +
    '    <p class="stock ' + (outOfStock ? "stock-out" : product.stock <= 5 ? "stock-low" : "") + '">' +
    (outOfStock ? "Out of stock" : product.stock + " in stock") +
    "    </p>" +
    '    <button type="button" class="btn btn-primary btn-block" data-add-id="' + product.id + '"' +
    (outOfStock ? " disabled" : "") + ">Add to cart</button>" +
    "  </div>" +
    "</article>"
  );
}

function resetFilters() {
  document.getElementById("search-input").value = "";
  document.getElementById("category-select").value = "";
  document.getElementById("sort-select").value = "name";
  highlightChip("");
  loadProducts();
}

function highlightChip(categoryId) {
  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.classList.toggle("active", chip.dataset.id === String(categoryId));
  });
}

function initCataloguePage() {
  loadCategories();
  loadProducts();

  // Search: wait 300 ms after the last key press ("debounce")
  document.getElementById("search-input").addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadProducts, 300);
  });

  document.getElementById("category-select").addEventListener("change", function (event) {
    highlightChip(event.target.value);
    loadProducts();
  });
  document.getElementById("sort-select").addEventListener("change", loadProducts);

  document.getElementById("category-chips").addEventListener("click", function (event) {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    document.getElementById("category-select").value = chip.dataset.id;
    highlightChip(chip.dataset.id);
    loadProducts();
  });

  // "Add to cart" buttons on the cards
  document.getElementById("product-grid").addEventListener("click", function (event) {
    const button = event.target.closest("button[data-add-id]");
    if (!button) return;
    const product = productsCache.find((p) => String(p.id) === button.dataset.addId);
    const result = Cart.add(product, 1);
    showMessage(document.getElementById("catalogue-message"), result.text, result.ok ? "success" : "error");
  });
}

/* --------------------------------------------------------------------- */
/* Product details page (product.html?id=...)                             */
/* --------------------------------------------------------------------- */
async function initProductPage() {
  const container = document.getElementById("product-details");
  const messageBox = document.getElementById("product-message");
  const id = new URLSearchParams(window.location.search).get("id");

  // Incorrect input in the address bar, e.g. product.html?id=abc
  if (!id || !/^\d+$/.test(id)) {
    showMessage(messageBox, "Invalid product link. Please choose a product from the catalogue.", "error");
    return;
  }

  let product;
  try {
    product = await api.get("/products/" + id);
  } catch (error) {
    const text = error.status === 404 ? "This product does not exist or is not available." : error.message;
    showMessage(messageBox, text, "error");
    return;
  }

  document.title = product.name + " - Simple E-commerce Catalogue";
  const outOfStock = product.stock <= 0;
  const maxQuantity = Math.min(product.stock, MAX_QUANTITY_PER_LINE);

  container.innerHTML =
    '<div class="product-image large" aria-hidden="true"><span>' + escapeHtml(product.name.charAt(0)) + "</span></div>" +
    '<div class="product-info">' +
    '  <span class="tag">' + escapeHtml(product.category_name) + "</span>" +
    "  <h1>" + escapeHtml(product.name) + "</h1>" +
    '  <p class="price large">' + formatPrice(product.price) + "</p>" +
    '  <p class="description">' + escapeHtml(product.description || "No description yet.") + "</p>" +
    '  <dl class="details-list">' +
    "    <dt>SKU</dt><dd>" + escapeHtml(product.sku) + "</dd>" +
    "    <dt>Availability</dt><dd>" + (outOfStock ? "Out of stock" : product.stock + " in stock") + "</dd>" +
    "    <dt>Added</dt><dd>" + formatDate(product.created_at) + "</dd>" +
    "    <dt>Last update</dt><dd>" + formatDate(product.updated_at) + "</dd>" +
    "  </dl>" +
    '  <div class="add-to-cart-row">' +
    '    <label for="quantity-input">Quantity</label>' +
    '    <input type="number" id="quantity-input" min="1" max="' + maxQuantity + '" value="1"' +
    (outOfStock ? " disabled" : "") + ">" +
    '    <button type="button" class="btn btn-primary" id="add-to-cart-btn"' + (outOfStock ? " disabled" : "") +
    ">Add to cart</button>" +
    "  </div>" +
    '  <div id="add-message" class="message" hidden></div>' +
    "</div>";
  container.hidden = false;

  document.getElementById("add-to-cart-btn").addEventListener("click", function () {
    const addMessage = document.getElementById("add-message");
    const quantity = Number(document.getElementById("quantity-input").value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity) {
      showMessage(addMessage, "Please enter a whole number from 1 to " + maxQuantity + ".", "error");
      return;
    }
    const result = Cart.add(product, quantity);
    showMessage(addMessage, result.text, result.ok ? "success" : "error");
  });
}

/* --------------------------------------------------------------------- */
/* Start-up: decide which page we are on                                  */
/* --------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async function () {
  await loadShopSettings(); // currency and shop name first
  Cart.render();            // redraw prices in the correct currency
  if (document.getElementById("product-grid")) initCataloguePage();
  if (document.getElementById("product-details")) initProductPage();
});
