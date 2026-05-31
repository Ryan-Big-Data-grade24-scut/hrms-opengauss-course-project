"""组织与人员服务 — V2 合并版。

取代 org_service 和 directory_service 的零散接口，
为三栏式 OrgPeoplePage 提供统一数据后端。

提供：
  - org_people_tree()       统一组织树（部门→人数）
  - org_people_search(q)    跨字段搜索（姓名/岗位/部门/技能/电话/邮箱）
  - org_people_filters()    筛选条件（部门列表 + 岗位列表）
  - employee_profile(id)    完整 Profile（基本信息+技能+风险+日志）
"""

from src.common.db import json_array_query, json_object_query


# ── 左栏：部门树 ────────────────────────────────────────

def org_people_tree():
    """统一组织树（部门 → 在岗人数）。

    返回嵌套树结构：
        [
            {
                "department_id": 1,
                "department_name": "研发部",
                "headcount": 5,
                "parent_department_id": None,
                "manager_name": "陈晨",
                "children": [
                    {
                        "department_id": 4,
                        "department_name": "前端组",
                        ...
                    }
                ]
            }
        ]

    无子部门时 children 为空数组。
    """
    return json_array_query(
        """
        WITH RECURSIVE dept_tree AS (
            SELECT d.department_id, d.department_name,
                   d.parent_department_id, d.manager_employee_id,
                   d.manager_name, 0 AS level
            FROM department d
            WHERE d.parent_department_id IS NULL
              AND d.status = 1
            UNION ALL
            SELECT d.department_id, d.department_name,
                   d.parent_department_id, d.manager_employee_id,
                   d.manager_name, dt.level + 1
            FROM department d
            INNER JOIN dept_tree dt ON d.parent_department_id = dt.department_id
            WHERE d.status = 1
        ),
        dept_headcount AS (
            SELECT p.department_id, COUNT(DISTINCT e.employee_id) AS headcount
            FROM employee e
            JOIN position p ON p.position_id = e.position_id
            WHERE e.employment_status IN ('active', 'probation')
            GROUP BY p.department_id
        )
        SELECT dt.department_id, dt.department_name,
               dt.parent_department_id, dt.manager_name,
               COALESCE(dh.headcount, 0) AS headcount,
               dt.level
        FROM dept_tree dt
        LEFT JOIN dept_headcount dh ON dh.department_id = dt.department_id
        ORDER BY dt.level, dt.department_name
        """
    )


# ── 中栏：岗位 + 员工 ──────────────────────────────────

def org_people_search(q):
    """跨字段模糊搜索：姓名 / 岗位 / 部门 / 技能 / 电话 / 邮箱。

    支持按 position.department_id 排序，按部门聚合显示。
    返回中包含每个员工的部门+岗位信息用于卡片渲染。
    """
    if not q or not q.strip():
        return []

    like_val = q.strip()
    return json_array_query(
        f"""
        SELECT DISTINCT e.employee_id, e.employee_no, e.full_name,
               e.phone, e.email, e.employment_status,
               p.position_id, p.position_name,
               d.department_id, d.department_name
        FROM employee e
        JOIN position p ON p.position_id = e.position_id
        JOIN department d ON d.department_id = p.department_id
        LEFT JOIN employee_skill es ON es.employee_id = e.employee_id
        LEFT JOIN skill s ON s.skill_id = es.skill_id
        WHERE e.employment_status IN ('active', 'probation')
          AND (
              e.full_name ILIKE '%' || '{like_val}' || '%'
              OR p.position_name ILIKE '%' || '{like_val}' || '%'
              OR d.department_name ILIKE '%' || '{like_val}' || '%'
              OR e.phone ILIKE '%' || '{like_val}' || '%'
              OR e.email ILIKE '%' || '{like_val}' || '%'
              OR s.skill_name ILIKE '%' || '{like_val}' || '%'
          )
        ORDER BY d.department_name, p.position_name, e.full_name
        """
    )


def org_people_filters():
    """获取筛选条件：所有活跃部门 + 岗位列表。

    返回：
        {
            "departments": [{"department_id": 1, "department_name": "研发部", ...}],
            "positions":   [{"position_id": 1, "position_name": "后端开发工程师", "department_id": 1, ...}]
        }
    """
    depts = json_array_query(
        """
        SELECT department_id, department_name, parent_department_id
        FROM department
        WHERE status = 1
        ORDER BY department_name
        """
    )
    positions = json_array_query(
        """
        SELECT p.position_id, p.position_name, p.department_id,
               d.department_name
        FROM position p
        JOIN department d ON d.department_id = p.department_id
        WHERE p.status = 1
        ORDER BY p.position_name
        """
    )
    return {
        "departments": depts or [],
        "positions": positions or [],
    }


# ── 中栏：按部门 + 岗位过滤的员工卡片 ──────────────────

