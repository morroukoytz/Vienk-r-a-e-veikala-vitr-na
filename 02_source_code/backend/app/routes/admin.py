"""
Administrator-only routes: users, audit log and system settings.

GET /api/users          list of users           (admin)
GET /api/audit-logs     latest audit records    (admin)
GET /api/settings       public shop settings    (everyone)
PUT /api/settings       change settings         (admin)
"""
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.auth import require_admin
from app.db import get_connection, write_audit_log

router = APIRouter(tags=["administration"])

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SettingsIn(BaseModel):
    store_name: str = Field(min_length=2, max_length=80)
    contact_email: str = Field(max_length=150)
    currency: str = Field(min_length=3, max_length=3)
    low_stock_threshold: int = Field(ge=0, le=1000)

    @field_validator("store_name", "contact_email")
    @classmethod
    def strip_spaces(cls, value: str) -> str:
        return value.strip()

    @field_validator("contact_email")
    @classmethod
    def check_email(cls, value: str) -> str:
        if not EMAIL_PATTERN.match(value):
            raise ValueError("Please enter a valid e-mail address")
        return value

    @field_validator("currency")
    @classmethod
    def check_currency(cls, value: str) -> str:
        value = value.strip().upper()
        if not value.isalpha():
            raise ValueError("Currency must be a 3-letter code, e.g. EUR")
        return value


@router.get("/users")
def list_users(_user=Depends(require_admin)):
    with get_connection() as conn, conn.cursor() as cur:
        # password_hash is intentionally NOT selected
        cur.execute(
            "SELECT id, full_name, email, role, is_active, created_at, updated_at FROM users ORDER BY id"
        )
        return cur.fetchall()


@router.get("/audit-logs")
def list_audit_logs(limit: int = Query(default=50, ge=1, le=200), _user=Depends(require_admin)):
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.id, a.action, a.entity_name, a.entity_id, a.created_at,
                   COALESCE(u.email, 'guest') AS user_email
            FROM audit_logs a
            LEFT JOIN users u ON u.id = a.user_id
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


@router.get("/settings")
def get_settings():
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT key, value FROM settings")
        return {row["key"]: row["value"] for row in cur.fetchall()}


@router.put("/settings")
def update_settings(data: SettingsIn, user=Depends(require_admin)):
    values = data.model_dump()
    with get_connection() as conn, conn.cursor() as cur:
        for key, value in values.items():
            # "UPSERT": insert the key or update it if it already exists
            cur.execute(
                """
                INSERT INTO settings (key, value) VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                """,
                (key, str(value)),
            )
        write_audit_log(cur, user["id"], "update", "settings", None)
    return {key: str(value) for key, value in values.items()}
