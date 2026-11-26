"""
Login routes for the admin panel.

POST /api/auth/login  -> check e-mail + password, return a token
GET  /api/auth/me     -> information about the logged-in user
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import create_token, require_staff, verify_password
from app.db import get_connection, write_audit_log

router = APIRouter(tags=["auth"])


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=150)
    password: str = Field(min_length=1, max_length=200)


@router.post("/auth/login")
def login(data: LoginIn):
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, full_name, email, role, password_hash FROM users "
            "WHERE LOWER(email) = LOWER(%s) AND is_active = TRUE",
            (data.email.strip(),),
        )
        user = cur.fetchone()
        # Same message for "unknown e-mail" and "wrong password":
        # an attacker must not learn which e-mails exist.
        if user is None or not verify_password(data.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid e-mail or password.")
        write_audit_log(cur, user["id"], "login", "users", user["id"])

    return {
        "token": create_token(user["id"]),
        "user": {"id": user["id"], "full_name": user["full_name"], "email": user["email"], "role": user["role"]},
    }


@router.get("/auth/me")
def me(user=Depends(require_staff)):
    return user
