from src.common.db import json_array_query, json_object_query, query_scalar, sql_literal


def get_dashboard_stats():
    total_employees = int(query_scalar("SELECT COUNT(*) FROM employee;") or "0")
    active_employees = int(query_scalar(
        "SELECT COUNT(*) FROM employee WHERE employment_status = 'active';"
    ) or "0")
    inactive_employees = total_employees - active_employees

    total_departments = int(query_scalar(
        "SELECT COUNT(*) FROM department WHERE status = 1;"
    ) or "0")

    pending_leaves = int(query_scalar(
        "SELECT COUNT(*) FROM leave_request WHERE approval_status = 'pending';"
    ) or "0")

    dept_stats = json_array_query(
        """
        SELECT d.department_name, COUNT(e.employee_id) AS employee_count
        FROM department d
        LEFT JOIN employee e ON e.department_id = d.department_id AND e.employment_status = 'active'
        WHERE d.status = 1
        GROUP BY d.department_id, d.department_name
        ORDER BY employee_count DESC
        """
    )

    leave_type_stats = json_array_query(
        """
        SELECT
            COALESCE(lt.leave_name, lr.leave_type) AS leave_name,
            COUNT(*) AS total,
            SUM(CASE WHEN lr.approval_status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN lr.approval_status = 'approved' THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN lr.approval_status = 'rejected' THEN 1 ELSE 0 END) AS rejected
        FROM leave_request lr
        LEFT JOIN leave_type lt ON lt.leave_type_id = lr.leave_type_id
        GROUP BY lt.leave_name, lr.leave_type
        ORDER BY total DESC
        """
    )

    recent_changes = json_array_query(
        """
        SELECT username, action_type, target_type, action_detail, created_at
        FROM audit_log
        ORDER BY audit_id DESC
        LIMIT 5
        """
    )

    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
        "inactive_employees": inactive_employees,
        "total_departments": total_departments,
        "pending_leaves": pending_leaves,
        "dept_stats": dept_stats,
        "leave_type_stats": leave_type_stats,
        "recent_changes": recent_changes,
    }


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
