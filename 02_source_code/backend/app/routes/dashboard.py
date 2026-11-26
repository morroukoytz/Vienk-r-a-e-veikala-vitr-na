"""
Summary statistics for the admin dashboard.

GET /api/dashboard   (staff only)
"""
from fastapi import APIRouter, Depends

from app.auth import require_staff
from app.db import get_connection

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
def get_dashboard(_user=Depends(require_staff)):
    with get_connection() as conn, conn.cursor() as cur:
        # Products grouped by status, e.g. {"active": 14, "draft": 1}
        cur.execute("SELECT status, COUNT(*) AS n FROM products GROUP BY status")
        products_by_status = {row["status"]: row["n"] for row in cur.fetchall()}

        # Orders grouped by status
        cur.execute("SELECT status, COUNT(*) AS n FROM orders GROUP BY status")
        orders_by_status = {row["status"]: row["n"] for row in cur.fetchall()}

        # Revenue of all orders that were not cancelled (simulation only)
        cur.execute("SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE status <> 'cancelled'")
        total_revenue = cur.fetchone()["total"]

        cur.execute("SELECT COUNT(*) AS n FROM categories")
        categories_count = cur.fetchone()["n"]

        # "Low stock" threshold is a system setting (default 5)
        cur.execute("SELECT value FROM settings WHERE key = 'low_stock_threshold'")
        row = cur.fetchone()
        threshold = int(row["value"]) if row and row["value"].isdigit() else 5

        cur.execute(
            """
            SELECT id, name, sku, stock FROM products
            WHERE status = 'active' AND stock <= %s
            ORDER BY stock ASC, name ASC
            LIMIT 10
            """,
            (threshold,),
        )
        low_stock = cur.fetchall()

        cur.execute(
            """
            SELECT id, customer_name, total_amount, status, created_at
            FROM orders ORDER BY created_at DESC LIMIT 5
            """
        )
        latest_orders = cur.fetchall()

    return {
        "products_total": sum(products_by_status.values()),
        "products_by_status": products_by_status,
        "orders_total": sum(orders_by_status.values()),
        "orders_by_status": orders_by_status,
        "total_revenue": total_revenue,
        "categories_count": categories_count,
        "low_stock_threshold": threshold,
        "low_stock_products": low_stock,
        "latest_orders": latest_orders,
    }
