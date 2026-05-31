import json
from datetime import date, datetime

import psycopg2
import psycopg2.pool

from src.config import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER


class DatabaseError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Connection pool
# ---------------------------------------------------------------------------

_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def _get_pool():
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
        )
    return _pool


def _reset_pool():
    global _pool
    if _pool is not None:
        try:
            _pool.closeall()
        except Exception:
            pass
        _pool = None


def _get_conn():
    """Get a healthy connection from the pool (auto-reconnect on failure)."""
    pool = _get_pool()
    try:
        conn = pool.getconn()
    except Exception:
        _reset_pool()
        pool = _get_pool()
        conn = pool.getconn()

    # Health check — verify the connection is still alive
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
    except Exception:
        try:
            pool.putconn(conn)
        except Exception:
            pass
        _reset_pool()
        pool = _get_pool()
        conn = pool.getconn()

    return conn, pool


def _put_conn(conn, pool):
    try:
        pool.putconn(conn)
    except Exception:
        try:
            conn.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# gsql-compatible output formatter
# ---------------------------------------------------------------------------


def _format_value(val):
    """Format a Python value as gsql -tA style text."""
    if val is None:
        return ""
    if isinstance(val, bool):
        return "t" if val else "f"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, (date, datetime)):
        return val.isoformat()
    if isinstance(val, (dict, list)):
        return json.dumps(val, ensure_ascii=False, default=str)
    if isinstance(val, bytes):
        return val.decode("utf-8", errors="replace")
    return str(val)


def _format_output(cursor):
    """Format cursor results as gsql -tA style pipe-separated text.

    * SELECT-like queries → rows joined by ``\\n``, columns separated by ``|``.
    * DML / DDL          → ``str(rowcount)`` (mimics the gsql command tag).
    """
    if cursor.description is None:
        rc = cursor.rowcount
        return str(rc) if rc is not None and rc >= 0 else "0"

    rows = cursor.fetchall()
    if not rows:
        return ""

    lines = []
    for row in rows:
        parts = [_format_value(v) for v in row]
        lines.append("|".join(parts))

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


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
    """Execute SQL and return gsql -tA style pipe-separated text output."""
    conn, pool = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            outputs = []
            while True:
                outputs.append(_format_output(cur))
                try:
                    has_next = cur.nextset()
                except psycopg2.NotSupportedError:
                    # openGauss does not support nextset()
                    break
                if not has_next:
                    break
            conn.commit()
            return "\n".join(outputs)
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise DatabaseError(str(e)) from e
    finally:
        _put_conn(conn, pool)


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


def run_sql_batch(sql_list, separator="---BATCH_SEP---"):
    """Execute multiple SQL statements in a single session.

    Each statement should append ``SELECT '{separator}';`` to mark its end.
    Returns a list of result strings, one per statement.
    """
    marker = sql_literal(separator)
    combined = "\n".join(sql_list) + f"\nSELECT {marker};"
    output = run_sql(combined)
    results = [s.strip() for s in output.split(separator) if s.strip()]
    return results


def execute_many(sql_statements):
    """Execute multiple independent SQL statements one by one.

    Unlike run_sql_batch, this does NOT require a marker suffix on each
    statement.  Each statement is executed independently, which works
    around openGauss's lack of ``nextset()`` support.

    Returns a list of output strings, one per statement.
    """
    outputs = []
    for stmt in sql_statements:
        stmt = stmt.strip()
        if not stmt:
            continue
        outputs.append(run_sql(stmt))
    return outputs


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
    statements = [
        """
        INSERT INTO sys_user_role (user_id, role_id)
        SELECT u.user_id, r.role_id
        FROM sys_user u, sys_role r
        WHERE u.username = 'admin' AND r.role_code = 'ADMIN'
          AND NOT EXISTS (
            SELECT 1 FROM sys_user_role x WHERE x.user_id = u.user_id AND x.role_id = r.role_id
          );
        """,
        """
        INSERT INTO sys_user_role (user_id, role_id)
        SELECT u.user_id, r.role_id
        FROM sys_user u, sys_role r
        WHERE u.username = 'hr_mgr' AND r.role_code = 'HR'
          AND NOT EXISTS (
            SELECT 1 FROM sys_user_role x WHERE x.user_id = u.user_id AND x.role_id = r.role_id
          );
        """,
        """
        INSERT INTO sys_user_role (user_id, role_id)
        SELECT u.user_id, r.role_id
        FROM sys_user u, sys_role r
        WHERE u.username = 'employee' AND r.role_code = 'EMPLOYEE'
          AND NOT EXISTS (
            SELECT 1 FROM sys_user_role x WHERE x.user_id = u.user_id AND x.role_id = r.role_id
          );
        """,
        """
        INSERT INTO sys_role_permission (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM sys_role r
        JOIN sys_permission p ON p.permission_code IN (
          'user.manage', 'employee.manage', 'department.manage', 'leave.manage', 'audit.view',
          'skill.manage', 'analytics.view', 'attendance.view',
          'performance.view', 'performance.manage', 'team.view'
        )
        WHERE r.role_code = 'ADMIN'
          AND NOT EXISTS (
            SELECT 1 FROM sys_role_permission x WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
          );
        """,
        """
        INSERT INTO sys_role_permission (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM sys_role r
        JOIN sys_permission p ON p.permission_code IN (
          'employee.manage', 'department.manage', 'leave.manage', 'audit.view',
          'skill.manage', 'analytics.view', 'attendance.view',
          'performance.view', 'team.view'
        )
        WHERE r.role_code = 'HR'
          AND NOT EXISTS (
            SELECT 1 FROM sys_role_permission x WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
          );
        """,
        """
        INSERT INTO sys_role_permission (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM sys_role r
        JOIN sys_permission p ON p.permission_code IN ('leave.manage')
        WHERE r.role_code = 'EMPLOYEE'
          AND NOT EXISTS (
            SELECT 1 FROM sys_role_permission x WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
          );
        """,
        """
        INSERT INTO sys_role (role_code, role_name, description)
        SELECT 'MANAGER', '部门经理', '审批人 + 团队管理'
        WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code = 'MANAGER');
        """,
        """
        INSERT INTO sys_role_permission (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM sys_role r
        JOIN sys_permission p ON p.permission_code IN (
          'leave.manage', 'skill.manage', 'analytics.view',
          'attendance.view', 'performance.view', 'team.view'
        )
        WHERE r.role_code = 'MANAGER'
          AND NOT EXISTS (
            SELECT 1 FROM sys_role_permission x WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
          );
        """,
        """
        INSERT INTO sys_role (role_code, role_name, description)
        SELECT 'CEO', 'CEO/管理员', '系统所有者——所有权限'
        WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code = 'CEO');
        """,
        """
        INSERT INTO sys_role_permission (role_id, permission_id)
        SELECT r.role_id, p.permission_id
        FROM sys_role r
        CROSS JOIN sys_permission p
        WHERE r.role_code = 'CEO'
          AND NOT EXISTS (
            SELECT 1 FROM sys_role_permission x WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
          );
        """,
    ]
    execute_many(statements)
