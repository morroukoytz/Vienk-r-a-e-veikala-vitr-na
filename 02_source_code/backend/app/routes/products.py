"""
Routes for CATEGORIES and PRODUCTS.

Public (guest) access:
  GET  /api/categories            list of categories
  GET  /api/products              catalogue (only "active" products for guests)
  GET  /api/products/{id}         product details

Staff (admin + standard user):
  POST /api/categories, PUT /api/categories/{id}
  POST /api/products,   PUT /api/products/{id}   (only an admin may set status "archived")

Administrator only:
  DELETE /api/categories/{id}     (only if the category has no products)
  DELETE /api/products/{id}       (archives the product = soft delete)
"""
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.auth import get_current_user, require_admin, require_staff
from app.db import get_connection, write_audit_log

router = APIRouter(tags=["catalogue"])

PRODUCT_STATUSES = ("draft", "active", "archived")


# ---------------------------------------------------------------------------
# Input models (Pydantic checks the data and returns clear errors)
# ---------------------------------------------------------------------------
class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=500)

    @field_validator("name", "description")
    @classmethod
    def strip_spaces(cls, value: str) -> str:
        return value.strip()

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        if len(value) < 2:
            raise ValueError("Name must contain at least 2 characters")
        return value


class ProductIn(BaseModel):
    category_id: int = Field(gt=0)
    name: str = Field(min_length=2, max_length=120)
    sku: str = Field(min_length=3, max_length=40)
    description: str = Field(default="", max_length=2000)
    price: Decimal = Field(gt=0, le=100000, decimal_places=2)
    stock: int = Field(ge=0, le=100000)
    status: Literal["draft", "active", "archived"] = "active"

    @field_validator("name", "description")
    @classmethod
    def strip_spaces(cls, value: str) -> str:
        return value.strip()

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        if len(value) < 2:
            raise ValueError("Name must contain at least 2 characters")
        return value

    @field_validator("sku")
    @classmethod
    def sku_format(cls, value: str) -> str:
        value = value.strip().upper()
        allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-")
        if len(value) < 3 or not set(value) <= allowed:
            raise ValueError("SKU may contain only letters, digits and '-' (at least 3 characters)")
        return value


# SQL used by several product routes (product + its category name)
PRODUCT_SELECT = """
    SELECT p.id, p.category_id, c.name AS category_name, p.name, p.sku,
           p.description, p.price, p.stock, p.status, p.created_at, p.updated_at
    FROM products p
    JOIN categories c ON c.id = p.category_id
"""


def _check_archive_permission(user, new_status: str, old_status: str | None = None):
    """Only an administrator may archive a product (archiving = deleting)."""
    if new_status == "archived" and old_status != "archived" and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only an administrator can archive products.")


