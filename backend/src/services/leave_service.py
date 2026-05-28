from src.common.db import execute, json_array_query, json_object_query, query_scalar, sql_literal
from src.services.audit_service import write_audit


def list_leaves(page_no, page_size, filters):
    where_parts = ["1=1"]
    if filters.get("employee_id"):
        where_parts.append(f"l.employee_id = {int(filters['employee_id'])}")
    if filters.get("approval_status"):
        where_parts.append(f"l.approval_status = {sql_literal(filters['approval_status'])}")
    if filters.get("start_date"):
        where_parts.append(f"l.start_date >= {sql_literal(filters['start_date'])}")
    if filters.get("end_date"):
        where_parts.append(f"l.end_date <= {sql_literal(filters['end_date'])}")

    where_clause = " AND ".join(where_parts)
    offset = (page_no - 1) * page_size
    count_sql = f"SELECT COUNT(*) FROM leave_request l WHERE {where_clause};"
    list_sql = f"""
    SELECT
        l.leave_id,
        l.employee_id,
        e.employee_no,
        e.full_name,
        l.leave_type,
        l.start_date,
        l.end_date,
        l.reason,
        l.approval_status,
        l.leave_type_id,
        lt.leave_code,
        lt.leave_name,
        l.approver_user_id,
        au.full_name AS approver_name,
        l.approved_at,
        l.approval_comment,
        l.created_at
    FROM leave_request l
    JOIN employee e ON e.employee_id = l.employee_id
    LEFT JOIN leave_type lt ON lt.leave_type_id = l.leave_type_id
    LEFT JOIN sys_user au ON au.user_id = l.approver_user_id
    WHERE {where_clause}
    ORDER BY l.leave_id DESC
    LIMIT {page_size} OFFSET {offset}
    """
    total = int(query_scalar(count_sql) or "0")
    rows = json_array_query(list_sql)
    return rows, total


def create_leave(payload, actor):
    sql = f"""
    INSERT INTO leave_request (
        employee_id, leave_type, start_date, end_date, reason, approval_status,
        leave_type_id
    )
    VALUES (
        {int(payload['employee_id'])},
        {sql_literal(payload['leave_type'])},
        {sql_literal(payload['start_date'])},
        {sql_literal(payload['end_date'])},
        {sql_literal(payload.get('reason'))},
        {sql_literal(payload.get('approval_status', 'pending'))},
        {sql_literal(payload.get('leave_type_id'))}
    )
    RETURNING leave_id;
    """
    leave_id = int(query_scalar(sql))
    write_audit(actor, "create", "leave_request", str(leave_id), "created leave request")
    return get_leave(leave_id)


def get_leave(leave_id):
    return json_object_query(
        f"""
        SELECT
            l.leave_id,
            l.employee_id,
            e.employee_no,
            e.full_name,
            l.leave_type,
            l.start_date,
            l.end_date,
            l.reason,
            l.approval_status,
            l.leave_type_id,
            lt.leave_code,
            lt.leave_name,
            l.approver_user_id,
            au.full_name AS approver_name,
            l.approved_at,
            l.approval_comment,
            l.created_at
        FROM leave_request l
        JOIN employee e ON e.employee_id = l.employee_id
        LEFT JOIN leave_type lt ON lt.leave_type_id = l.leave_type_id
        LEFT JOIN sys_user au ON au.user_id = l.approver_user_id
        WHERE l.leave_id = {int(leave_id)}
        """
    )


def update_leave_status(leave_id, status, actor, comment=None):
    if status in ("approved", "rejected"):
        user_id_sql = f"SELECT user_id FROM sys_user WHERE username = {sql_literal(actor)}"
        user_id = query_scalar(user_id_sql)
        comment_part = f", approval_comment = {sql_literal(comment)}" if comment else ", approval_comment = NULL"
        execute(
            f"UPDATE leave_request SET approval_status = {sql_literal(status)}, "
            f"approver_user_id = {sql_literal(user_id)}, "
            f"approved_at = CURRENT_TIMESTAMP{comment_part} "
            f"WHERE leave_id = {int(leave_id)};"
        )
    else:
        execute(
            f"UPDATE leave_request SET approval_status = {sql_literal(status)} WHERE leave_id = {int(leave_id)};"
        )
    write_audit(actor, status, "leave_request", str(leave_id), f"leave set to {status}")
    return get_leave(leave_id)
