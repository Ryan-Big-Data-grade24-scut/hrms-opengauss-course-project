import hashlib
import json
import secrets
from datetime import datetime, timedelta

from src.common.db import execute, json_object_query, query_scalar, sql_literal


def hash_password(password):
    digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return f"sha256${digest}"


def verify_password(raw_password, stored_hash):
    if not stored_hash:
        return False
    if stored_hash.startswith("sha256$"):
        return stored_hash == hash_password(raw_password)
    if stored_hash.startswith("demo_"):
        return raw_password == "123456"
    return raw_password == stored_hash


def create_token(profile, ttl_hours=12):
    token = secrets.token_hex(24)
    expires_at = datetime.utcnow() + timedelta(hours=ttl_hours)
    execute(
        f"""
        INSERT INTO auth_token (token, user_id, profile_json, expires_at)
        VALUES (
            {sql_literal(token)},
            {int(profile['user_id'])},
            {sql_literal(json.dumps(profile))},
            {sql_literal(expires_at.isoformat())}
        );
        """
    )
    return token


def get_profile(token):
    if not token:
        return None
    row = json_object_query(
        f"""
        SELECT profile_json, expires_at FROM auth_token WHERE token = {sql_literal(token)}
        """
    )
    if not row:
        return None
    expires_at = datetime.fromisoformat(row["expires_at"])
    if expires_at < datetime.utcnow():
        execute(f"DELETE FROM auth_token WHERE token = {sql_literal(token)};")
        return None
    return json.loads(row["profile_json"])


def delete_token(token):
    execute(f"DELETE FROM auth_token WHERE token = {sql_literal(token)};")
