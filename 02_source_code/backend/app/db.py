"""
Database helper functions.

All connection settings come from ENVIRONMENT VARIABLES (filled from the
.env file by Docker Compose). Nothing secret is written in the code.
"""
import os

import psycopg
from psycopg.rows import dict_row


def get_connection():
    """Open a new connection to PostgreSQL.

    Usage:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")

    When the "with" block ends without an error the transaction is COMMITTED.
    If an error happens inside the block, it is ROLLED BACK automatically.
    The connection is closed at the end of the block in both cases.
    """
    return psycopg.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", "5432")),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        # Rows are returned as dictionaries: {"id": 1, "name": "..."}
        row_factory=dict_row,
        connect_timeout=5,
    )


def write_audit_log(cur, user_id, action, entity_name, entity_id):
    """Insert one row into audit_logs using the SAME cursor (same transaction).

    user_id can be None when a guest performed the action (e.g. new order).
    """
    cur.execute(
        """
        INSERT INTO audit_logs (user_id, action, entity_name, entity_id)
        VALUES (%s, %s, %s, %s)
        """,
        (user_id, action, entity_name, entity_id),
    )
