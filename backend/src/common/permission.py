"""权限范围检查工具函数。

提供细粒度的数据访问范围控制：
- self  —— 仅自己
- team  —— 自己 + 直属下级（团队）
- all   —— 全部数据

用法：
    scope = _require_permission_scope(user, "attendance.view")
    if scope == "self":
        # 仅查询自己的考勤
    elif scope == "team":
        # 查询自己 + 团队
    # "all" 不限制
"""


def _require_permission_scope(user, permission_code):
    """检查用户是否拥有指定权限，并返回其数据访问范围。

    参数：
        user:           认证用户字典（含 roles 和 permissions 字段）
        permission_code: 要检查的权限编码

    返回：
        "self" —— 用户只能访问自己的数据
        "team" —— 用户可以访问自己及团队成员的数据
        "all"  —— 用户可以访问所有数据

    抛出：
        PermissionError —— 用户完全无权访问该模块
    """
    permissions = set(user.get("permissions", []))
    roles = set(user.get("roles", []))

    # 没有对应权限，直接拒绝
    if permission_code not in permissions:
        raise PermissionError(f"permission denied: {permission_code}")

    # 管理员 / CEO / HR 拥有全部数据范围
    if roles & {"ADMIN", "CEO", "HR"}:
        return "all"

    # 普通员工：仅自己
    return "self"


def _get_accessible_department_ids(user):
    """返回用户可访问的部门 ID 列表。

    根据用户角色计算数据可见范围：
    - ADMIN / CEO / HR → None（全部可见）
    - 其他             → 用户所在部门（通过 employee_id 查找）

    返回 None 表示不限制（全量）。
    """
    roles = set(user.get("roles", []))
    employee_id = user.get("employee_id")

    if roles & {"ADMIN", "CEO", "HR"}:
        return None

    if not employee_id:
        return None

    from src.common.db import json_array_query
    emp_id = int(employee_id)
    # 查找用户所属部门以及下级部门的 ID
    rows = json_array_query(f"""
        WITH RECURSIVE dept_tree AS (
            SELECT department_id, parent_department_id
            FROM department
            WHERE department_id = (
                SELECT department_id FROM employee WHERE employee_id = {emp_id}
            )
            UNION ALL
            SELECT d.department_id, d.parent_department_id
            FROM department d
            JOIN dept_tree dt ON dt.department_id = d.parent_department_id
        )
        SELECT department_id FROM dept_tree
    """)
    return [row["department_id"] for row in rows] if rows else None