def _category_exists(cur, category_id: int) -> bool:
    cur.execute("SELECT 1 FROM categories WHERE id = %s", (category_id,))
    return cur.fetchone() is not None


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------
@router.get("/categories")
def list_categories():
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.id, c.name, c.description, c.created_at, c.updated_at,
                   COUNT(p.id) FILTER (WHERE p.status = 'active') AS active_products,
                   COUNT(p.id) AS total_products
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id
            GROUP BY c.id
            ORDER BY c.name
            """
        )
        return cur.fetchall()


@router.post("/categories", status_code=201)
def create_category(data: CategoryIn, user=Depends(require_staff)):
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM categories WHERE LOWER(name) = LOWER(%s)", (data.name,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="A category with this name already exists.")
        cur.execute(
            "INSERT INTO categories (name, description) VALUES (%s, %s) RETURNING *",
            (data.name, data.description),
        )
        category = cur.fetchone()
        write_audit_log(cur, user["id"], "create", "categories", category["id"])
        return category


@router.put("/categories/{category_id}")
def update_category(category_id: int, data: CategoryIn, user=Depends(require_staff)):
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM categories WHERE LOWER(name) = LOWER(%s) AND id <> %s",
            (data.name, category_id),
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="A category with this name already exists.")
        cur.execute(
            "UPDATE categories SET name = %s, description = %s WHERE id = %s RETURNING *",
            (data.name, data.description, category_id),
        )
        category = cur.fetchone()
        if category is None:
            raise HTTPException(status_code=404, detail="Category not found.")
        write_audit_log(cur, user["id"], "update", "categories", category_id)
        return category


@router.delete("/categories/{category_id}")
def delete_category(category_id: int, user=Depends(require_admin)):
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM products WHERE category_id = %s", (category_id,))
        if cur.fetchone()["n"] > 0:
            raise HTTPException(
                status_code=409,
                detail="This category still has products. Move or archive them first.",
            )
        cur.execute("DELETE FROM categories WHERE id = %s", (category_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Category not found.")
        write_audit_log(cur, user["id"], "delete", "categories", category_id)
        return {"message": "Category deleted."}


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------
@router.get("/products")
def list_products(
    search: str = Query(default="", max_length=100),
    category_id: int | None = Query(default=None, gt=0),
    status: str = Query(default="active"),
    sort: Literal["name", "price_asc", "price_desc", "newest"] = "name",
    user=Depends(get_current_user),
):
    """Catalogue list with search, category filter and sorting.

    Guests always see only "active" products. Staff may pass
    status=all | draft | active | archived.
    """
    if user is None:
        status = "active"
    elif status not in PRODUCT_STATUSES + ("all",):
        raise HTTPException(status_code=400, detail="Unknown product status filter.")

    # Build the WHERE part step by step. Values are passed as parameters (%s),
    # never glued into the SQL text -> protection against SQL injection.
    conditions, params = [], []
    if status != "all":
        conditions.append("p.status = %s")
        params.append(status)
    if search.strip():
        conditions.append("(p.name ILIKE %s OR p.description ILIKE %s OR p.sku ILIKE %s)")
        pattern = f"%{search.strip()}%"
        params += [pattern, pattern, pattern]
    if category_id:
        conditions.append("p.category_id = %s")
        params.append(category_id)

    where_sql = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    order_sql = {
        "name": "p.name ASC",
        "price_asc": "p.price ASC",
        "price_desc": "p.price DESC",
        "newest": "p.created_at DESC",
    }[sort]

    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(f"{PRODUCT_SELECT} {where_sql} ORDER BY {order_sql}", params)
        return cur.fetchall()


@router.get("/products/{product_id}")
def get_product(product_id: int, user=Depends(get_current_user)):
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(f"{PRODUCT_SELECT} WHERE p.id = %s", (product_id,))
        product = cur.fetchone()
    # Guests must not see draft / archived products
    if product is None or (user is None and product["status"] != "active"):
        raise HTTPException(status_code=404, detail="Product not found.")
    return product


@router.post("/products", status_code=201)
def create_product(data: ProductIn, user=Depends(require_staff)):
    _check_archive_permission(user, data.status)
    with get_connection() as conn, conn.cursor() as cur:
        if not _category_exists(cur, data.category_id):
            raise HTTPException(status_code=400, detail="The selected category does not exist.")
        cur.execute("SELECT 1 FROM products WHERE sku = %s", (data.sku,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="A product with this SKU already exists.")
        cur.execute(
            """
            INSERT INTO products (category_id, name, sku, description, price, stock, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (data.category_id, data.name, data.sku, data.description, data.price, data.stock, data.status),
        )
        new_id = cur.fetchone()["id"]
        write_audit_log(cur, user["id"], "create", "products", new_id)
        cur.execute(f"{PRODUCT_SELECT} WHERE p.id = %s", (new_id,))
        return cur.fetchone()


@router.put("/products/{product_id}")
def update_product(product_id: int, data: ProductIn, user=Depends(require_staff)):
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT status FROM products WHERE id = %s", (product_id,))
        current = cur.fetchone()
        if current is None:
            raise HTTPException(status_code=404, detail="Product not found.")
        _check_archive_permission(user, data.status, current["status"])
        if not _category_exists(cur, data.category_id):
            raise HTTPException(status_code=400, detail="The selected category does not exist.")
        cur.execute("SELECT 1 FROM products WHERE sku = %s AND id <> %s", (data.sku, product_id))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="A product with this SKU already exists.")
        cur.execute(
            """
            UPDATE products
            SET category_id = %s, name = %s, sku = %s, description = %s,
                price = %s, stock = %s, status = %s
            WHERE id = %s
            """,
            (data.category_id, data.name, data.sku, data.description,
             data.price, data.stock, data.status, product_id),
        )
        write_audit_log(cur, user["id"], "update", "products", product_id)
        cur.execute(f"{PRODUCT_SELECT} WHERE p.id = %s", (product_id,))
        return cur.fetchone()


@router.delete("/products/{product_id}")
def archive_product(product_id: int, user=Depends(require_admin)):
    """Soft delete: the product gets status "archived".

    We do not remove the row because old orders still refer to it.
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("UPDATE products SET status = 'archived' WHERE id = %s", (product_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Product not found.")
        write_audit_log(cur, user["id"], "archive", "products", product_id)
        return {"message": "Product archived."}
