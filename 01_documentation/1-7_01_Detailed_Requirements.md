# 1-7 Detailed Requirements - Simple E-commerce Catalogue

| Item | Value |
|------|-------|
| Project code | 1-7 |
| Project name | Simple E-commerce Catalogue (online shop showcase) |
| Volume | 160 hours (4 weeks x 40 hours) |
| Level | 1st year IT internship |
| Language of UI, code and documentation | English |

## 1. Goal

Build a small web application that shows a product catalogue of an online shop,
lets visitors put products into a simulated cart and send an order request
(without real payment), and gives the shop staff a simple admin panel to manage
products, categories and orders.

## 2. Scope

**In scope:** catalogue, search and filtering, product details, cart simulation, order request
form, admin panel with dashboard, CRUD for products and categories, order status management,
roles, audit log, Docker deployment, documentation, tests.

**Out of scope:** real payments, real e-mail sending, product image upload, customer accounts,
delivery integrations, production hosting.

## 3. Technology constraints

| Area | Requirement |
|------|-------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (no frameworks) |
| Backend | Python 3.12 + FastAPI, plain SQL via `psycopg` (no ORM) |
| Database | PostgreSQL 15, initialised by SQL scripts |
| Infrastructure | Docker, Docker Compose, nginx; Git + GitHub for version control |
| Configuration | Environment variables from `.env`; `.env` is never committed |

## 4. User roles

| Role | Description | Permissions |
|------|-------------|-------------|
| Guest / public user | Any visitor, no login | View catalogue, search/filter, product details, cart, send order request |
| Standard user (`standard`) | Shop staff member | Everything a guest can + dashboard, create/edit products and categories, view orders, change order status |
| Administrator (`admin`) | Shop owner / system admin | Everything + archive products, delete categories, view users and audit log, edit system settings |

Permissions are enforced on the **server**; the UI only hides buttons that a role cannot use.

## 5. Functional requirements

| ID | Requirement | Priority | Implemented in |
|----|-------------|----------|----------------|
| FR-01 | Show the list of active products as cards (name, category, price, stock) | Must | `index.html`, `catalog.js`, `GET /api/products` |
| FR-02 | Search products by name, description or SKU | Must | `search` parameter |
| FR-03 | Filter products by category (drop-down and chips) | Must | `category_id` parameter |
| FR-04 | Sort products by name, price, newest | Should | `sort` parameter |
| FR-05 | Show an empty-state message when no data matches (catalogue, cart, tables) | Must | all lists |
| FR-06 | Product detail page with description, SKU, availability, created/updated dates | Must | `product.html`, `GET /api/products/{id}` |
| FR-07 | Cart simulation: add, change quantity, remove, clear, total; survives reload | Must | `cart.js` (localStorage) |
| FR-08 | Order request form with validation and clear error messages | Must | `cart.js`, `POST /api/orders` |
| FR-09 | Server calculates order prices and checks stock; stock is reduced | Must | `routes/orders.py` |
| FR-10 | Staff login with e-mail and password | Must | `admin.html`, `POST /api/auth/login` |
| FR-11 | Dashboard: product/order counts by status, simulated revenue, latest orders, low stock | Must | `GET /api/dashboard` |
| FR-12 | Create product with validation (name, SKU, category, price, stock, status) | Must | `POST /api/products` |
| FR-13 | Edit product | Must | `PUT /api/products/{id}` |
| FR-14 | Archive product (soft delete), admin only | Must | `DELETE /api/products/{id}` |
| FR-15 | Product list in admin with search and status filter (incl. draft / archived) | Must | `admin.js` |
| FR-16 | Create / edit categories; delete only empty categories (admin) | Should | `/api/categories` |
| FR-17 | Order list with status filter and search (name, e-mail, order number) | Must | `GET /api/orders` |
| FR-18 | Order detail view with items | Must | `GET /api/orders/{id}` |
| FR-19 | Change order status (`new`, `confirmed`, `shipped`, `completed`, `cancelled`); final statuses locked; cancel returns stock | Must | `PATCH /api/orders/{id}/status` |
| FR-20 | Audit log of important actions (create, update, archive, delete, status change, login) | Must | `audit_logs` table, `GET /api/audit-logs` |
| FR-21 | Users list for administrator | Should | `GET /api/users` |
| FR-22 | System settings: store name, contact e-mail, currency, low stock threshold | Could | `/api/settings` |
| FR-23 | `created_at` / `updated_at` on all key entities, `updated_at` refreshed automatically | Must | DB triggers |

## 6. Validation rules

| Field | Rule | Error message (example) |
|-------|------|-------------------------|
| Product name | 2-120 chars, not only spaces | "Name must contain at least 2 characters" |
| SKU | 3-40 chars, letters/digits/`-`, unique, stored upper-case | "SKU may contain only letters, digits and '-'" / "A product with this SKU already exists." |
| Price | > 0, <= 100000, max. 2 decimals | "Price must be a positive number with max. 2 decimals" |
| Stock | whole number 0-100000 | "Stock must be a whole number from 0 to 100000." |
| Category | must exist | "The selected category does not exist." |
| Customer name | 2-100 chars | "Please enter your name (at least 2 characters)." |
| Customer e-mail | `something@domain.tld` | "Please enter a valid e-mail, e.g. name@example.com." |
| Phone | optional; digits, spaces, `+ - ( )` | "Phone may contain only digits, ..." |
| Shipping address | 5-300 chars | "Please enter the shipping address (at least 5 characters)." |
| Order items | 1-50 lines, quantity 1-99, product active, enough stock | "Only 3 item(s) of "X" left in stock." |

Validation happens **twice**: in the browser (fast feedback) and on the server (security).

## 7. Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | Responsive UI: readable on a laptop (1366 px) and a phone (390 px) without horizontal page scroll |
| NFR-02 | Start of the full stack with one Docker Compose command |
| NFR-03 | No secrets in the repository; configuration through environment variables |
| NFR-04 | Passwords stored only as salted hashes (PBKDF2-SHA256) |
| NFR-05 | SQL injection protection (parameterised queries) and XSS protection (HTML escaping) |
| NFR-06 | Errors returned as neutral JSON messages, no stack traces to the client |
| NFR-07 | Only fictional test data (`example.com`, `example.local`) |
| NFR-08 | Code and comments readable by a 1st year student; each file has a header comment |
| NFR-09 | API responses for the catalogue < 1 s with the seed data |

## 8. Acceptance criteria
- `docker compose ... up -d --build` starts all three services; `/api/health` returns `ok`.
- All test cases in `05_tests/1-7_06_Test_Cases.md` pass; `05_tests/1-7_api_smoke_test.sh` shows `Failed: 0`.
- Demo scenario from the setup guide can be shown without errors.
- Documentation, weekly reports and final report are complete (see `08_final_delivery/1-7_08_Final_Delivery_Checklist.md`).
