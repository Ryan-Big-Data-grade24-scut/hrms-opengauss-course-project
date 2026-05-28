from src.common.db import execute, json_array_query, json_object_query, query_scalar, sql_literal
from src.services.audit_service import write_audit


def list_employee_job_history(employee_id):
    return json_array_query(
        f"""
        SELECT
            h.*,
            d.department_name,
            p.position_name,
            j.job_title
        FROM employee_job_history h
        LEFT JOIN department d ON d.department_id = h.department_id
        LEFT JOIN position p ON p.position_id = h.position_id
        LEFT JOIN job j ON j.job_id = h.job_id
        WHERE h.employee_id = {int(employee_id)}
        ORDER BY h.start_date DESC
        """
    )


def create_employee_job_history(employee_id, payload, actor):
    sql = f"""
    INSERT INTO employee_job_history (
        employee_id, department_id, position_id, job_id,
        manager_employee_id, start_date, end_date, change_reason
    )
    VALUES (
        {int(employee_id)},
        {sql_literal(payload.get('department_id'))},
        {sql_literal(payload.get('position_id'))},
        {sql_literal(payload.get('job_id'))},
        {sql_literal(payload.get('manager_employee_id'))},
        {sql_literal(payload['start_date'])},
        {sql_literal(payload.get('end_date'))},
        {sql_literal(payload.get('change_reason'))}
    )
    RETURNING history_id;
    """
    history_id = int(query_scalar(sql))
    write_audit(actor, "create", "employee_job_history", str(history_id), "created job history entry")
    return json_object_query(
        f"SELECT * FROM employee_job_history WHERE history_id = {history_id}"
    )
