#!/usr/bin/env bash
# =====================================================================
# 1-7 Simple E-commerce Catalogue - automated API smoke test
#
# What it does: sends real HTTP requests to the running application and
# compares the HTTP status code with the expected one (PASS / FAIL).
#
# Requirements: the Docker Compose stack is running, curl and python3.
# Run it on a FRESH database (after "down -v" + "up"), from the repo root:
#   bash 05_tests/1-7_api_smoke_test.sh
# Passwords are read from the .env file - they are not written here.
# =====================================================================

set -u
ENV_FILE="${ENV_FILE:-.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Cannot find $ENV_FILE. Run the script from the repository root."
  exit 1
fi
# Read only the variables we need from .env
ADMIN_PW=$(grep -E '^DEMO_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
STAFF_PW=$(grep -E '^DEMO_STAFF_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
PORT=$(grep -E '^FRONTEND_PORT=' "$ENV_FILE" | cut -d= -f2-)
BASE="http://localhost:${PORT:-8080}/api"
JSON="Content-Type: application/json"

PASSED=0
FAILED=0

# check <test id> <description> <expected HTTP code> <curl arguments...>
check() {
  local id="$1" name="$2" expected="$3"
  shift 3
  local code
  code=$(curl -s -o /tmp/smoke_body.txt -w "%{http_code}" "$@")
  if [ "$code" = "$expected" ]; then
    echo "PASS  $id  $name (HTTP $code)"
    PASSED=$((PASSED + 1))
  else
    echo "FAIL  $id  $name (expected $expected, got $code): $(head -c 200 /tmp/smoke_body.txt)"
    FAILED=$((FAILED + 1))
  fi
}

login() {
  curl -s -X POST "$BASE/auth/login" -H "$JSON" -d "{\"email\":\"$1\",\"password\":\"$2\"}" |
    python3 -c 'import sys, json; print(json.load(sys.stdin).get("token", ""))'
}

echo "Testing $BASE"
check TT-01 "Health check"                       200 "$BASE/health"
check FT-01 "Public catalogue list"              200 "$BASE/products"
check FT-02 "Search + category filter"           200 "$BASE/products?search=mouse&category_id=1"
check FT-03 "Product details"                    200 "$BASE/products/1"
check FT-04 "Draft product hidden from guests"   404 "$BASE/products/15"
check FT-05 "Not existing product"               404 "$BASE/products/99999"
check TT-02 "Invalid id format"                  422 "$BASE/products/abc"
check ST-01 "Orders list without login"          401 "$BASE/orders"
check ST-02 "Login with wrong password"          401 -X POST "$BASE/auth/login" -H "$JSON" -d '{"email":"admin@example.local","password":"wrong"}'
check ST-03 "Forged token is rejected"           401 -H "Authorization: Bearer 1.9999999999.fake" "$BASE/dashboard"

ADMIN_TOKEN=$(login admin@example.local "$ADMIN_PW")
STAFF_TOKEN=$(login staff@example.local "$STAFF_PW")
if [ -z "$ADMIN_TOKEN" ] || [ -z "$STAFF_TOKEN" ]; then
  echo "FAIL  Could not log in with the demo passwords from $ENV_FILE"
  exit 1
fi
A="Authorization: Bearer $ADMIN_TOKEN"
S="Authorization: Bearer $STAFF_TOKEN"

check FT-06 "Create product: validation errors"  422 -X POST "$BASE/products" -H "$S" -H "$JSON" -d '{"category_id":1,"name":" ","sku":"a b","price":-5,"stock":1.5}'
check FT-07 "Create product (standard user)"     201 -X POST "$BASE/products" -H "$S" -H "$JSON" -d '{"category_id":1,"name":"Smoke Test Lamp","sku":"SMOKE-001","price":12.50,"stock":3,"status":"active"}'
NEW_ID=$(curl -s "$BASE/products?search=SMOKE-001" | python3 -c 'import sys, json; d = json.load(sys.stdin); print(d[0]["id"] if d else 0)')
check FT-08 "Duplicate SKU"                      409 -X POST "$BASE/products" -H "$S" -H "$JSON" -d '{"category_id":1,"name":"Another","sku":"SMOKE-001","price":1,"stock":1}'
check FT-09 "Edit product"                       200 -X PUT "$BASE/products/$NEW_ID" -H "$S" -H "$JSON" -d '{"category_id":1,"name":"Smoke Test Lamp 2","sku":"SMOKE-001","price":13,"stock":3,"status":"active"}'
check ST-04 "Standard user cannot archive"       403 -X DELETE "$BASE/products/$NEW_ID" -H "$S"
check ST-05 "SQL injection text in search"       200 "$BASE/products?search=%27%20OR%201%3D1--"
check FT-10 "Order: validation errors"           422 -X POST "$BASE/orders" -H "$JSON" -d '{"customer_name":"A","customer_email":"bad","shipping_address":"x","items":[]}'
check FT-11 "Order: more than in stock"          400 -X POST "$BASE/orders" -H "$JSON" -d "{\"customer_name\":\"Smoke Guest\",\"customer_email\":\"guest@example.com\",\"shipping_address\":\"1 Test Street\",\"items\":[{\"product_id\":$NEW_ID,\"quantity\":50}]}"
check FT-12 "Order: created by guest"            201 -X POST "$BASE/orders" -H "$JSON" -d "{\"customer_name\":\"Smoke Guest\",\"customer_email\":\"guest@example.com\",\"shipping_address\":\"1 Test Street\",\"items\":[{\"product_id\":$NEW_ID,\"quantity\":2}]}"
ORDER_ID=$(python3 -c 'import json; print(json.load(open("/tmp/smoke_body.txt"))["id"])')
check FT-13 "Order details"                      200 -H "$S" "$BASE/orders/$ORDER_ID"
check FT-14 "Order list with filter"             200 -H "$S" "$BASE/orders?status=new&search=smoke"
check FT-15 "Change status to confirmed"         200 -X PATCH "$BASE/orders/$ORDER_ID/status" -H "$S" -H "$JSON" -d '{"status":"confirmed"}'
check FT-16 "Unknown status value"               422 -X PATCH "$BASE/orders/$ORDER_ID/status" -H "$S" -H "$JSON" -d '{"status":"paid"}'
check FT-17 "Cancel order"                       200 -X PATCH "$BASE/orders/$ORDER_ID/status" -H "$S" -H "$JSON" -d '{"status":"cancelled"}'
check FT-18 "Cancelled order is final"           400 -X PATCH "$BASE/orders/$ORDER_ID/status" -H "$S" -H "$JSON" -d '{"status":"new"}'
check FT-19 "Dashboard summary"                  200 -H "$S" "$BASE/dashboard"
check ST-06 "Standard user cannot see users"     403 -H "$S" "$BASE/users"
check FT-20 "Admin: users list"                  200 -H "$A" "$BASE/users"
check FT-21 "Admin: audit log"                   200 -H "$A" "$BASE/audit-logs?limit=5"
check FT-22 "Delete category with products"      409 -X DELETE "$BASE/categories/1" -H "$A"
check FT-23 "Admin archives product"             200 -X DELETE "$BASE/products/$NEW_ID" -H "$A"
check FT-24 "Archived product hidden"            404 "$BASE/products/$NEW_ID"
check TT-03 "Malformed JSON body"                422 -X POST "$BASE/orders" -H "$JSON" -d '{bad json'
check TT-04 "Frontend page is served"            200 "http://localhost:${PORT:-8080}/"

echo "-----------------------------------------"
echo "Passed: $PASSED   Failed: $FAILED"
[ "$FAILED" -eq 0 ]
