# 07 Screenshots and Evidence

Put here the proof that the application works: screenshots of the UI, Docker containers,
database queries, logs and test results.

## Naming convention
`<number>_<what_is_shown>.png`, for example `14_docker_compose_ps.png`, `15_psql_products.png`.
For weekly evidence you may use `week<N>_<topic>.png`.

## Included sample evidence (generated during the initial verification run)

| File | What it shows |
|------|---------------|
| `01_catalogue_desktop.png` | Catalogue on a laptop screen (1366 px) with cart sidebar |
| `02_catalogue_empty_state.png` | Empty-state message when the search finds nothing |
| `03_checkout_validation.png` | Order form validation errors |
| `04_order_success.png` | Successful order request message |
| `05_product_details.png` | Product details page with quantity validation |
| `06_admin_dashboard.png` | Admin dashboard (summary, latest orders, low stock) |
| `07_admin_product_validation.png` | Product form validation errors |
| `08_admin_products.png` | Products list with statuses (archived product) |
| `09_admin_orders.png` | Orders list and order details with status change |
| `10_admin_users_audit.png` | Users list and audit log |
| `11_admin_settings.png` | System settings form |
| `12_catalogue_mobile.png` | Catalogue on a phone screen (390 px) |
| `13_product_mobile.png` | Product page on a phone screen |
| `api_smoke_test_output.txt` | Output of `05_tests/1-7_api_smoke_test.sh` (34 checks) |
| `docker_and_database_check.txt` | `docker compose ps`, list of tables, hashed demo passwords, backend start-up log |

## Still to add yourself
- Your own screenshot of `docker compose ... ps` in your terminal
- `psql` query result, e.g. `SELECT id, name, status, stock FROM products;`
- screenshots for the manual test cases you executed
