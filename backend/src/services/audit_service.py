from src.common.db import execute, sql_literal


def write_audit(username, action_type, target_type, target_id=None, action_detail=None):
    sql = f"""
    INSERT INTO audit_log (username, action_type, target_type, target_id, action_detail)
    VALUES (
        {sql_literal(username)},
        {sql_literal(action_type)},
        {sql_literal(target_type)},
        {sql_literal(target_id)},
        {sql_literal(action_detail)}
    );
    """
    execute(sql)