def get_employees_by_dept(department_id, position_id=None):
    """按部门（可选岗位）获取员工卡片列表。

    包含子部门的员工。结果按岗位分组排序。
    """
    eid = int(department_id)
    pos_filter = ""
    params_clause = ""
    if position_id:
        pid = int(position_id)
        pos_filter = f"AND p.position_id = {pid}"

    return json_array_query(
        f"""
        WITH RECURSIVE sub_depts AS (
            SELECT department_id FROM department
            WHERE department_id = {eid}
            UNION ALL
            SELECT d.department_id FROM department d
            INNER JOIN sub_depts sd ON d.parent_department_id = sd.department_id
            WHERE d.status = 1
        )
        SELECT e.employee_id, e.employee_no, e.full_name,
               e.phone, e.email, e.hire_date, e.employment_status,
               p.position_id, p.position_name,
               d.department_id, d.department_name,
               j.job_grade
        FROM employee e
        JOIN position p ON p.position_id = e.position_id
        JOIN department d ON d.department_id = p.department_id
        LEFT JOIN job j ON j.job_id = p.job_id
        WHERE e.department_id IN (SELECT department_id FROM sub_depts)
          AND e.employment_status IN ('active', 'probation')
          {pos_filter}
        ORDER BY d.department_name, p.position_name, e.full_name
        """
    )


def get_positions_by_department(department_id):
    """获取指定部门（含子部门）的岗位列表及在岗人数。"""
    eid = int(department_id)
    return json_array_query(
        f"""
        WITH RECURSIVE sub_depts AS (
            SELECT department_id FROM department
            WHERE department_id = {eid}
            UNION ALL
            SELECT d.department_id FROM department d
            INNER JOIN sub_depts sd ON d.parent_department_id = sd.department_id
            WHERE d.status = 1
        )
        SELECT p.position_id, p.position_name, p.department_id,
               d.department_name,
               COUNT(DISTINCT e.employee_id) AS employee_count
        FROM position p
        JOIN department d ON d.department_id = p.department_id
        LEFT JOIN employee e ON e.position_id = p.position_id
            AND e.employment_status IN ('active', 'probation')
        WHERE p.department_id IN (SELECT department_id FROM sub_depts)
          AND p.status = 1
        GROUP BY p.position_id, p.position_name, p.department_id, d.department_name
        ORDER BY p.position_name
        """
    )


# ── 右栏：员工 Profile ─────────────────────────────────

def employee_profile(employee_id):
    """员工完整 Profile（右栏面板数据源）。

    聚合 5 个区块：
      - basic:         基本信息（姓名/工号/岗位/部门/职级/入职日期）
      - contact:       联系方式（手机/邮箱/办公地点）
      - skills:        技能标签（按熟练度降序）
      - attrition_risk 离职风险（来自 attrition 引擎）
      - recent_logs:   近期操作日志摘要（最近 5 条）
    """
    eid = int(employee_id)

    # 基础信息 + 联系方式
    basic = json_object_query(
        f"""
        SELECT e.employee_id, e.employee_no, e.full_name,
               e.phone, e.email,
               e.hire_date, e.employment_status,
               p.position_id, p.position_name,
               d.department_id, d.department_name,
               j.job_grade,
               mgr.full_name AS manager_name,
               mgr.employee_id AS manager_employee_id,
               ep.emergency_contact_name,
               ep.emergency_contact_phone
        FROM employee e
        JOIN position p ON p.position_id = e.position_id
        JOIN department d ON d.department_id = p.department_id
        LEFT JOIN job j ON j.job_id = p.job_id
        LEFT JOIN employee mgr ON mgr.employee_id = e.manager_employee_id
        LEFT JOIN employee_profile ep ON ep.employee_id = e.employee_id
        WHERE e.employee_id = {eid}
        """
    )
    if not basic:
        return None

    # 技能标签（按熟练度降序）
    skills = json_array_query(
        f"""
        SELECT s.skill_id, s.skill_name, sc.category_name,
               es.proficiency_level, es.is_core, es.acquired_from
        FROM employee_skill es
        JOIN skill s ON s.skill_id = es.skill_id
        LEFT JOIN skill_category sc ON sc.category_id = s.category_id
        WHERE es.employee_id = {eid}
        ORDER BY es.proficiency_level DESC, s.skill_name
        """
    )

    # 近期操作日志（最近 5 条）
    recent_logs = json_array_query(
        f"""
        SELECT al.audit_id, al.action_type, al.target_type,
               al.action_detail, al.created_at,
               u.full_name AS actor_name
        FROM audit_log al
        LEFT JOIN sys_user u ON u.username = al.username
        WHERE al.target_id = '{eid}'
           OR al.target_id = (SELECT employee_no FROM employee WHERE employee_id = {eid})
        ORDER BY al.created_at DESC
        LIMIT 5
        """
    )

    profile = {
        "basic": basic,
        "skills": skills or [],
        "recent_logs": recent_logs or [],
        "attrition_risk": None,
    }

    # 离职风险（调用 attrition_service 的 compute_risk）
    try:
        from src.services.attrition_service import compute_risk
        risk = compute_risk(eid)
        if risk:
            profile["attrition_risk"] = {
                "risk_score": risk.get("risk_score"),
                "risk_score_pct": risk.get("risk_score_pct"),
                "risk_level": risk.get("risk_level"),
            }
    except Exception:
        profile["attrition_risk"] = None

    return profile
