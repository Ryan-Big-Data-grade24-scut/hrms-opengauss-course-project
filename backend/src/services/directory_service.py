"""通讯录服务：部门/岗位 CRUD + 跨字段全文搜索。

核心功能：
  - 部门 CRUD（含 location 关联）
  - 岗位 CRUD（含 department / job 关联）
  - directory_tree()    —— 部门 → 员工组织图
  - directory_search()  —— 跨字段 ILIKE 搜索（支持 ?q= 参数）
  - directory_filters() —— 筛选选项

搜索覆盖字段：
  employee.full_name, employee.employee_no, employee.phone, employee.email,
  department.department_name, position.position_name, skill.skill_name
"""

from src.common.db import execute, json_array_query, json_object_query, query_scalar, sql_literal
from src.services.audit_service import write_audit


# ===================================================================
# 部门 CRUD
# ===================================================================

def list_departments():
    """列出所有部门（含办公地点）。"""
    return json_array_query(
        """
        SELECT d.*, l.location_name
        FROM department d
        LEFT JOIN location l ON l.location_id = d.location_id
        ORDER BY d.department_id DESC
        """
    )


def get_department(department_id):
    """获取单个部门详情。"""
    return json_object_query(
        f"""
        SELECT d.*, l.location_name
        FROM department d
        LEFT JOIN location l ON l.location_id = d.location_id
        WHERE d.department_id = {int(department_id)}
        """
    )


