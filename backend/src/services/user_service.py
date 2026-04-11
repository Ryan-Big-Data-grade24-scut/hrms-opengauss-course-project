from src.common.db import execute, json_array_query, json_object_query, query_scalar, sql_literal
from src.common.security import hash_password
from src.services.audit_service import write_audit


def list_users(page_no, page_size, username=None, status=None):
    filters = []
    if username:
        filters.append(f"u.username ILIKE '%' || {sql_literal(username)} || '%'")
    if status is not None:
        filters.append(f"u.status = {int(status)}")
    where_clause = " AND ".join(filters) if filters else "1=1"
    offset = (page_no - 1) * page_size

    count_sql = f"SELECT COUNT(*) FROM sys_user u WHERE {where_clause};"
    list_sql = f"""
    SELECT
        u.user_id,
        u.username,
        u.full_name,
        u.phone,
        u.email,
        u.status,
        u.created_at,
        COALESCE((
            SELECT json_agg(role_code)
            FROM (
                SELECT DISTINCT r.role_code
                FROM sys_user_role ur
                JOIN sys_role r ON r.role_id = ur.role_id
                WHERE ur.user_id = u.user_id
                ORDER BY r.role_code
            ) roles
        ), '[]'::json) AS roles
    FROM sys_user u
    WHERE {where_clause}
    ORDER BY u.user_id DESC
    LIMIT {page_size} OFFSET {offset}
    """
    total = int(query_scalar(count_sql) or "0")
    rows = json_array_query(list_sql)
    return rows, total


def create_user(payload, actor):
    username = payload["username"].strip()
    password = payload.get("password", "123456")
    full_name = payload.get("full_name", username)
    phone = payload.get("phone")
    email = payload.get("email")
    status = int(payload.get("status", 1))
    sql = f"""
    INSERT INTO sys_user (username, password_hash, full_name, phone, email, status)
    VALUES (
        {sql_literal(username)},
        {sql_literal(hash_password(password))},
        {sql_literal(full_name)},
        {sql_literal(phone)},
        {sql_literal(email)},
        {status}
    )
    RETURNING user_id;
    """
    user_id = int(query_scalar(sql))
    write_audit(actor, "create", "sys_user", str(user_id), f"created user {username}")
    return get_user(user_id)


def get_user(user_id):
    return json_object_query(
        f"""
        SELECT
            u.user_id,
            u.username,
            u.full_name,
            u.phone,
            u.email,
            u.status,
            u.created_at,
            COALESCE((
                SELECT json_agg(role_code)
                FROM (
                    SELECT DISTINCT r.role_code
                    FROM sys_user_role ur
                    JOIN sys_role r ON r.role_id = ur.role_id
                    WHERE ur.user_id = u.user_id
                    ORDER BY r.role_code
                ) roles
            ), '[]'::json) AS roles
        FROM sys_user u
        WHERE u.user_id = {int(user_id)}
        """
    )


def update_user(user_id, payload, actor):
    fields = []
    if "full_name" in payload:
        fields.append(f"full_name = {sql_literal(payload['full_name'])}")
    if "phone" in payload:
        fields.append(f"phone = {sql_literal(payload['phone'])}")
    if "email" in payload:
        fields.append(f"email = {sql_literal(payload['email'])}")
    if "status" in payload:
        fields.append(f"status = {int(payload['status'])}")
    if payload.get("password"):
        fields.append(f"password_hash = {sql_literal(hash_password(payload['password']))}")
    if not fields:
        return get_user(user_id)
    sql = f"UPDATE sys_user SET {', '.join(fields)} WHERE user_id = {int(user_id)};"
    execute(sql)
    write_audit(actor, "update", "sys_user", str(user_id), "updated user")
    return get_user(user_id)


def delete_user(user_id, actor):
    execute(f"DELETE FROM sys_user WHERE user_id = {int(user_id)};")
    write_audit(actor, "delete", "sys_user", str(user_id), "deleted user")


def list_roles():
    return json_array_query(
        """
        SELECT role_id, role_code, role_name, description
        FROM sys_role
        ORDER BY role_id
        """
    )


def replace_user_roles(user_id, role_ids, actor):
    execute(f"DELETE FROM sys_user_role WHERE user_id = {int(user_id)};")
    for role_id in role_ids:
        execute(
            f"""
            INSERT INTO sys_user_role (user_id, role_id)
            VALUES ({int(user_id)}, {int(role_id)});
            """
        )
    write_audit(actor, "assign", "sys_user_role", str(user_id), "updated user roles")
    return get_user(user_id)
