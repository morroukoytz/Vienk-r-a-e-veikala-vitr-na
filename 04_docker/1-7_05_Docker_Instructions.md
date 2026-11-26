# 1-7 Docker Instructions - Simple E-commerce Catalogue

This guide explains how the application runs in Docker and how to start, check,
stop and reset it. **All commands are run from the repository root folder.**

## 1. What runs in Docker

```
 Browser ──> http://localhost:8080
                │
        ┌───────▼────────┐   /api/*   ┌──────────────────┐   SQL   ┌──────────────────┐
        │ frontend       │ ─────────> │ backend          │ ──────> │ db               │
        │ nginx:1.27     │            │ Python + FastAPI │         │ PostgreSQL 15    │
        │ static files   │            │ port 8000        │         │ volume db_data   │
        └────────────────┘            └──────────────────┘         └──────────────────┘
```

| Service    | Image / build                        | Host port (from `.env`) | Purpose                          |
|------------|--------------------------------------|-------------------------|----------------------------------|
| `frontend` | `nginx:1.27-alpine`                  | `FRONTEND_PORT` = 8080   | serves HTML/CSS/JS, proxies `/api` |
| `backend`  | built from `02_source_code/backend`  | `BACKEND_PORT` = 8000    | REST API                         |
| `db`       | `postgres:15-alpine`                 | `DB_HOST_PORT` = 5433    | database                         |

Files in this folder:
- `1-7_docker-compose.yml` - describes the three services, the network and the volume `db_data`
- `nginx.conf` - nginx settings: static files + proxy of `/api/` to `backend:8000`

Inside the Docker network the services find each other **by service name**
(the backend connects to host `db`, nginx forwards to `backend`).

## 2. Step 1 - prepare `.env`

```bash
cp .env.example .env          # Linux / macOS / Git Bash
Copy-Item .env.example .env   # Windows PowerShell
```

Edit `.env`:

| Variable | Example | Meaning |
|----------|---------|---------|
| `POSTGRES_DB` | `catalogue_db` | database name |
| `POSTGRES_USER` | `catalogue_user` | database user |
| `POSTGRES_PASSWORD` | *your value* | database password (**change it**) |
| `DB_HOST_PORT` | `5433` | port to reach PostgreSQL from your PC |
| `BACKEND_PORT` | `8000` | port to reach the API directly |
| `SECRET_KEY` | *64 random hex chars* | signs login tokens (**change it**, min. 16 chars) |
| `TOKEN_TTL_MINUTES` | `120` | login lifetime |
| `CORS_ORIGINS` | `http://localhost:8080` | allowed browser origins |
| `DEMO_ADMIN_PASSWORD` | *your demo value* | password of `admin@example.local` (min. 8 chars) |
| `DEMO_STAFF_PASSWORD` | *your demo value* | password of `staff@example.local` (min. 8 chars) |
| `FRONTEND_PORT` | `8080` | port of the website |

Random key: `python3 -c "import secrets; print(secrets.token_hex(32))"`

If a required variable is missing, Compose stops with a clear message such as
`Set POSTGRES_PASSWORD in .env` (this is the `${VAR:?message}` syntax in the compose file).

## 3. Step 2 - start

```bash
docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml up -d --build
```

- `--env-file .env` - where to read the variables from
- `-f 04_docker/1-7_docker-compose.yml` - which compose file to use
- `up` - create and start containers; `-d` - in the background; `--build` - (re)build the backend image

What happens on the first start:
1. `db` starts; because the volume is empty, PostgreSQL runs `01_schema.sql` and `02_seed_data.sql`
   (our files from `03_database/`, mounted read-only).
2. The `db` health check (`pg_isready`) becomes healthy.
3. `backend` starts (it waits for the healthy database), sets the demo passwords from `.env`.
4. `frontend` (nginx) starts.

Tip - a short alias for the next commands:
```bash
export DC="docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml"
```
(PowerShell: `function DC { docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml @args }`)

## 4. Step 3 - check

```bash
$DC ps
```
Expected (simplified):
```
SERVICE    STATUS                   PORTS
backend    Up (healthy)             0.0.0.0:8000->8000/tcp
db         Up (healthy)             0.0.0.0:5433->5432/tcp
frontend   Up                       0.0.0.0:8080->80/tcp
```

Logs:
```bash
$DC logs -f              # all services, Ctrl+C to exit
$DC logs -f backend      # only backend
$DC logs db | tail -n 30 # last lines of the database log
```
In the backend log you should see `Database is ready` and `Application startup complete`.

API and website:
```bash
curl http://localhost:8080/api/health          # {"status":"ok","database":"connected"}
curl "http://localhost:8080/api/products?search=mouse"
```
Open http://localhost:8080 , http://localhost:8080/admin.html and http://localhost:8080/api/docs .

Database:
```bash
$DC exec db psql -U catalogue_user -d catalogue_db -c "\dt"
$DC exec db psql -U catalogue_user -d catalogue_db -c "SELECT id, name, status, stock FROM products;"
```
(use the user / database names from your `.env`)

Automated check: `bash 05_tests/1-7_api_smoke_test.sh` (on a fresh database).

## 5. Step 4 - stop and reset

| Goal | Command | Data |
|------|---------|------|
| Stop and remove containers | `$DC down` | **kept** in volume `db_data` |
| Start again | `$DC up -d` | same data as before |
| Full reset of the database | `$DC down -v` then `$DC up -d` | **deleted**, schema + seed run again |
| Restart one service | `$DC restart backend` | kept |
| Rebuild backend after code change | `$DC up -d --build backend` | kept |

`-v` removes the named volume `db_data`. Use it when:
- you changed `1-7_schema.sql` or `1-7_seed_data.sql`;
- you changed `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` (they are applied only on first init);
- you want to re-apply the demo passwords from `.env`;
- you want clean data before running the smoke test.

## 6. Common problems

| Message / symptom | Cause and fix |
|-------------------|---------------|
| `required variable POSTGRES_DB is missing` / `Set ... in .env` | `.env` not found - run from the repo root and pass `--env-file .env`. |
| `Bind for 0.0.0.0:8080 failed: port is already allocated` | Another program uses the port - change `FRONTEND_PORT` (or other port) in `.env`. |
| backend keeps restarting, log shows `password authentication failed` | DB credentials in `.env` were changed after the first init - `$DC down -v`, `$DC up -d`. |
| backend log: `SECRET_KEY environment variable is missing or too short` | Set a long `SECRET_KEY` in `.env`, then `$DC up -d`. |
| Login fails with correct password | Demo password shorter than 8 chars, or the DB was initialised earlier with another password - fix `.env`, `$DC down -v`, `$DC up -d`. |
| Page shows old JS/CSS | Hard refresh in the browser (Ctrl+F5). |
| Windows: `docker` not found | Start Docker Desktop and wait until it says "Engine running". |
