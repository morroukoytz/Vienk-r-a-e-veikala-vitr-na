/*
 * cart.js - shopping cart SIMULATION and the order request form.
 *
 * The cart lives only in the browser (localStorage), so it survives a page
 * reload. Nothing is paid - on submit the order request is sent to
 * POST /api/orders and the backend calculates the final prices itself.
 *
 * Cart format in localStorage (key "cart"):
 *   { "5": { id: 5, name: "Yoga Mat", price: 22, stock: 15, quantity: 2 }, ... }
 */

const MAX_QUANTITY_PER_LINE = 99;

const Cart = {
  /* Read the cart from localStorage */
  load() {
    try {
      return JSON.parse(localStorage.getItem("cart")) || {};
    } catch (e) {
      return {};
    }
  },

  save(items) {
    localStorage.setItem("cart", JSON.stringify(items));
    Cart.render();
  },

  /* Add a product (or increase its quantity). Returns a message for the user. */
  add(product, quantity) {
    const items = Cart.load();
    const current = items[product.id] ? items[product.id].quantity : 0;
    const limit = Math.min(product.stock, MAX_QUANTITY_PER_LINE);
    const wanted = current + (quantity || 1);

    if (product.stock <= 0) {
      return { ok: false, text: "Sorry, this product is out of stock." };
    }
    if (wanted > limit) {
      return { ok: false, text: "You cannot add more than " + limit + " item(s) of this product." };
    }
    items[product.id] = {
      id: product.id,
      name: product.name,
      price: Number(product.price),
      stock: product.stock,
      quantity: wanted,
    };
    Cart.save(items);
    return { ok: true, text: '"' + product.name + '" added to the cart.' };
  },

  changeQuantity(productId, delta) {
    const items = Cart.load();
    const item = items[productId];
    if (!item) return;
    const newQuantity = item.quantity + delta;
    if (newQuantity <= 0) {
      delete items[productId];
    } else if (newQuantity <= Math.min(item.stock, MAX_QUANTITY_PER_LINE)) {
      item.quantity = newQuantity;
    }
    Cart.save(items);
  },

  remove(productId) {
    const items = Cart.load();
    delete items[productId];
    Cart.save(items);
  },

  clear() {
    Cart.save({});
  },

  total() {
    return Object.values(Cart.load()).reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  count() {
    return Object.values(Cart.load()).reduce((sum, item) => sum + item.quantity, 0);
  },

  /* Draw the cart (badge in the header + list in the sidebar if it exists) */
  render() {
    const badge = document.getElementById("cart-count");
    if (badge) badge.textContent = Cart.count();

    const list = document.getElementById("cart-items");
    if (!list) return; // the product page has only the badge

    const items = Object.values(Cart.load());
    if (items.length === 0) {
      list.innerHTML =
        '<div class="empty-state small"><p>Your cart is empty.</p>' +
        "<p>Add products from the catalogue.</p></div>";
    } else {
      list.innerHTML = items
        .map(function (item) {
          return (
            '<div class="cart-item">' +
            '  <div class="cart-item-name">' + escapeHtml(item.name) +
            '    <small>' + formatPrice(item.price) + " each</small></div>" +
            '  <div class="cart-item-controls">' +
            '    <button type="button" class="btn btn-small" data-action="minus" data-id="' + item.id + '" aria-label="Decrease">-</button>' +
            "    <span>" + item.quantity + "</span>" +
            '    <button type="button" class="btn btn-small" data-action="plus" data-id="' + item.id + '" aria-label="Increase">+</button>' +
            '    <button type="button" class="btn btn-small btn-danger" data-action="remove" data-id="' + item.id + '" aria-label="Remove">&times;</button>' +
            "  </div>" +
            "</div>"
          );
        })
        .join("");
    }
    document.getElementById("cart-total").textContent = formatPrice(Cart.total());
  },
};

/* --------------------------------------------------------------------- */
/* Order form: client-side validation (the server validates again!)      */
/* --------------------------------------------------------------------- */
function validateOrderForm(values) {
  const errors = [];
  if (values.customer_name.length < 2) {
    errors.push({ field: "customer_name", message: "Please enter your name (at least 2 characters)." });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.customer_email)) {
    errors.push({ field: "customer_email", message: "Please enter a valid e-mail, e.g. name@example.com." });
  }
  if (!/^[0-9+\-\s()]*$/.test(values.customer_phone)) {
    errors.push({ field: "customer_phone", message: "Phone may contain only digits, spaces, +, - and brackets." });
  }
  if (values.shipping_address.length < 5) {
    errors.push({ field: "shipping_address", message: "Please enter the shipping address (at least 5 characters)." });
  }
  return errors;
}

async function submitOrder(event) {
  event.preventDefault();
  const form = event.target;
  const messageBox = document.getElementById("order-message");
  const submitButton = document.getElementById("order-submit");
  clearFieldErrors(form);

  const items = Object.values(Cart.load());
  if (items.length === 0) {
    showMessage(messageBox, "Your cart is empty. Please add at least one product.", "error");
    return;
  }

  const values = {
    customer_name: form.customer_name.value.trim(),
    customer_email: form.customer_email.value.trim(),
    customer_phone: form.customer_phone.value.trim(),
    shipping_address: form.shipping_address.value.trim(),
    comment: form.comment.value.trim(),
  };

  const errors = validateOrderForm(values);
  if (errors.length > 0) {
    showFieldErrors(form, errors);
    showMessage(messageBox, "Please correct the highlighted fields.", "error");
    return;
  }

  // Only id + quantity are sent. Prices are calculated by the server.
  values.items = items.map((item) => ({ product_id: item.id, quantity: item.quantity }));

  submitButton.disabled = true;
  submitButton.textContent = "Sending...";
  try {
    const order = await api.post("/orders", values);
    Cart.clear();
    form.reset();
    showMessage(
      messageBox,
      "Thank you! Your order request #" + order.id + " (" + formatPrice(order.total_amount) +
        ") has been received. Status: " + order.status + ".",
      "success"
    );
    // Stock numbers have changed - reload the catalogue if it is on the page
    if (typeof loadProducts === "function") loadProducts();
  } catch (error) {
    showFieldErrors(form, error.fieldErrors);
    showMessage(messageBox, error.message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send order request";
  }
}

/* --------------------------------------------------------------------- */
/* Start-up                                                               */
/* --------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", function () {
  Cart.render();

  // One click handler for all cart buttons ("event delegation")
  const list = document.getElementById("cart-items");
  if (list) {
    list.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const id = button.dataset.id;
      if (button.dataset.action === "plus") Cart.changeQuantity(id, 1);
      if (button.dataset.action === "minus") Cart.changeQuantity(id, -1);
      if (button.dataset.action === "remove") Cart.remove(id);
    });
  }

  const clearButton = document.getElementById("clear-cart-btn");
  if (clearButton) clearButton.addEventListener("click", () => Cart.clear());

  const orderForm = document.getElementById("order-form");
  if (orderForm) orderForm.addEventListener("submit", submitOrder);
});
