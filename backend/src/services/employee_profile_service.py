from src.common.db import execute, json_object_query, query_scalar, sql_literal
from src.services.audit_service import write_audit


def get_employee_profile(employee_id):
    return json_object_query(
        f"SELECT * FROM employee_profile WHERE employee_id = {int(employee_id)}"
    )


def update_employee_profile(employee_id, payload, actor):
    existing = get_employee_profile(employee_id)
    if existing:
        fields = []
        for field in ("address", "emergency_contact_name", "emergency_contact_phone",
                       "education_level", "marital_status", "personal_email", "notes"):
            if field in payload:
                fields.append(f"{field} = {sql_literal(payload[field])}")
        if fields:
            fields.append("updated_at = CURRENT_TIMESTAMP")
            execute(
                f"UPDATE employee_profile SET {', '.join(fields)} "
                f"WHERE employee_id = {int(employee_id)};"
            )
    else:
        sql = f"""
        INSERT INTO employee_profile (
            employee_id, address, emergency_contact_name, emergency_contact_phone,
            education_level, marital_status, personal_email, notes
        )
        VALUES (
            {int(employee_id)},
            {sql_literal(payload.get('address'))},
            {sql_literal(payload.get('emergency_contact_name'))},
            {sql_literal(payload.get('emergency_contact_phone'))},
            {sql_literal(payload.get('education_level'))},
            {sql_literal(payload.get('marital_status'))},
            {sql_literal(payload.get('personal_email'))},
            {sql_literal(payload.get('notes'))}
        );
        """
        execute(sql)
    write_audit(actor, "update", "employee_profile", str(employee_id), "updated employee profile")
    return get_employee_profile(employee_id)
