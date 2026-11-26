# 1-7 Simple E-commerce Catalogue

A training project (160-hour internship): a **simple online shop showcase**
with a public product catalogue, product detail pages, a simulated shopping cart,
an order request form (no real payment) and an admin panel.

| Layer          | Technology                                   |
|----------------|----------------------------------------------|
| Frontend       | Plain HTML, CSS and Vanilla JavaScript       |
| Backend        | Python 3.12 + FastAPI (plain SQL, no ORM)    |
| Database       | PostgreSQL 15 (auto-initialised by SQL files)|
| Infrastructure | Docker + Docker Compose, nginx, Git + GitHub |

> All data in this project is **fictional test data**. Do not enter real personal data,
> real passwords or payment details anywhere.

---

## 1. Features

**Guest (public user)**
- Catalogue with search (name / description / SKU), category filter, sorting
- Empty-state message when nothing matches
- Product detail page (`product.html?id=N`)
- Shopping cart simulation (stored in the browser)
- Order request form with validation and clear error messages

**Standard user (staff)** - logs in at `admin.html`
- Dashboard with summary numbers, latest orders and low-stock list
- Create and edit products and categories (with validation)
- View orders, search / filter them, open details, change the order status

**Administrator** - everything above plus
- Archive products (soft delete) and delete empty categories
- Users list and audit log (`audit_logs`)
- System settings (shop name, contact e-mail, currency, low-stock threshold)

Every key table has `created_at` / `updated_at`; important actions are written to `audit_logs`.

---

## 2. Repository structure

```
.
├── README.md                     <- you are here
├── .env.example                  <- template of environment variables (no real secrets)
├── .gitignore                    <- keeps .env, caches etc. out of Git
├── 01_documentation/             <- requirements, 160h weekly plan, setup guide
├── 02_source_code/
│   ├── frontend/                 <- index.html, product.html, admin.html, css/, js/
│   └── backend/                  <- Dockerfile, requirements.txt, app/ (FastAPI)
├── 03_database/                  <- schema description, schema.sql, seed_data.sql
├── 04_docker/                    <- docker-compose file, nginx.conf, Docker instructions
├── 05_tests/                     <- test cases + automated API smoke test
├── 06_weekly_reports/            <- weekly report templates (weeks 1-4)
├── 07_screenshots_and_evidence/  <- screenshots and test evidence
└── 08_final_delivery/            <- final report template and delivery checklist
```

---

## 3. Quick start (5 steps)

### Prerequisites
- **Docker Desktop** (Windows / macOS) or **Docker Engine + Compose plugin** (Linux).
  Check: `docker --version` and `docker compose version`.
- **Git**.
- Free ports **8080**, **8000** and **5433** (they can be changed in `.env`).

### Step 1 - Clone the repository
```bash
git clone <your-repository-url>
cd <repository-folder>
```

### Step 2 - Create your `.env` file
```bash
cp .env.example .env
```
On Windows PowerShell: `Copy-Item .env.example .env`

Open `.env` in a text editor and change **at least** these values:

| Variable              | What to put there                                             |
|-----------------------|---------------------------------------------------------------|
| `POSTGRES_PASSWORD`   | any password for the local database                           |
| `SECRET_KEY`          | a long random string (see command below)                      |
| `DEMO_ADMIN_PASSWORD` | demo password for `admin@example.local` (min. 8 characters)   |
| `DEMO_STAFF_PASSWORD` | demo password for `staff@example.local` (min. 8 characters)   |

Generate a random secret key:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

> `.env` is listed in `.gitignore`, so your passwords never go to GitHub.
> Only `.env.example` (with placeholder values) is committed.

### Step 3 - Start the containers (from the repository root)
```bash
docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml up -d --build
```
The first start downloads images and builds the backend (1-3 minutes).
PostgreSQL automatically runs `03_database/1-7_schema.sql` and `03_database/1-7_seed_data.sql`.

### Step 4 - Check that everything is running
```bash
docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml ps
```
All three services (`db`, `backend`, `frontend`) should be `Up` (db and backend `healthy`).

```bash
curl http://localhost:8080/api/health
```
Expected answer: `{"status":"ok","database":"connected"}`

### Step 5 - Open the application
| Page                | URL                                   |
|---------------------|---------------------------------------|
| Catalogue (guest)   | http://localhost:8080/                |
| Admin panel         | http://localhost:8080/admin.html      |
| API docs (Swagger)  | http://localhost:8080/api/docs        |

