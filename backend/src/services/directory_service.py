from src.common.db import execute, json_array_query, json_object_query, query_scalar, sql_literal
from src.services.audit_service import write_audit


def _list_common(table_name, id_field):
    return json_array_query(f"SELECT * FROM {table_name} ORDER BY {id_field} DESC")


def list_departments():
    return json_array_query(
        """
        SELECT
            d.*,
            l.location_name
        FROM department d
        LEFT JOIN location l ON l.location_id = d.location_id
        ORDER BY d.department_id DESC
        """
    )


def create_department(payload, actor):
    sql = f"""
    INSERT INTO department (department_name, parent_department_id, manager_name, status,
                            department_code, location_id, manager_employee_id, description)
    VALUES (
        {sql_literal(payload['department_name'])},
        {sql_literal(payload.get('parent_department_id'))},
        {sql_literal(payload.get('manager_name'))},
        {int(payload.get('status', 1))},
        {sql_literal(payload.get('department_code'))},
        {sql_literal(payload.get('location_id'))},
        {sql_literal(payload.get('manager_employee_id'))},
        {sql_literal(payload.get('description'))}
    )
    RETURNING department_id;
    """
    department_id = int(query_scalar(sql))
    write_audit(actor, "create", "department", str(department_id), "created department")
    return get_department(department_id)


def get_department(department_id):
    return json_object_query(
        f"""
        SELECT
            d.*,
            l.location_name
        FROM department d
        LEFT JOIN location l ON l.location_id = d.location_id
        WHERE d.department_id = {int(department_id)}
        """
    )


def update_department(department_id, payload, actor):
    fields = []
    for field in ("department_name", "parent_department_id", "manager_name", "status",
                   "department_code", "location_id", "manager_employee_id", "description"):
        if field in payload:
            value = payload[field]
            if field == "status" and value is not None:
                fields.append(f"{field} = {int(value)}")
            else:
                fields.append(f"{field} = {sql_literal(value)}")
    if fields:
        execute(
            f"UPDATE department SET {', '.join(fields)} WHERE department_id = {int(department_id)};"
        )
        write_audit(actor, "update", "department", str(department_id), "updated department")
    return get_department(department_id)


def delete_department(department_id, actor):
    execute(f"DELETE FROM department WHERE department_id = {int(department_id)};")
    write_audit(actor, "delete", "department", str(department_id), "deleted department")


def list_positions():
    return json_array_query(
        """
        SELECT
            p.*,
            d.department_name,
            j.job_title
        FROM position p
        LEFT JOIN department d ON d.department_id = p.department_id
        LEFT JOIN job j ON j.job_id = p.job_id
        ORDER BY p.position_id DESC
        """
    )


def create_position(payload, actor):
    sql = f"""
    INSERT INTO position (position_name, level_name, description,
                          position_code, job_id, department_id, headcount, status)
    VALUES (
        {sql_literal(payload['position_name'])},
        {sql_literal(payload.get('level_name'))},
        {sql_literal(payload.get('description'))},
        {sql_literal(payload.get('position_code'))},
        {sql_literal(payload.get('job_id'))},
        {sql_literal(payload.get('department_id'))},
        {int(payload.get('headcount', 1))},
        {int(payload.get('status', 1))}
    )
    RETURNING position_id;
    """
    position_id = int(query_scalar(sql))
    write_audit(actor, "create", "position", str(position_id), "created position")
    return get_position(position_id)


def get_position(position_id):
    return json_object_query(
        f"""
        SELECT
            p.*,
            d.department_name,
            j.job_title
        FROM position p
        LEFT JOIN department d ON d.department_id = p.department_id
        LEFT JOIN job j ON j.job_id = p.job_id
        WHERE p.position_id = {int(position_id)}
        """
    )


def update_position(position_id, payload, actor):
    fields = []
    for field in ("position_name", "level_name", "description",
                   "position_code", "job_id", "department_id", "headcount", "status"):
        if field in payload:
            value = payload[field]
            if field in ("headcount", "status") and value is not None:
                fields.append(f"{field} = {int(value)}")
            else:
                fields.append(f"{field} = {sql_literal(value)}")
    if fields:
        execute(
            f"UPDATE position SET {', '.join(fields)} WHERE position_id = {int(position_id)};"
        )
        write_audit(actor, "update", "position", str(position_id), "updated position")
    return get_position(position_id)


def delete_position(position_id, actor):
    execute(f"DELETE FROM position WHERE position_id = {int(position_id)};")
    write_audit(actor, "delete", "position", str(position_id), "deleted position")
