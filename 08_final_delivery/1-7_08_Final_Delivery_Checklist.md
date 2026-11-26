# 1-7 Final Delivery Checklist - Simple E-commerce Catalogue

Tick every item before handing in the project. Item numbers can be referenced in the defence.

## A. Repository and security
- [ ] A1. Repository structure matches the required folders `01_` ... `08_`
- [ ] A2. `README.md` explains setup, `.env`, Docker commands, tests and troubleshooting
- [ ] A3. `.env.example` exists and contains **only placeholder values**
- [ ] A4. `.env` is **not** tracked: `git ls-files | grep -x .env` prints nothing
- [ ] A5. No real passwords, personal data or payment data anywhere (seed data uses `example.com` / `example.local`)
- [ ] A6. `.gitignore` excludes `.env`, `__pycache__/`, `node_modules/`, editor and temp files
- [ ] A7. Meaningful commit history (at least one commit per working day)

## B. Documentation (English)
- [ ] B1. `01_documentation/1-7_01_Detailed_Requirements.md`
- [ ] B2. `01_documentation/1-7_02_160h_Weekly_Plan.md`
- [ ] B3. `01_documentation/1-7_03_Setup_And_Run_Guide.md`
- [ ] B4. `03_database/1-7_04_Database_Schema.md`
- [ ] B5. `04_docker/1-7_05_Docker_Instructions.md`
- [ ] B6. `05_tests/1-7_06_Test_Cases.md` with filled results
- [ ] B7. Weekly reports 1-4 filled in (`06_weekly_reports/`)
- [ ] B8. `08_final_delivery/1-7_07_Final_Internship_Report_Template.md` filled in

## C. Database
- [ ] C1. `users` and `audit_logs` tables with the required columns
- [ ] C2. `categories`, `products`, `orders`, `order_items` with foreign keys
- [ ] C3. Status fields with CHECK constraints (products, orders)
- [ ] C4. `created_at` / `updated_at` on key tables, `updated_at` trigger works
- [ ] C5. Indexes for search and filtering
- [ ] C6. Seed data with demo administrator `admin@example.local`

## D. Application features
- [ ] D1. Catalogue with search and category filter
- [ ] D2. Product detail page
- [ ] D3. Cart simulation
- [ ] D4. Order request form with validation (no payment)
- [ ] D5. Create form with validation and clear error messages (products / categories)
- [ ] D6. List with search / filter (catalogue, admin products, orders)
- [ ] D7. Edit and archive / delete records
- [ ] D8. Status changes (product status, order status)
- [ ] D9. Dashboard with summary
- [ ] D10. Empty-state messages
- [ ] D11. Incorrect input handled (wrong IDs, invalid JSON, wrong values)
- [ ] D12. Three roles work as described (guest, standard user, admin)
- [ ] D13. Responsive layout on laptop and phone

## E. Docker
- [ ] E1. `docker compose --env-file .env -f 04_docker/1-7_docker-compose.yml up -d --build` starts all services
- [ ] E2. Frontend on port 8080, `/api` proxied by nginx
- [ ] E3. PostgreSQL 15 initialised from `03_database/*.sql`, data in volume `db_data`
- [ ] E4. `down` keeps data, `down -v` resets the database
- [ ] E5. Project starts from a **clean clone** following only the README

## F. Testing and evidence
- [ ] F1. `bash 05_tests/1-7_api_smoke_test.sh` -> `Failed: 0` (output saved)
- [ ] F2. Manual UI test cases executed
- [ ] F3. Security test cases executed
- [ ] F4. Screenshots in `07_screenshots_and_evidence/`: catalogue (laptop + phone), product page,
      cart and order success, validation errors, admin dashboard, products, orders, audit log,
      `docker compose ps`, database query result

## G. Defence preparation
- [ ] G1. Demo scenario rehearsed (see setup guide, section 5)
- [ ] G2. Can explain: request flow, database relations, how roles are checked, how secrets are kept out of Git
- [ ] G3. Can show and explain any file of the source code
- [ ] G4. Presentation / slides ready (if required)

Student: ____________  Date: ____________  Mentor approval: ____________
