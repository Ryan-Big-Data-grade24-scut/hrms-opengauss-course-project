from src.common.db import bootstrap_rbac, json_object_query, sql_literal
from src.common.security import TOKENS, verify_password


def _profile_sql(username):
    return f"""
    SELECT
        u.user_id,
        u.username,
        u.full_name,
        u.phone,
        u.email,
        u.status,
        COALESCE((
            SELECT json_agg(role_code)
            FROM (
                SELECT DISTINCT r.role_code
                FROM sys_user_role ur
                JOIN sys_role r ON r.role_id = ur.role_id
                WHERE ur.user_id = u.user_id
                ORDER BY r.role_code
            ) roles
        ), '[]'::json) AS roles,
        COALESCE((
            SELECT json_agg(permission_code)
            FROM (
                SELECT DISTINCT p.permission_code
                FROM sys_user_role ur
                JOIN sys_role_permission rp ON rp.role_id = ur.role_id
                JOIN sys_permission p ON p.permission_id = rp.permission_id
                WHERE ur.user_id = u.user_id
                ORDER BY p.permission_code
            ) permissions
        ), '[]'::json) AS permissions,
        u.password_hash
    FROM sys_user u
    WHERE u.username = {sql_literal(username)}
    """


def login(username, password):
    bootstrap_rbac()
    profile = json_object_query(_profile_sql(username))
    if not profile:
        return None
    if int(profile["status"]) != 1:
        return None
    if not verify_password(password, profile["password_hash"]):
        return None
    profile.pop("password_hash", None)
    token = TOKENS.create(profile)
    return {"token": token, "profile": profile}


def get_profile(token):
    return TOKENS.get(token)


def logout(token):
    TOKENS.delete(token)
