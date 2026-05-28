from src.common.db import execute, json_array_query, json_object_query, query_scalar, sql_literal
from src.services.audit_service import write_audit


def _list_common():
    return json_array_query("SELECT * FROM leave_type ORDER BY leave_type_id DESC")


def list_leave_types():
    return _list_common()


def create_leave_type(payload, actor):
    sql = f"""
    INSERT INTO leave_type (leave_code, leave_name, requires_approval, status)
    VALUES (
        {sql_literal(payload['leave_code'])},
        {sql_literal(payload['leave_name'])},
        {int(payload.get('requires_approval', 1))},
        {int(payload.get('status', 1))}
    )
    RETURNING leave_type_id;
    """
    leave_type_id = int(query_scalar(sql))
    write_audit(actor, "create", "leave_type", str(leave_type_id), "created leave type")
    return get_leave_type(leave_type_id)


def get_leave_type(leave_type_id):
    return json_object_query(
        f"SELECT * FROM leave_type WHERE leave_type_id = {int(leave_type_id)}"
    )


def update_leave_type(leave_type_id, payload, actor):
    fields = []
    for field in ("leave_code", "leave_name", "requires_approval", "status"):
        if field in payload:
            value = payload[field]
            if field in ("requires_approval", "status") and value is not None:
                fields.append(f"{field} = {int(value)}")
            else:
                fields.append(f"{field} = {sql_literal(value)}")
    if fields:
        execute(
            f"UPDATE leave_type SET {', '.join(fields)} WHERE leave_type_id = {int(leave_type_id)};"
        )
        write_audit(actor, "update", "leave_type", str(leave_type_id), "updated leave type")
    return get_leave_type(leave_type_id)


def delete_leave_type(leave_type_id, actor):
    execute(f"DELETE FROM leave_type WHERE leave_type_id = {int(leave_type_id)};")
    write_audit(actor, "delete", "leave_type", str(leave_type_id), "deleted leave type")
