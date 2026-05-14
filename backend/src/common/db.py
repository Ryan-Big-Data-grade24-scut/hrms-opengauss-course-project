import json
import subprocess
from datetime import date, datetime

from src.config import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER, DOCKER_CONTAINER


class DatabaseError(RuntimeError):
    pass


def _docker_command():
    direct = ["docker"]
    sudo_direct = ["sudo", "-n", "docker"]

    if subprocess.run(direct + ["info"], capture_output=True).returncode == 0:
        return direct

    if subprocess.run(sudo_direct + ["info"], capture_output=True).returncode == 0:
        return sudo_direct

    return direct


def _gsql_command(sql):
    return [
        *_docker_command(),
        "exec",
        "-e",
        "LD_LIBRARY_PATH=/usr/local/opengauss/lib",
        DOCKER_CONTAINER,
        "/usr/local/opengauss/bin/gsql",
        "-h",
        DB_HOST,
        "-p",
        DB_PORT,
        "-d",
        DB_NAME,
        "-U",
        DB_USER,
        "-W",
        DB_PASSWORD,
        "-t",
        "-A",
        "-c",
        sql,
    ]


def sql_literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (date, datetime)):
        return "'" + value.isoformat() + "'"
    text = str(value).replace("'", "''")
    return "'" + text + "'"


def run_sql(sql):
    completed = subprocess.run(
        _gsql_command(sql),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if completed.returncode != 0:
        raise DatabaseError((completed.stderr or completed.stdout).strip() or "gsql failed")
    return completed.stdout.strip()


def query_scalar(sql):
    output = run_sql(sql)
    if not output:
        return None
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    if not lines:
        return None
    for line in lines:
        if not _is_command_status(line):
            return line
    return lines[-1]


def query_json(sql):
    output = run_sql(sql)
    if not output:
        return None
    return _extract_json(output)


def execute(sql):
    return run_sql(sql)


def json_array_query(inner_sql):
    sql = f"SELECT COALESCE(json_agg(t), '[]'::json)::text FROM ({inner_sql}) t;"
    data = query_json(sql)
    return data or []


def json_object_query(inner_sql):
    sql = f"SELECT row_to_json(t)::text FROM ({inner_sql}) t;"
    return query_json(sql)


def _extract_json(text):
    decoder = json.JSONDecoder()
    best = None
    for index, char in enumerate(text):
        if char not in "[{":
            continue
        try:
            value, end = decoder.raw_decode(text[index:])
        except json.JSONDecodeError:
            continue
        best = value
        remainder = text[index + end :].strip()
        if not remainder:
            return value
    if best is not None:
        return best
    raise json.JSONDecodeError("No JSON value found", text, 0)


def _is_command_status(line):
    parts = line.split()
    if not parts:
        return False
    if not parts[0].isalpha() or parts[0].upper() != parts[0]:
        return False
    return all(part.isdigit() or part.isalpha() for part in parts[1:])


def bootstrap_rbac():
    sql = """
    INSERT INTO sys_user_role (user_id, role_id)
    SELECT u.user_id, r.role_id
    FROM sys_user u, sys_role r
    WHERE u.username = 'admin' AND r.role_code = 'ADMIN'
      AND NOT EXISTS (
        SELECT 1 FROM sys_user_role x WHERE x.user_id = u.user_id AND x.role_id = r.role_id
      );

    INSERT INTO sys_user_role (user_id, role_id)
    SELECT u.user_id, r.role_id
    FROM sys_user u, sys_role r
    WHERE u.username = 'hr01' AND r.role_code = 'HR'
      AND NOT EXISTS (
        SELECT 1 FROM sys_user_role x WHERE x.user_id = u.user_id AND x.role_id = r.role_id
      );

    INSERT INTO sys_user_role (user_id, role_id)
    SELECT u.user_id, r.role_id
    FROM sys_user u, sys_role r
    WHERE u.username = 'emp01' AND r.role_code = 'EMPLOYEE'
      AND NOT EXISTS (
        SELECT 1 FROM sys_user_role x WHERE x.user_id = u.user_id AND x.role_id = r.role_id
      );

    INSERT INTO sys_role_permission (role_id, permission_id)
    SELECT r.role_id, p.permission_id
    FROM sys_role r
    JOIN sys_permission p ON p.permission_code IN (
      'user.manage', 'employee.manage', 'department.manage', 'leave.manage', 'audit.view'
    )
    WHERE r.role_code = 'ADMIN'
      AND NOT EXISTS (
        SELECT 1 FROM sys_role_permission x WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
      );

    INSERT INTO sys_role_permission (role_id, permission_id)
    SELECT r.role_id, p.permission_id
    FROM sys_role r
    JOIN sys_permission p ON p.permission_code IN (
      'employee.manage', 'department.manage', 'leave.manage', 'audit.view'
    )
    WHERE r.role_code = 'HR'
      AND NOT EXISTS (
        SELECT 1 FROM sys_role_permission x WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
      );

    INSERT INTO sys_role_permission (role_id, permission_id)
    SELECT r.role_id, p.permission_id
    FROM sys_role r
    JOIN sys_permission p ON p.permission_code IN ('leave.manage')
    WHERE r.role_code = 'EMPLOYEE'
      AND NOT EXISTS (
        SELECT 1 FROM sys_role_permission x WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
      );
    """
    execute(sql)