def create_department(payload, actor):
    """创建部门。"""
    sql = f"""
    INSERT INTO department (
        department_name, parent_department_id, manager_name, status,
        department_code, location_id, manager_employee_id, description
    ) VALUES (
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
    write_audit(actor, "create", "department", str(department_id),
                f"created department {payload['department_name']}")
    return get_department(department_id)


def update_department(department_id, payload, actor):
    """更新部门信息。"""
    fields = []
    for field in ("department_name", "parent_department_id", "manager_name",
                  "status", "department_code", "location_id",
                  "manager_employee_id", "description"):
        if field in payload:
            value = payload[field]
            if field == "status" and value is not None:
                fields.append(f"{field} = {int(value)}")
            else:
                fields.append(f"{field} = {sql_literal(value)}")
    if fields:
        execute(
            f"UPDATE department SET {', '.join(fields)} "
            f"WHERE department_id = {int(department_id)};"
        )
        write_audit(actor, "update", "department", str(department_id),
                    "updated department")
    return get_department(department_id)


def delete_department(department_id, actor):
    """删除部门。"""
    execute(f"DELETE FROM department WHERE department_id = {int(department_id)};")
    write_audit(actor, "delete", "department", str(department_id),
                "deleted department")


# ===================================================================
# 岗位 CRUD
# ===================================================================

def list_positions(department_id=None):
    """列出所有岗位（含部门名和职务），可按 department_id 筛选。"""
    where_clause = ""
    if department_id is not None:
        where_clause = f" WHERE p.department_id = {int(department_id)}"
    return json_array_query(
        f"""
        SELECT p.*, d.department_name, j.job_title
        FROM position p
        LEFT JOIN department d ON d.department_id = p.department_id
        LEFT JOIN job j ON j.job_id = p.job_id
        {where_clause}
        ORDER BY p.position_id DESC
        """
    )


def get_position(position_id):
    """获取单个岗位详情。"""
    return json_object_query(
        f"""
        SELECT p.*, d.department_name, j.job_title
        FROM position p
        LEFT JOIN department d ON d.department_id = p.department_id
        LEFT JOIN job j ON j.job_id = p.job_id
        WHERE p.position_id = {int(position_id)}
        """
    )


def create_position(payload, actor):
    """创建岗位。"""
    sql = f"""
    INSERT INTO position (
        position_name, level_name, description,
        position_code, job_id, department_id, headcount, status
    ) VALUES (
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
    write_audit(actor, "create", "position", str(position_id),
                f"created position {payload['position_name']}")
    return get_position(position_id)


def update_position(position_id, payload, actor):
    """更新岗位信息。"""
    fields = []
    for field in ("position_name", "level_name", "description",
                  "position_code", "job_id", "department_id",
                  "headcount", "status"):
        if field in payload:
            value = payload[field]
            if field in ("headcount", "status") and value is not None:
                fields.append(f"{field} = {int(value)}")
            else:
                fields.append(f"{field} = {sql_literal(value)}")
    if fields:
        execute(
            f"UPDATE position SET {', '.join(fields)} "
            f"WHERE position_id = {int(position_id)};"
        )
        write_audit(actor, "update", "position", str(position_id),
                    "updated position")
    return get_position(position_id)


def delete_position(position_id, actor):
    """删除岗位。"""
    execute(f"DELETE FROM position WHERE position_id = {int(position_id)};")
    write_audit(actor, "delete", "position", str(position_id),
                "deleted position")


# ===================================================================
# 通讯录（目录 / 组织图视图）
# ===================================================================

def directory_tree():
    """通讯录树：部门作为父节点，内部列出员工。

    返回每个部门及其员工列表，支持点击查看个人资料。
    """
    return json_array_query("""
        SELECT d.department_id, d.department_name,
               d.manager_name AS dept_manager,
               COALESCE(
                   json_agg(
                       json_build_object(
                           'employee_id', e.employee_id,
                           'employee_no', e.employee_no,
                           'full_name', e.full_name,
                           'gender', e.gender,
                           'position_name', p.position_name,
                           'employment_status', e.employment_status,
                           'hire_date', e.hire_date,
                           'manager_employee_id', e.manager_employee_id
                       )
                       ORDER BY e.full_name
                   ) FILTER (WHERE e.employee_id IS NOT NULL),
                   '[]'::json
               ) AS employees,
               COUNT(e.employee_id) FILTER (
                   WHERE e.employment_status IN ('active', 'probation')
               ) AS headcount
        FROM department d
        LEFT JOIN employee e ON e.department_id = d.department_id
        LEFT JOIN position p ON p.position_id = e.position_id
        GROUP BY d.department_id, d.department_name, d.manager_name
        ORDER BY d.department_id
    """)


def directory_search(keyword=""):
    """跨字段全文搜索（ILIKE）。

    支持 ?q= 参数传入搜索关键词。
    覆盖字段：员工姓名、工号、电话、邮箱、部门名、岗位名、技能名。

    参数：
        keyword: 搜索关键词（空字符串返回空列表）

    返回：
        匹配的员工列表，含部门、岗位、上级信息，最多 50 条。
    """
    if not keyword or not keyword.strip():
        return []

    keyword = keyword.strip()
    # 将关键词按空格分词，每个词单独 ILIKE 匹配（AND 逻辑）
    terms = keyword.split()
    # 如果只有一个词，用 OR 跨字段搜索
    # 如果有多个词，用 AND 跨字段搜索（更精确）
    like_conditions = []
    for term in terms:
        pattern = f"'%' || {sql_literal(term)} || '%'"
        like_conditions.append(f"""(
            e.full_name ILIKE {pattern}
            OR e.employee_no ILIKE {pattern}
            OR e.phone ILIKE {pattern}
            OR e.email ILIKE {pattern}
            OR d.department_name ILIKE {pattern}
            OR p.position_name ILIKE {pattern}
            OR s.skill_name ILIKE {pattern}
        )""")

    where_condition = " AND ".join(like_conditions)

    return json_array_query(f"""
        SELECT DISTINCT e.employee_id, e.employee_no, e.full_name,
               e.gender, e.phone, e.email,
               d.department_name,
               p.position_name,
               e.employment_status,
               e.hire_date,
               e.manager_employee_id,
               mgr.full_name AS manager_name
        FROM employee e
        JOIN department d ON d.department_id = e.department_id
        JOIN position p ON p.position_id = e.position_id
        LEFT JOIN employee mgr ON mgr.employee_id = e.manager_employee_id
        LEFT JOIN employee_skill es ON es.employee_id = e.employee_id
        LEFT JOIN skill s ON s.skill_id = es.skill_id
        WHERE e.employment_status IN ('active', 'probation')
          AND {where_condition}
        ORDER BY e.full_name
        LIMIT 50
    """)


def directory_filters():
    """返回可用的筛选选项（部门 + 岗位），供前端筛选芯片使用。"""
    return {
        "departments": json_array_query("""
            SELECT department_id, department_name
            FROM department
            WHERE status = 1
            ORDER BY department_name
        """),
        "positions": json_array_query("""
            SELECT position_id, position_name
            FROM position
            WHERE status = 1
            ORDER BY position_name
        """),
    }
