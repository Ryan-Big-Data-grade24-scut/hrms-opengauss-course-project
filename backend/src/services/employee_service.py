from src.common.db import execute, json_array_query, json_object_query, query_scalar, sql_literal
from src.services.audit_service import write_audit


def list_employees(page_no, page_size, filters):
    where_parts = ["1=1"]
    keyword = filters.get("keyword")
    if keyword:
        where_parts.append(
            f"(e.employee_no ILIKE '%' || {sql_literal(keyword)} || '%' "
            f"OR e.full_name ILIKE '%' || {sql_literal(keyword)} || '%')"
        )
    if filters.get("department_id"):
        where_parts.append(f"e.department_id = {int(filters['department_id'])}")
    if filters.get("position_id"):
        where_parts.append(f"e.position_id = {int(filters['position_id'])}")
    if filters.get("employment_status"):
        where_parts.append(f"e.employment_status = {sql_literal(filters['employment_status'])}")
    if filters.get("hire_date_start"):
        where_parts.append(f"e.hire_date >= {sql_literal(filters['hire_date_start'])}")
    if filters.get("hire_date_end"):
        where_parts.append(f"e.hire_date <= {sql_literal(filters['hire_date_end'])}")

    where_clause = " AND ".join(where_parts)
    offset = (page_no - 1) * page_size
    count_sql = f"SELECT COUNT(*) FROM employee e WHERE {where_clause};"
    list_sql = f"""
    SELECT
        e.employee_id,
        e.employee_no,
        e.full_name,
        e.gender,
        e.phone,
        e.email,
        e.hire_date,
        e.employment_status,
        e.department_id,
        d.department_name,
        e.position_id,
        p.position_name,
        e.created_at
    FROM employee e
    LEFT JOIN department d ON d.department_id = e.department_id
    LEFT JOIN position p ON p.position_id = e.position_id
    WHERE {where_clause}
    ORDER BY e.employee_id DESC
    LIMIT {page_size} OFFSET {offset}
    """
    total = int(query_scalar(count_sql) or "0")
    rows = json_array_query(list_sql)
    return rows, total


def get_employee(employee_id):
    return json_object_query(
        f"""
        SELECT
            e.employee_id,
            e.employee_no,
            e.full_name,
            e.gender,
            e.phone,
            e.email,
            e.hire_date,
            e.employment_status,
            e.department_id,
            d.department_name,
            e.position_id,
            p.position_name,
            e.created_at
        FROM employee e
        LEFT JOIN department d ON d.department_id = e.department_id
        LEFT JOIN position p ON p.position_id = e.position_id
        WHERE e.employee_id = {int(employee_id)}
        """
    )


def create_employee(payload, actor):
    sql = f"""
    INSERT INTO employee (
        employee_no, full_name, gender, phone, email, hire_date,
        employment_status, department_id, position_id
    )
    VALUES (
        {sql_literal(payload['employee_no'])},
        {sql_literal(payload['full_name'])},
        {sql_literal(payload.get('gender'))},
        {sql_literal(payload.get('phone'))},
        {sql_literal(payload.get('email'))},
        {sql_literal(payload['hire_date'])},
        {sql_literal(payload.get('employment_status', 'active'))},
        {sql_literal(payload.get('department_id'))},
        {sql_literal(payload.get('position_id'))}
    )
    RETURNING employee_id;
    """
    employee_id = int(query_scalar(sql))
    write_audit(actor, "create", "employee", str(employee_id), "created employee")
    return get_employee(employee_id)


def update_employee(employee_id, payload, actor):
    fields = []
    for field in (
        "employee_no",
        "full_name",
        "gender",
        "phone",
        "email",
        "hire_date",
        "employment_status",
        "department_id",
        "position_id",
    ):
        if field in payload:
            fields.append(f"{field} = {sql_literal(payload[field])}")
    if fields:
        execute(f"UPDATE employee SET {', '.join(fields)} WHERE employee_id = {int(employee_id)};")
        write_audit(actor, "update", "employee", str(employee_id), "updated employee")
    return get_employee(employee_id)


def delete_employee(employee_id, actor):
    execute(f"DELETE FROM employee WHERE employee_id = {int(employee_id)};")
    write_audit(actor, "delete", "employee", str(employee_id), "deleted employee")
