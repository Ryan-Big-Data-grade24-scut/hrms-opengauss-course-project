from src.common.db import execute, json_array_query, json_object_query, query_scalar, sql_literal
from src.services.audit_service import write_audit


def _list_common():
    return json_array_query("SELECT * FROM job ORDER BY job_id DESC")


def list_jobs():
    return _list_common()


def create_job(payload, actor):
    sql = f"""
    INSERT INTO job (job_code, job_title, job_grade, min_salary, max_salary, description)
    VALUES (
        {sql_literal(payload['job_code'])},
        {sql_literal(payload['job_title'])},
        {sql_literal(payload.get('job_grade'))},
        {sql_literal(payload.get('min_salary'))},
        {sql_literal(payload.get('max_salary'))},
        {sql_literal(payload.get('description'))}
    )
    RETURNING job_id;
    """
    job_id = int(query_scalar(sql))
    write_audit(actor, "create", "job", str(job_id), "created job")
    return get_job(job_id)


def get_job(job_id):
    return json_object_query(
        f"SELECT * FROM job WHERE job_id = {int(job_id)}"
    )


def update_job(job_id, payload, actor):
    fields = []
    for field in ("job_code", "job_title", "job_grade", "min_salary", "max_salary", "description"):
        if field in payload:
            fields.append(f"{field} = {sql_literal(payload[field])}")
    if fields:
        execute(
            f"UPDATE job SET {', '.join(fields)} WHERE job_id = {int(job_id)};"
        )
        write_audit(actor, "update", "job", str(job_id), "updated job")
    return get_job(job_id)


def delete_job(job_id, actor):
    execute(f"DELETE FROM job WHERE job_id = {int(job_id)};")
    write_audit(actor, "delete", "job", str(job_id), "deleted job")
