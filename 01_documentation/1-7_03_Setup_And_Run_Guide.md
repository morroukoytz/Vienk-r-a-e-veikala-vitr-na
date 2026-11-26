# 1-7 Setup and Run Guide - Simple E-commerce Catalogue

This guide is written for a student who opens the project for the first time.
Follow the steps in order. Commands are run in a terminal **in the repository root folder**
(the folder that contains `README.md`).

## 1. Install the tools

| Tool | Check command | Where to get it |
|------|---------------|-----------------|
| Git | `git --version` | https://git-scm.com |
| Docker Desktop (Windows/macOS) or Docker Engine + Compose plugin (Linux) | `docker --version`, `docker compose version` | https://docs.docker.com/get-docker/ |
| A code editor (recommended: VS Code) | - | https://code.visualstudio.com |
| Python 3 (optional, only to generate a secret key / run backend without Docker) | `python3 --version` | https://www.python.org |

Windows: run Docker Desktop and wait until it shows "Engine running". Use PowerShell or Git Bash.

## 2. Get the code

```bash
git clone <your-repository-url>
cd <repository-folder>
```

## 3. Configure the environment (`.env`)

1. Copy the template:
   ```bash
   cp .env.example .env
   ```
   PowerShell: `Copy-Item .env.example .env`
2. Open `.env` and replace every `change_me...` value:
   - `POSTGRES_PASSWORD` - any local database password;
   - `SECRET_KEY` - output of `python3 -c "import secrets; print(secrets.token_hex(32))"`;
   - `DEMO_ADMIN_PASSWORD`, `DEMO_STAFF_PASSWORD` - demo passwords, at least 8 characters.
     Use invented values only, never a password you use for real accounts.
3. Check that Git ignores the file:
   ```bash
   git status --ignored | grep .env
   ```
   `.env` must appear only as *ignored*, never as a file to commit.

## 4. Start the application

```bash
docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml up -d --build
```

Wait 1-3 minutes on the first run. Then:

```bash
docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml ps
curl http://localhost:8080/api/health
```

## 5. Use the application

| What | Where | Who |
|------|-------|-----|
| Catalogue, search, filters, cart, order form | http://localhost:8080 | guest |
| Product details | click a product name or `http://localhost:8080/product.html?id=1` | guest |
| Admin panel | http://localhost:8080/admin.html | staff / admin |
| API documentation | http://localhost:8080/api/docs | developer |

Demo scenario for the defence (about 5 minutes):
1. Catalogue: type `book` in the search, choose category chips, change sorting.
   Type `zzz` to show the empty-state message, press "Reset filters".
2. Open a product, try quantity `500` -> validation message, add quantity `1`.
3. Add 2-3 products to the cart, change quantities with `+`/`-`.
4. Submit the order form with an empty name and a wrong e-mail -> field errors.
   Fill it correctly -> "Thank you! Your order request #N ..." message.
5. Log in as `staff@example.local`: show the dashboard, create a product with
   invalid data (errors), then with valid data; edit it. Note that there is no "Archive" button
   and no "Users & audit" / "Settings" tabs for a standard user.
6. Orders tab: find the new order by e-mail, open details, change status to `confirmed`.
7. Log out, log in as `admin@example.local`: archive the product, try to delete a category
   that has products (blocked with a message), show the audit log and settings.

## 6. Stop / reset

```bash
docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml down      # stop, keep data
docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml down -v   # stop, delete database
```

## 7. Optional: run the backend without Docker (for debugging)

The database still runs in Docker; only the API runs on your computer.

```bash
docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml up -d db
cd 02_source_code/backend
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
set -a; source ../../.env; set +a    # load variables from .env (Linux/macOS/Git Bash)
export DB_HOST=localhost DB_PORT=5433
uvicorn app.main:app --reload --port 8001
```
Then open http://localhost:8001/api/docs .

## 8. How the code is organised

```
02_source_code/backend/app/
  main.py               app creation, CORS, error handlers, router registration
  db.py                 PostgreSQL connection from environment variables + audit helper
  auth.py               password hashing, signed tokens, role checks
  routes/auth_routes.py login, current user
  routes/products.py    categories + products CRUD, search, filter
  routes/orders.py      order creation, list, details, status change
  routes/dashboard.py   summary statistics
  routes/admin.py       users list, audit log, settings

02_source_code/frontend/
  index.html / product.html / admin.html   pages
  css/styles.css        one responsive stylesheet
  js/api.js             fetch wrapper, token storage, helpers (escapeHtml, formatPrice)
  js/catalog.js         catalogue list + product page
  js/cart.js            cart simulation + order form
  js/admin.js           admin panel
```

A request path, for example "search products":
`catalog.js` -> `api.get("/products?search=...")` -> nginx (`/api/` proxy) ->
FastAPI `routes/products.py:list_products` -> SQL with parameters -> PostgreSQL -> JSON ->
`renderProductCard()` -> HTML on the page.

For more Docker details see `04_docker/1-7_05_Docker_Instructions.md`.
