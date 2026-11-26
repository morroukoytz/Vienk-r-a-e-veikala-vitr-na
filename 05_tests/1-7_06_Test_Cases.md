# 1-7 Test Cases - Simple E-commerce Catalogue

**Environment:** Docker Compose stack started as described in `README.md`, fresh database
(`down -v` + `up -d`), browser: Chrome / Firefox / Edge (latest), laptop 1366x768 and phone 390x844
(browser DevTools device mode is enough).

**Automated part:** `bash 05_tests/1-7_api_smoke_test.sh` executes the API-level checks
(IDs are printed next to each PASS / FAIL). Save its output to `07_screenshots_and_evidence/`.

**How to record results:** fill the columns *Actual result* and *Status* (`Pass` / `Fail`)
and add a screenshot name from `07_screenshots_and_evidence/` where useful.

Demo accounts: `admin@example.local` (admin), `staff@example.local` (standard user);
passwords = `DEMO_ADMIN_PASSWORD` / `DEMO_STAFF_PASSWORD` from `.env`.

---

## 1. Functional test cases (UI)

| ID | Title | Preconditions | Steps | Expected result | Actual result | Status |
|----|-------|---------------|-------|-----------------|---------------|--------|
| FUI-01 | Catalogue loads | Stack running | Open http://localhost:8080 | 14 active product cards, "14 product(s) found", draft "Desk Organizer" not shown | | |
| FUI-02 | Search | FUI-01 | Type `sql` in Search | After ~0.3 s only "Learn SQL in 30 Days" is shown | | |
| FUI-03 | Category filter | FUI-01 | Click chip "Books" | Only 3 Books products; select shows "Books" | | |
| FUI-04 | Sorting | FUI-01 | Choose "Price: high to low" | First card is "Mechanical Keyboard" (64.50) | | |
| FUI-05 | Empty state in catalogue | FUI-01 | Type `zzzz` in Search | Message "No products found" + "Reset filters" button; button restores the full list | | |
| FUI-06 | Out of stock | FUI-01 | Look at "Bluetooth Speaker" | Shows "Out of stock", "Add to cart" disabled | | |
| FUI-07 | Product details | FUI-01 | Click product name "Wireless Mouse" | `product.html?id=1` shows name, category, price, description, SKU, availability, added/updated dates | | |
| FUI-08 | Invalid product link | - | Open `product.html?id=abc` | Message "Invalid product link..." | | |
| FUI-09 | Hidden product link | - | Open `product.html?id=15` (draft) as guest | Message "This product does not exist or is not available." | | |
| FUI-10 | Quantity validation | FUI-07 | Enter `500`, click "Add to cart" | Error "Please enter a whole number from 1 to 40." | | |
| FUI-11 | Add to cart | FUI-01 | Click "Add to cart" on two products | Success message, header badge = 2, sidebar lists both, total correct | | |
| FUI-12 | Change cart quantity | FUI-11 | Click `+`, `-`, `x` in the cart | Quantity and total update; removing last item shows "Your cart is empty." | | |
| FUI-13 | Cart persists | FUI-11 | Reload the page | Cart content is the same | | |
| FUI-14 | Order with empty cart | Empty cart | Click "Send order request" | Error "Your cart is empty. Please add at least one product." | | |
| FUI-15 | Order form validation | Cart not empty | Name `A`, e-mail `bad`, empty address, submit | Three red field messages + "Please correct the highlighted fields." | | |
| FUI-16 | Successful order | Cart not empty | Fill valid test data, submit | "Thank you! Your order request #N (...) has been received. Status: new."; cart cleared; stock on cards decreased | | |
| FUI-17 | Login validation | - | admin.html, submit empty form | "Please enter your e-mail." / "Please enter your password." | | |
| FUI-18 | Wrong login | - | Correct e-mail, wrong password | "Invalid e-mail or password." | | |
| FUI-19 | Dashboard | Logged in as staff | Open Dashboard | 4 stat cards, latest orders table, low stock table (Bluetooth Speaker 0, USB-C Charger 3, Bamboo Cutting Board 4) | | |
| FUI-20 | Create product - validation | Logged in | Products -> "+ New product" -> Save with empty form | Errors under Name, SKU, Category, Price, Stock | | |
| FUI-21 | Create product | Logged in | Fill: Desk Lamp / HK-010 / Home & Kitchen / 27.40 / 9 / Active, Save | "Product created.", product in the list and in the public catalogue | | |
| FUI-22 | Duplicate SKU | FUI-21 | Create another product with SKU `hk-010` | Message "A product with this SKU already exists." | | |
| FUI-23 | Edit product | FUI-21 | Click Edit, change price to 25, Save | "Product updated.", new price in list, Updated time changed | | |
| FUI-24 | Product status filter | Logged in | Status filter = Draft | Only "Desk Organizer" | | |
| FUI-25 | Archive product | Logged in as admin | Click "Archive" on Desk Lamp, confirm | "Product archived.", status = archived, product gone from public catalogue | | |
| FUI-26 | Category create / edit | Logged in | Categories: create "Toys"; Edit -> rename "Toys & Games" | Messages "Category created." / "Category updated." | | |
| FUI-27 | Delete category with products | Admin | Delete "Books" | Error "This category still has products. Move or archive them first." | | |
| FUI-28 | Delete empty category | Admin, FUI-26 | Delete "Toys & Games" | "Category deleted." | | |
| FUI-29 | Order list filter / search | Logged in, FUI-16 | Orders: status = New; search by customer e-mail | Only matching orders; non-matching filter shows "No orders found" | | |
| FUI-30 | Order details | FUI-29 | Click "Details" | Customer data, items, total; status selector | | |
| FUI-31 | Change order status | FUI-30 | Select "confirmed", Save status | "Order #N status changed to confirmed."; badge updated; audit log has `status_change` | | |
| FUI-32 | Cancel order returns stock | Order with known items | Change status to "cancelled", confirm | Stock of its products increases by ordered quantity; order cannot be changed any more | | |
| FUI-33 | Users and audit log | Admin | Tab "Users & audit" | 2 users without passwords; audit log lists recent actions with user e-mail or "guest" | | |
| FUI-34 | Settings | Admin | Change store name, Save; invalid currency `E1` | Header shows new name; invalid currency -> "Use a 3-letter code, e.g. EUR." | | |
| FUI-35 | Responsive - phone | DevTools 390x844 | Open catalogue, product page, admin tables | One-column layout, no horizontal page scroll, tables scroll inside their box | | |
| FUI-36 | Responsive - laptop | 1366x768 | Open catalogue | Product grid + cart sidebar side by side | | |