Demo logins (passwords = the values you put into `.env`):
- `admin@example.local` - administrator
- `staff@example.local` - standard user

---

## 4. Everyday Docker commands

Run them from the repository root. To keep commands short you can first define:
```bash
export DC="docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml"
```

| Task                                  | Command                       |
|---------------------------------------|-------------------------------|
| Show containers                       | `$DC ps`                      |
| Follow logs of all services           | `$DC logs -f`                 |
| Logs of the backend only              | `$DC logs -f backend`         |
| Stop (data is kept)                   | `$DC down`                    |
| Stop **and delete the database**      | `$DC down -v`                 |
| Rebuild after backend code changes    | `$DC up -d --build`           |
| Open psql inside the DB container     | `$DC exec db psql -U catalogue_user -d catalogue_db` |

Frontend files are mounted into nginx, so after editing HTML/CSS/JS just refresh the browser.

> **Important:** the SQL init scripts run only when the database volume is empty.
> After changing `1-7_schema.sql` or `1-7_seed_data.sql`, or after changing
> `POSTGRES_*` values in `.env`, run `$DC down -v` and then `$DC up -d`.

More details: [`04_docker/1-7_05_Docker_Instructions.md`](04_docker/1-7_05_Docker_Instructions.md)
and [`01_documentation/1-7_03_Setup_And_Run_Guide.md`](01_documentation/1-7_03_Setup_And_Run_Guide.md).

---

## 5. Running the tests

Automated API smoke test (34 checks, needs a **fresh** database):
```bash
docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml down -v
docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml up -d
bash 05_tests/1-7_api_smoke_test.sh
```
Manual functional, technical and security test cases:
[`05_tests/1-7_06_Test_Cases.md`](05_tests/1-7_06_Test_Cases.md).

---

## 6. API overview

| Method | Path                           | Access         | Purpose                               |
|--------|--------------------------------|----------------|---------------------------------------|
| GET    | `/api/health`                  | public         | API + database check                  |
| POST   | `/api/auth/login`              | public         | log in, returns a token               |
| GET    | `/api/auth/me`                 | staff          | current user                          |
| GET    | `/api/categories`              | public         | list of categories                    |
| POST/PUT | `/api/categories[/{id}]`     | staff          | create / edit category                |
| DELETE | `/api/categories/{id}`         | admin          | delete an empty category              |
| GET    | `/api/products`                | public / staff | list, `search`, `category_id`, `status`, `sort` |
| GET    | `/api/products/{id}`           | public / staff | product details                       |
| POST/PUT | `/api/products[/{id}]`       | staff          | create / edit product                 |
| DELETE | `/api/products/{id}`           | admin          | archive product (soft delete)         |
| POST   | `/api/orders`                  | public         | send an order request                 |
| GET    | `/api/orders`, `/api/orders/{id}` | staff       | list (filter/search) and details      |
| PATCH  | `/api/orders/{id}/status`      | staff          | change order status                   |
| GET    | `/api/dashboard`               | staff          | summary statistics                    |
| GET    | `/api/users`, `/api/audit-logs`| admin          | users and audit log                   |
| GET/PUT| `/api/settings`                | public / admin | shop settings                         |

Interactive documentation with "Try it out": http://localhost:8080/api/docs

---

## 7. Security notes
- No secrets in the code: database credentials, `SECRET_KEY` and demo passwords come from `.env`.
- Passwords are stored only as PBKDF2-SHA256 hashes; the seed file contains **no passwords**.
- All SQL queries use parameters (`%s`) -> protection against SQL injection.
- Frontend escapes all text from the database before inserting it into HTML -> XSS protection.
- Prices of an order are calculated on the server, not taken from the browser.
- Errors return neutral JSON messages; stack traces are only written to the server log.
- Role checks are done on the **server** (hiding buttons in the UI is only for convenience).

## 8. Troubleshooting
| Problem | Solution |
|---------|----------|
| `Set POSTGRES_DB in .env` error | `.env` is missing or `--env-file .env` was not given. Run commands from the repo root. |
| `port is already allocated` | Change `FRONTEND_PORT`, `BACKEND_PORT` or `DB_HOST_PORT` in `.env`. |
| Login always fails | Demo passwords must be at least 8 characters. They are applied only once, on the first start of a fresh database - run `down -v` and `up -d` again. |
| Catalogue says "Cannot reach the server" | Check `$DC ps` and `$DC logs backend`. |
| Changes in SQL files have no effect | Init scripts run only on an empty volume: `down -v`, then `up -d`. |
