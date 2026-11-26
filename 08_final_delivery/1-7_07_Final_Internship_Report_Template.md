# 1-7 Final Internship Report - Simple E-commerce Catalogue

| Field | Value |
|-------|-------|
| Student | _(name)_ |
| Group / study programme | _(group)_ |
| Internship place | _(organisation / university lab)_ |
| Supervisor / mentor | _(name)_ |
| Period | _(dd.mm.yyyy - dd.mm.yyyy)_, 160 hours |
| Repository | _(GitHub link)_ |
| Final commit | _(hash)_ |

---

## 1. Introduction
_(Short description of the task: why an online shop showcase, who are the users, what problem it solves.
Example: "The goal of the internship was to build a simple web application that shows a product
catalogue, simulates a shopping cart and lets the shop staff manage products and orders.")_

## 2. Requirements summary
- Roles: Guest, Standard user, Administrator (see `01_documentation/1-7_01_Detailed_Requirements.md`)
- Main features: _(list the most important ones)_
- Constraints: HTML/CSS/Vanilla JS, Python + FastAPI, PostgreSQL 15, Docker Compose, Git + GitHub;
  no real personal or payment data; no secrets in the repository.

## 3. Architecture

```
Browser (HTML/CSS/JS) --> nginx (static files, /api proxy) --> FastAPI backend --> PostgreSQL 15
```
_(Explain in your own words what each part does and how a request travels, e.g. "search for a product".)_

### 3.1 Database
_(Tables, relations, statuses, `created_at`/`updated_at`, `audit_logs`. Insert or link the ER diagram
from `03_database/1-7_04_Database_Schema.md`.)_

### 3.2 Backend API
_(Main endpoints and how roles are checked. Explain validation and error handling.)_

### 3.3 Frontend
_(Pages, JS files, how the cart works, how empty-states and errors are shown, responsive design.)_

### 3.4 Docker
_(Services, `.env`, volume `db_data`, init scripts, commands to start/stop/reset.)_

## 4. Implementation highlights
_(2-4 pieces of code you are proud of or that were difficult, with a short explanation.
Suggestions: order creation with stock check and `FOR UPDATE`; parameterised search query;
`escapeHtml` against XSS; signed token in `auth.py`.)_

## 5. Testing
| Category | Total | Passed | Failed |
|----------|-------|--------|--------|
| Functional UI | | | |
| Functional API (automated smoke test) | | | |
| Technical | | | |
| Security | | | |

_(Mention the most interesting bugs found and how they were fixed. Link evidence from
`07_screenshots_and_evidence/`.)_

## 6. Security measures
- Secrets only in `.env` (ignored by Git), `.env.example` with placeholders
- Password hashing (PBKDF2-SHA256), signed tokens with expiry
- Role checks on the server (401 / 403)
- Parameterised SQL, HTML escaping, server-side price calculation
- Neutral error messages, no stack traces for the client
- Only fictional test data

## 7. Time spent
| Week | Theme | Planned h | Actual h |
|------|-------|-----------|----------|
| 1 | Analysis, environment, database | 40 | |
| 2 | Backend API | 40 | |
| 3 | Frontend | 40 | |
| 4 | Testing, security, documentation | 40 | |
| | **Total** | **160** | |

## 8. Results and conclusions
_(What was achieved compared to the requirements, what works, what is missing.)_

## 9. Possible improvements
_(Examples: product images, pagination, customer accounts, e-mail notifications,
automated unit tests with pytest, HTTPS, rate limiting of the login endpoint.)_

## 10. Self-assessment and learned skills
_(Technical skills, soft skills, what you would do differently next time.)_

## Appendices
- A. Screenshots (`07_screenshots_and_evidence/`)
- B. Test cases with results (`05_tests/1-7_06_Test_Cases.md`)
- C. Weekly reports (`06_weekly_reports/`)

Student signature: ____________   Supervisor signature: ____________   Date: ____________