## 2. Functional test cases (API, automated)

| ID | Check | Expected |
|----|-------|----------|
| FT-01 | `GET /api/products` | 200, list of active products |
| FT-02 | Search + category filter | 200 |
| FT-03 | `GET /api/products/1` | 200 |
| FT-04 | Draft product as guest | 404 |
| FT-05 | Not existing product | 404 |
| FT-06 | Create product with invalid data | 422 with `errors` list |
| FT-07 | Create product as standard user | 201 |
| FT-08 | Duplicate SKU | 409 |
| FT-09 | Edit product | 200 |
| FT-10 | Order with invalid data | 422 |
| FT-11 | Order quantity > stock | 400 |
| FT-12 | Order by guest | 201 |
| FT-13 / FT-14 | Order details / filtered list | 200 |
| FT-15 | Status -> confirmed | 200 |
| FT-16 | Unknown status `paid` | 422 |
| FT-17 / FT-18 | Cancel order / change cancelled order | 200 / 400 |
| FT-19 | Dashboard | 200 |
| FT-20 / FT-21 | Users / audit log as admin | 200 |
| FT-22 | Delete category with products | 409 |
| FT-23 / FT-24 | Archive product / archived hidden from guests | 200 / 404 |

## 3. Technical test cases

| ID | Title | Steps | Expected result | Actual result | Status |
|----|-------|-------|-----------------|---------------|--------|
| TT-01 | Health check | `curl http://localhost:8080/api/health` | `{"status":"ok","database":"connected"}` | | |
| TT-02 | Wrong parameter type | `GET /api/products/abc` | 422 JSON with readable message | | |
| TT-03 | Malformed JSON | POST `/api/orders` with body `{bad json` | 422 "The request body is not valid JSON." | | |
| TT-04 | Frontend served by nginx | `curl -I http://localhost:8080/` | 200, header `X-Content-Type-Options: nosniff` | | |
| TT-05 | Containers healthy | `docker compose ... ps` | db and backend `healthy`, frontend `Up` | | |
| TT-06 | DB initialisation | `docker compose ... exec db psql -U <user> -d <db> -c "\dt"` | 7 tables: users, categories, products, orders, order_items, settings, audit_logs | | |
| TT-07 | Data persistence | Create a product, `down`, `up -d` | Product still exists | | |
| TT-08 | Full reset | `down -v`, `up -d` | Only seed data remains | | |
| TT-09 | `updated_at` trigger | Edit a product, compare `created_at` and `updated_at` | `updated_at` is newer | | |
| TT-10 | Missing env variable | Rename `.env`, run `up` | Compose stops with "Set POSTGRES_DB in .env" (or similar) | | |
| TT-11 | Missing SECRET_KEY | Set `SECRET_KEY=` in `.env`, `up -d` | Backend does not start, log: "SECRET_KEY environment variable is missing or too short" | | |
| TT-12 | Database down | `docker compose ... stop db`, call `/api/health` | 500 "Internal server error. Please try again later." (no stack trace in response); `start db` restores | | |
| TT-13 | Concurrent last item | Two orders for the last items of a product at the same time | One succeeds, the other gets "Only 0 item(s) ... left in stock." (row lock `FOR UPDATE`) | | |
| TT-14 | Performance | Open catalogue with DevTools Network | `/api/products` responds in < 1 s | | |

