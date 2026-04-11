from src.common.db import json_array_query, query_scalar, sql_literal


def list_audits(page_no, page_size, filters):
    where_parts = ["1=1"]
    if filters.get("username"):
        where_parts.append(f"username ILIKE '%' || {sql_literal(filters['username'])} || '%'")
    if filters.get("action_type"):
        where_parts.append(f"action_type = {sql_literal(filters['action_type'])}")
    if filters.get("target_type"):
        where_parts.append(f"target_type = {sql_literal(filters['target_type'])}")
    if filters.get("start_time"):
        where_parts.append(f"created_at >= {sql_literal(filters['start_time'])}")
    if filters.get("end_time"):
        where_parts.append(f"created_at <= {sql_literal(filters['end_time'])}")

    where_clause = " AND ".join(where_parts)
    offset = (page_no - 1) * page_size
    count_sql = f"SELECT COUNT(*) FROM audit_log WHERE {where_clause};"
    list_sql = f"""
    SELECT audit_id, username, action_type, target_type, target_id, action_detail, created_at
    FROM audit_log
    WHERE {where_clause}
    ORDER BY audit_id DESC
    LIMIT {page_size} OFFSET {offset}
    """
    total = int(query_scalar(count_sql) or "0")
    rows = json_array_query(list_sql)
    return rows, total


def list_backups():
    return []
