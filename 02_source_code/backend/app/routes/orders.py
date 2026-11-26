"""
Routes for ORDERS (order requests from the checkout form).

Public (guest):
  POST  /api/orders                    send a new order request (no payment)

Staff (admin + standard user):
  GET   /api/orders                    list with status filter and search
  GET   /api/orders/{id}               order details with its items
  PATCH /api/orders/{id}/status        change the order status

Every create / status change is written to audit_logs.
"""
import re
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.auth import require_staff
from app.db import get_connection, write_audit_log

router = APIRouter(tags=["orders"])

ORDER_STATUSES = ("new", "confirmed", "shipped", "completed", "cancelled")
# Orders in these statuses can no longer be changed
FINAL_STATUSES = ("completed", "cancelled")

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_PATTERN = re.compile(r"^[0-9+\-\s()]*$")


# ---------------------------------------------------------------------------
# Input models
# ---------------------------------------------------------------------------
class OrderItemIn(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=99)


class OrderIn(BaseModel):
    customer_name: str = Field(min_length=2, max_length=100)
    customer_email: str = Field(max_length=150)
    customer_phone: str = Field(default="", max_length=30)
    shipping_address: str = Field(min_length=5, max_length=300)
    comment: str = Field(default="", max_length=500)
    items: list[OrderItemIn] = Field(min_length=1, max_length=50)

    @field_validator("customer_name", "customer_email", "customer_phone", "shipping_address", "comment")
    @classmethod
    def strip_spaces(cls, value: str) -> str:
        return value.strip()

    @field_validator("customer_name")
    @classmethod
    def check_name(cls, value: str) -> str:
        if len(value) < 2:
            raise ValueError("Name must contain at least 2 characters")
        return value

    @field_validator("customer_email")
    @classmethod
    def check_email(cls, value: str) -> str:
        if not EMAIL_PATTERN.match(value):
            raise ValueError("Please enter a valid e-mail address, e.g. name@example.com")
        return value.lower()

    @field_validator("customer_phone")
    @classmethod
    def check_phone(cls, value: str) -> str:
        if not PHONE_PATTERN.match(value):
            raise ValueError("Phone may contain only digits, spaces, '+', '-' and brackets")
        return value

    @field_validator("shipping_address")
    @classmethod
    def check_address(cls, value: str) -> str:
        if len(value) < 5:
            raise ValueError("Address must contain at least 5 characters")
        return value


class StatusIn(BaseModel):
    status: Literal["new", "confirmed", "shipped", "completed", "cancelled"]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.post("/orders", status_code=201)
def create_order(data: OrderIn):
    """Create an order. Prices are taken from the DATABASE, never from the
    browser, so a user cannot change the price by editing the request."""
    # Merge duplicate lines: two lines with the same product -> one line
    quantities: dict[int, int] = {}
    for item in data.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    with get_connection() as conn, conn.cursor() as cur:
        # FOR UPDATE locks the product rows until the end of the transaction,
        # so two customers cannot buy the last item at the same moment.
        cur.execute(
            "SELECT id, name, price, stock, status FROM products WHERE id = ANY(%s) FOR UPDATE",
            (list(quantities.keys()),),
        )
        products = {row["id"]: row for row in cur.fetchall()}

        lines, total = [], Decimal("0")
        for product_id, quantity in quantities.items():
            product = products.get(product_id)
            if product is None or product["status"] != "active":
                raise HTTPException(status_code=400, detail=f"Product #{product_id} is not available.")
            if product["stock"] < quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Only {product['stock']} item(s) of \"{product['name']}\" left in stock.",
                )
            line_total = product["price"] * quantity
            total += line_total
            lines.append((product, quantity, line_total))

        cur.execute(
            """
            INSERT INTO orders (customer_name, customer_email, customer_phone,
                                shipping_address, comment, total_amount, status)
            VALUES (%s, %s, %s, %s, %s, %s, 'new')
            RETURNING id, status, total_amount, created_at
            """,
            (data.customer_name, data.customer_email, data.customer_phone,
             data.shipping_address, data.comment, total),
        )
        order = cur.fetchone()

        for product, quantity, line_total in lines:
            cur.execute(
                """
                INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (order["id"], product["id"], product["name"], product["price"], quantity, line_total),
            )
            # Reserve the goods: decrease stock
            cur.execute("UPDATE products SET stock = stock - %s WHERE id = %s", (quantity, product["id"]))

        write_audit_log(cur, None, "create", "orders", order["id"])
        return order


@router.get("/orders")
def list_orders(
    status: str = Query(default="all"),
    search: str = Query(default="", max_length=100),
    _user=Depends(require_staff),
):
    if status not in ORDER_STATUSES + ("all",):
        raise HTTPException(status_code=400, detail="Unknown order status filter.")

    conditions, params = [], []
    if status != "all":
        conditions.append("o.status = %s")
        params.append(status)
    if search.strip():
        conditions.append("(o.customer_name ILIKE %s OR o.customer_email ILIKE %s OR CAST(o.id AS TEXT) = %s)")
        params += [f"%{search.strip()}%", f"%{search.strip()}%", search.strip().lstrip("#")]
    where_sql = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT o.id, o.customer_name, o.customer_email, o.total_amount, o.status,
                   o.created_at, o.updated_at,
                   (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS items_count
            FROM orders o
            {where_sql}
            ORDER BY o.created_at DESC
            """,
            params,
        )
        return cur.fetchall()


@router.get("/orders/{order_id}")
def get_order(order_id: int, _user=Depends(require_staff)):
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
        order = cur.fetchone()
        if order is None:
            raise HTTPException(status_code=404, detail="Order not found.")
        cur.execute(
            "SELECT id, product_id, product_name, unit_price, quantity, line_total "
            "FROM order_items WHERE order_id = %s ORDER BY id",
            (order_id,),
        )
        order["items"] = cur.fetchall()
        return order


@router.patch("/orders/{order_id}/status")
def change_order_status(order_id: int, data: StatusIn, user=Depends(require_staff)):
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, status FROM orders WHERE id = %s FOR UPDATE", (order_id,))
        order = cur.fetchone()
        if order is None:
            raise HTTPException(status_code=404, detail="Order not found.")
        if order["status"] in FINAL_STATUSES:
            raise HTTPException(status_code=400, detail=f"A {order['status']} order cannot be changed.")
        if order["status"] == data.status:
            raise HTTPException(status_code=400, detail="The order already has this status.")

        # A cancelled order returns its goods back to stock
        if data.status == "cancelled":
            cur.execute(
                """
                UPDATE products p SET stock = p.stock + oi.quantity
                FROM order_items oi
                WHERE oi.order_id = %s AND oi.product_id = p.id
                """,
                (order_id,),
            )

        cur.execute(
            "UPDATE orders SET status = %s WHERE id = %s RETURNING id, status, updated_at",
            (data.status, order_id),
        )
        updated = cur.fetchone()
        write_audit_log(cur, user["id"], "status_change", "orders", order_id)
        return updated