## 4. Security test cases

| ID | Title | Steps | Expected result | Actual result | Status |
|----|-------|-------|-----------------|---------------|--------|
| ST-01 | Staff API without login | `GET /api/orders` without token | 401 "Please log in to continue." | | |
| ST-02 | Wrong password | Login with wrong password | 401, same message for unknown e-mail and wrong password | | |
| ST-03 | Forged token | Header `Authorization: Bearer 1.9999999999.fake` | 401 | | |
| ST-04 | Standard user cannot archive | Staff token, `DELETE /api/products/1`; also `PUT` with `"status":"archived"` | 403 | | |
| ST-05 | SQL injection | Search for `' OR 1=1--` | 200, empty list, no SQL error | | |
| ST-06 | Admin-only endpoints | Staff token: `GET /api/users`, `/api/audit-logs`, `PUT /api/settings`, `DELETE /api/categories/1` | 403 | | |
| ST-07 | Stored XSS | Create product named `<img src=x onerror=alert(1)>` and view catalogue, product page and admin list | Text is shown literally, no alert window | | |
| ST-08 | Price manipulation | Send order with extra field `"unit_price": 0.01` or change price in localStorage | Server uses DB price; total is correct | | |
| ST-09 | No secrets in Git | `git ls-files \| grep -E "^\.env$"`; search repo for passwords | `.env` not tracked; only `.env.example` with placeholders | | |
| ST-10 | Password storage | `SELECT email, password_hash FROM users;` | Values start with `pbkdf2_sha256$`, no plain passwords | | |
| ST-11 | Password hash not exposed | `GET /api/users` as admin | Response has no `password_hash` field | | |
| ST-12 | No stack trace to client | TT-12 | Neutral message only; details only in `docker compose logs backend` | | |
| ST-13 | Token expiry | Set `TOKEN_TTL_MINUTES=1`, restart backend, log in, wait 2 min, open a tab | Redirect to login with "Your session has expired..." | | |
| ST-14 | Hidden data | Guest `GET /api/products?status=all` | Only active products are returned | | |
| ST-15 | Test data only | Review seed data | Only `example.com` / `example.local` addresses, fictional names | | |

## 5. Test summary (fill in)

| Category | Total | Passed | Failed | Notes |
|----------|-------|--------|--------|-------|
| Functional UI | 36 | | | |
| Functional API (automated) | 24 | | | |
| Technical | 14 | | | |
| Security | 15 | | | |

Tester: ____________  Date: ____________  Build / commit: ____________
