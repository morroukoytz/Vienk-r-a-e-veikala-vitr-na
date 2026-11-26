# 1-7 160-Hour Weekly Plan - Simple E-commerce Catalogue

Total: **160 hours = 4 weeks x 5 days x 8 hours**.
Each week ends with a weekly report (`06_weekly_reports/`) and a Git push.

## Overview

| Week | Theme | Hours | Main result |
|------|-------|-------|-------------|
| 1 | Analysis, environment, database | 40 | Requirements, repository, Docker DB with schema and seed data |
| 2 | Backend API | 40 | FastAPI with all routes, validation, roles, audit log |
| 3 | Frontend | 40 | Catalogue, product page, cart + order form, admin panel |
| 4 | Testing, security, documentation, delivery | 40 | Test cases passed, evidence, final report, defence |

## Week 1 - Analysis, environment and database (40 h)

| Day | Tasks | Hours | Output |
|-----|-------|-------|--------|
| 1 | Study the assignment, roles and features; write detailed requirements | 8 | `1-7_01_Detailed_Requirements.md` |
| 2 | Install Git, Docker, VS Code; create GitHub repository and folder structure; `.gitignore`, `.env.example` | 8 | Repository with structure |
| 3 | Design the data model (ER diagram), statuses, relations, indexes | 8 | `1-7_04_Database_Schema.md` draft |
| 4 | Write `1-7_schema.sql` (tables, FK, CHECK, indexes, `updated_at` triggers) | 8 | Schema script |
| 5 | Write `1-7_seed_data.sql`; Compose file with PostgreSQL 15; test init with `psql`; weekly report | 8 | DB starts in Docker with data; Week 1 report |

## Week 2 - Backend API (40 h)

| Day | Tasks | Hours | Output |
|-----|-------|-------|--------|
| 6 | FastAPI basics, project skeleton, `db.py` with environment variables, health check, Dockerfile | 8 | `main.py`, `db.py`, `Dockerfile` |
| 7 | Categories and products: list with search/filter/sort, details, create, edit, archive | 8 | `routes/products.py` |
| 8 | Orders: create with stock check and server-side prices, list, details, status change | 8 | `routes/orders.py` |
| 9 | Authentication (password hashing, signed token), roles, audit log, settings, users | 8 | `auth.py`, `routes/auth_routes.py`, `routes/admin.py` |
| 10 | Dashboard statistics; error handlers (validation, conflicts, 500 without stack trace); test with Swagger UI; weekly report | 8 | `routes/dashboard.py`; Week 2 report |

## Week 3 - Frontend (40 h)

| Day | Tasks | Hours | Output |
|-----|-------|-------|--------|
| 11 | Page layout, `styles.css` (mobile first), `api.js` helper, nginx config and proxy | 8 | Static site served by nginx |
| 12 | Catalogue: cards, search with debounce, category chips, sorting, empty-state; product page | 8 | `index.html`, `product.html`, `catalog.js` |
| 13 | Cart simulation (localStorage) and order form with validation and server errors | 8 | `cart.js` |
| 14 | Admin panel: login, tabs, dashboard, products CRUD with validation | 8 | `admin.html`, `admin.js` |
| 15 | Admin: categories, orders (filter, details, status), users/audit, settings; responsive checks; weekly report | 8 | Complete UI; Week 3 report |

## Week 4 - Testing, security, documentation, delivery (40 h)

| Day | Tasks | Hours | Output |
|-----|-------|-------|--------|
| 16 | Write functional, technical and security test cases | 8 | `1-7_06_Test_Cases.md` |
| 17 | Execute tests, fix bugs, automated smoke test script | 8 | Test results, bug fixes |
| 18 | Security review (secrets, SQL injection, XSS, roles, error messages); screenshots and evidence | 8 | `07_screenshots_and_evidence/` |
| 19 | README, setup guide, Docker instructions; clean clone test on another computer | 8 | Final documentation |
| 20 | Final report, delivery checklist, presentation and defence rehearsal; Week 4 report | 8 | `08_final_delivery/`; Week 4 report |

## Milestones

| Milestone | End of | Check |
|-----------|--------|-------|
| M1: Database ready | Week 1 | `docker compose up` creates tables and seed data |
| M2: API ready | Week 2 | All endpoints work in Swagger UI, roles enforced |
| M3: UI ready | Week 3 | Demo scenario works in the browser (laptop + phone) |
| M4: Delivery | Week 4 | All tests pass, documents complete, project defended |

## Risks and mitigation

| Risk | Mitigation |
|------|------------|
| Docker does not start on the student's PC | Install Docker Desktop on day 2; ask the mentor early; enable virtualisation in BIOS |
| Port conflicts (8080/8000/5432) | Ports are configurable in `.env`; DB uses 5433 on the host by default |
| Running out of time for the frontend | "Must" requirements first, "Could" (settings) last |
| Lost work | Commit and push every day |
