"""
Very small authentication module (no external libraries).

- Passwords are stored as PBKDF2-SHA256 hashes (never as plain text).
- After login the user receives a signed token: "<user_id>.<expires>.<signature>".
  The signature is an HMAC made with SECRET_KEY, so the token cannot be
  faked or changed without knowing the key.
- FastAPI "dependencies" (get_current_user, require_staff, require_admin)
  protect the routes that need a logged-in user.
"""
import base64
import hashlib
import hmac
import logging
import os
import secrets
import time

from fastapi import Depends, Header, HTTPException

from app.db import get_connection

logger = logging.getLogger("auth")

PBKDF2_ITERATIONS = 200_000


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    """Return a string like: pbkdf2_sha256$200000$<salt>$<hash>"""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    """Check a password against the stored hash."""
    if not stored_hash:
        return False
    try:
        _algorithm, iterations, salt, expected = stored_hash.split("$")
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations))
    # compare_digest avoids timing attacks
    return hmac.compare_digest(digest.hex(), expected)


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------
def _secret_key() -> bytes:
    key = os.environ.get("SECRET_KEY", "")
    if len(key) < 16:
        # Refuse to work with an empty / too short key instead of being insecure.
        raise RuntimeError("SECRET_KEY environment variable is missing or too short")
    return key.encode()


def _sign(message: str) -> str:
    signature = hmac.new(_secret_key(), message.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(signature).decode().rstrip("=")


def create_token(user_id: int) -> str:
    ttl_minutes = int(os.environ.get("TOKEN_TTL_MINUTES", "120"))
    expires = int(time.time()) + ttl_minutes * 60
    message = f"{user_id}.{expires}"
    return f"{message}.{_sign(message)}"


def read_token(token: str) -> int | None:
    """Return the user id from a valid token, or None if the token is bad/expired."""
    try:
        user_id, expires, signature = token.split(".")
        message = f"{user_id}.{expires}"
        if not hmac.compare_digest(signature, _sign(message)):
            return None
        if int(expires) < time.time():
            return None
        return int(user_id)
    except (ValueError, AttributeError):
        return None


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------
def get_current_user(authorization: str | None = Header(default=None)):
    """Return the logged-in user (dict) or None for a guest.

    The browser sends the header:  Authorization: Bearer <token>
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    user_id = read_token(authorization.removeprefix("Bearer ").strip())
    if user_id is None:
        return None
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, full_name, email, role FROM users WHERE id = %s AND is_active = TRUE",
            (user_id,),
        )
        return cur.fetchone()


def require_staff(user=Depends(get_current_user)):
    """Allow administrators AND standard users (the shop staff)."""
    if user is None:
        raise HTTPException(status_code=401, detail="Please log in to continue.")
    return user


def require_admin(user=Depends(require_staff)):
    """Allow only administrators."""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only an administrator can do this.")
    return user


# ---------------------------------------------------------------------------
# Demo accounts
# ---------------------------------------------------------------------------
def ensure_demo_passwords():
    """Give the seeded demo users a password taken from the environment.

    The seed SQL creates the demo users WITHOUT a password, so no password is
    ever stored in the Git repository. On start-up we set it once (only if it
    is still empty).
    """
    demo_accounts = {
        "admin@example.local": os.environ.get("DEMO_ADMIN_PASSWORD", ""),
        "staff@example.local": os.environ.get("DEMO_STAFF_PASSWORD", ""),
    }
    with get_connection() as conn, conn.cursor() as cur:
        for email, password in demo_accounts.items():
            if len(password) < 8:
                logger.warning("Demo password for %s is not set or shorter than 8 characters", email)
                continue
            cur.execute(
                "UPDATE users SET password_hash = %s WHERE email = %s AND password_hash IS NULL",
                (hash_password(password), email),
            )
            if cur.rowcount:
                logger.info("Demo password set for %s", email)
