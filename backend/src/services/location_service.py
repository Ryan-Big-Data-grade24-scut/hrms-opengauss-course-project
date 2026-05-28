from src.common.db import execute, json_array_query, json_object_query, query_scalar, sql_literal
from src.services.audit_service import write_audit


def _list_common():
    return json_array_query("SELECT * FROM location ORDER BY location_id DESC")


def list_locations():
    return _list_common()


def create_location(payload, actor):
    sql = f"""
    INSERT INTO location (location_code, location_name, country_code, city, address_line, status)
    VALUES (
        {sql_literal(payload['location_code'])},
        {sql_literal(payload['location_name'])},
        {sql_literal(payload.get('country_code'))},
        {sql_literal(payload.get('city'))},
        {sql_literal(payload.get('address_line'))},
        {int(payload.get('status', 1))}
    )
    RETURNING location_id;
    """
    location_id = int(query_scalar(sql))
    write_audit(actor, "create", "location", str(location_id), "created location")
    return get_location(location_id)


def get_location(location_id):
    return json_object_query(
        f"SELECT * FROM location WHERE location_id = {int(location_id)}"
    )


def update_location(location_id, payload, actor):
    fields = []
    for field in ("location_code", "location_name", "country_code", "city", "address_line", "status"):
        if field in payload:
            value = payload[field]
            if field == "status" and value is not None:
                fields.append(f"{field} = {int(value)}")
            else:
                fields.append(f"{field} = {sql_literal(value)}")
    if fields:
        execute(
            f"UPDATE location SET {', '.join(fields)} WHERE location_id = {int(location_id)};"
        )
        write_audit(actor, "update", "location", str(location_id), "updated location")
    return get_location(location_id)


def delete_location(location_id, actor):
    execute(f"DELETE FROM location WHERE location_id = {int(location_id)};")
    write_audit(actor, "delete", "location", str(location_id), "deleted location")
