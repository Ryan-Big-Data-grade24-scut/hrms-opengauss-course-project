"""组织架构服务：按 position.department_id 分组的组织树。

核心设计原则：
  组织树以 position.department_id 为准进行分组，而非 employee.department_id。
  因为岗位（position）归属部门是组织的静态结构定义，员工是动态分配。

提供：
  - org_tree()               —— 扁平递归组织树（兼容遗留）
  - org_hierarchy()          —— 嵌套 部门 → 岗位 → 员工 层级
  - dept_position_tree()     —— 按 position.department_id 分组的精简组织树
  - employee_network()       —— 员工关系网（上级 / 同级 / 下级）
  - get_employee_bundle()    —— 员工完整资料包（侧滑面板用）
  - critical_persons()       —— 关键人风险分析
  - department_stats()       —— 部门统计
"""

from src.common.db import json_array_query, json_object_query
from src.common.permission import _require_permission_scope


def org_tree():
    """扁平递归组织树（遗留接口），基于 position.department_id 分组修正。

    正确的分组方式：通过 position.department_id 确定员工的部门归属，
    而非 employee.department_id。这样保证组织结构的静态一致性。
    """
    return json_array_query(
        """
        WITH RECURSIVE org AS (
            SELECT e.employee_id, e.full_name,
                   p.department_id,
                   d.department_name,
                   p.position_name,
                   e.manager_employee_id,
                   0 AS depth
            FROM employee e
            JOIN position p ON p.position_id = e.position_id
            JOIN department d ON d.department_id = p.department_id
            WHERE e.manager_employee_id IS NULL
              AND e.employment_status IN ('active', 'probation')

            UNION ALL

            SELECT e.employee_id, e.full_name,
                   p.department_id,
                   d.department_name,
                   p.position_name,
                   e.manager_employee_id,
                   org.depth + 1
            FROM employee e
            JOIN position p ON p.position_id = e.position_id
            JOIN department d ON d.department_id = p.department_id
            JOIN org ON org.employee_id = e.manager_employee_id
            WHERE e.employment_status IN ('active', 'probation')
        )
        SELECT employee_id, full_name, department_name, position_name, depth
        FROM org
        ORDER BY depth, department_name, employee_id
        """
    )


def dept_position_tree():
    """按 position.department_id 分组的精简组织树。

    返回结构：
        [
            {
                "department_id": 1,
                "department_name": "研发部",
                "headcount": 5,
                "positions": [
                    {
                        "position_id": 1,
                        "position_name": "后端开发工程师",
                        "employee_count": 3,
                        "employees": [
                            { "employee_id": 1, "full_name": "陈晨", ... }
                        ]
                    }
                ]
            }
        ]

    正确使用 position.department_id 进行分组，
    而非 employee.department_id。
    """
    return json_array_query(
        """
        -- 部门列表（来自有活跃岗位的部门）
        WITH active_departments AS (
            SELECT DISTINCT p.department_id, d.department_name
            FROM position p
            JOIN department d ON d.department_id = p.department_id
            WHERE p.status = 1
        ),
        -- 各岗位下的活跃员工
        position_employees AS (
            SELECT
                p.department_id,
                p.position_id,
                p.position_name,
                COUNT(DISTINCT e.employee_id) AS employee_count,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'employee_id', e.employee_id,
                            'employee_no', e.employee_no,
                            'full_name', e.full_name,
                            'position_name', p.position_name,
                            'employment_status', e.employment_status
                        )
                        ORDER BY e.full_name
                    ) FILTER (WHERE e.employee_id IS NOT NULL),
                    '[]'::json
                ) AS employees
            FROM position p
            LEFT JOIN employee e
                ON e.position_id = p.position_id
               AND e.employment_status IN ('active', 'probation')
            WHERE p.status = 1
            GROUP BY p.department_id, p.position_id, p.position_name
        )
        -- 最终按 department_id 聚合
        SELECT
            ad.department_id,
            ad.department_name,
            COALESCE(SUM(pe.employee_count), 0) AS headcount,
            COALESCE(
                json_agg(
                    json_build_object(
                        'position_id', pe.position_id,
                        'position_name', pe.position_name,
                        'employee_count', pe.employee_count,
                        'employees', pe.employees
                    )
                    ORDER BY pe.position_name
                ) FILTER (WHERE pe.position_id IS NOT NULL),
                '[]'::json
            ) AS positions
        FROM active_departments ad
        LEFT JOIN position_employees pe ON pe.department_id = ad.department_id
        GROUP BY ad.department_id, ad.department_name
        ORDER BY ad.department_name
        """
    )


def org_hierarchy():
    """嵌套 部门 → 岗位 → 员工 层级（完整版，含技能匹配）。

    每个部门包含：
      - 部门经理（最资深的员工，按 position_id 升序取第一位）
      - 部门人数
      - Top 5 技能
      - 岗位列表，每个岗位包含 required_skills 和 employees

    每个员工包含：
      - 技能列表（含熟练度）
      - 当前岗位匹配度（weighted dot product）
    """
    return json_array_query(
        """
        WITH
        -- 部门负责人：每个部门 position_id 最低的员工
        dept_head AS (
            SELECT p.department_id, e.full_name AS manager_name
            FROM (
                SELECT department_id, full_name, ROW_NUMBER() OVER (
                    PARTITION BY p.department_id ORDER BY e.position_id
                ) AS rn
                FROM employee e
                JOIN position p ON p.position_id = e.position_id
                WHERE e.employment_status IN ('active', 'probation')
            ) t
            WHERE rn = 1
        ),
        -- 部门 Top 5 技能
        dept_top_skills AS (
            SELECT p.department_id,
                   json_agg(skill_name ORDER BY cnt DESC) AS top_skills
            FROM (
                SELECT p.department_id, s.skill_name,
                       COUNT(*) AS cnt,
                       ROW_NUMBER() OVER (
                           PARTITION BY p.department_id ORDER BY COUNT(*) DESC
                       ) AS rn
                FROM employee e
                JOIN position p ON p.position_id = e.position_id
                JOIN employee_skill es ON es.employee_id = e.employee_id
                JOIN skill s ON s.skill_id = es.skill_id
                WHERE e.employment_status IN ('active', 'probation')
                GROUP BY p.department_id, s.skill_name
            ) t
            WHERE rn <= 5
            GROUP BY t.department_id
        ),
        -- 岗位所需技能
        pos_required_skills AS (
            SELECT prs.position_id,
                   json_agg(
                       json_build_object(
                           'skill_name', s.skill_name,
                           'required_level', prs.required_level,
                           'importance_weight', prs.importance_weight
                       )
                       ORDER BY prs.importance_weight DESC, prs.required_level DESC
                   ) AS required_skills
            FROM position_required_skill prs
            JOIN skill s ON s.skill_id = prs.skill_id
            GROUP BY prs.position_id
        ),
        -- 员工数据（含技能 + 岗位匹配度）
        employee_data AS (
            SELECT
                e.employee_id,
                e.employee_no,
                e.full_name,
                e.gender,
                e.employment_status,
                e.hire_date,
                p.department_id,
                e.position_id,
                e.manager_employee_id,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'skill_name', s.skill_name,
                            'proficiency_level', es.proficiency_level,
                            'category_name', sc.category_name
                        )
                        ORDER BY es.proficiency_level DESC
                    ) FILTER (WHERE es.skill_id IS NOT NULL),
                    '[]'::json
                ) AS skills,
                ROUND(
                    SUM(
                        COALESCE(prs.importance_weight, 0)
                        * LEAST(
                            COALESCE(es.proficiency_level, 0),
                            COALESCE(prs.required_level, 0)
                        )
                    )::decimal
                    / NULLIF(
                        SUM(
                            COALESCE(prs.importance_weight, 0)
                            * COALESCE(prs.required_level, 0)
                        ),
                        0
                    ) * 100,
                    1
                ) AS match_pct
            FROM employee e
            JOIN position p ON p.position_id = e.position_id
            LEFT JOIN employee_skill es ON es.employee_id = e.employee_id
            LEFT JOIN skill s ON s.skill_id = es.skill_id
            LEFT JOIN skill_category sc ON sc.category_id = s.category_id
            LEFT JOIN position_required_skill prs
                ON prs.position_id = e.position_id
                AND prs.skill_id = es.skill_id
            WHERE e.employment_status IN ('active', 'probation')
            GROUP BY e.employee_id, e.employee_no, e.full_name, e.gender,
                     e.employment_status, e.hire_date,
                     p.department_id, e.position_id, e.manager_employee_id
        ),
        -- 岗位级聚合
        position_agg AS (
            SELECT
                ed.department_id,
                ed.position_id,
                p.position_name,
                COUNT(*) AS employee_count,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'employee_id', ed.employee_id,
                            'employee_no', ed.employee_no,
                            'full_name', ed.full_name,
                            'gender', ed.gender,
                            'employment_status', ed.employment_status,
                            'hire_date', ed.hire_date,
                            'skills', ed.skills,
                            'match_pct', ed.match_pct
                        )
                        ORDER BY ed.full_name
                    ) FILTER (WHERE ed.employee_id IS NOT NULL),
                    '[]'::json
                ) AS employees
            FROM employee_data ed
            JOIN position p ON p.position_id = ed.position_id
            GROUP BY ed.department_id, ed.position_id, p.position_name
        )
        -- 最终部门级查询
        SELECT
            d.department_id,
            d.department_name,
            dh.manager_name AS department_manager,
            (SELECT COUNT(*)
             FROM employee e2
             JOIN position p2 ON p2.position_id = e2.position_id
             WHERE p2.department_id = d.department_id
               AND e2.employment_status IN ('active', 'probation')
            ) AS headcount,
            COALESCE(MAX(dts.top_skills), '[]'::json) AS top_skills,
            COALESCE(
                json_agg(
                    json_build_object(
                        'position_id', pa.position_id,
                        'position_name', pa.position_name,
                        'employee_count', pa.employee_count,
                        'required_skills',
                        COALESCE(prs.required_skills, '[]'::json),
                        'employees', pa.employees
                    )
                    ORDER BY pa.position_name
                ) FILTER (WHERE pa.position_id IS NOT NULL),
                '[]'::json
            ) AS positions
        FROM department d
        LEFT JOIN dept_head dh ON dh.department_id = d.department_id
        LEFT JOIN dept_top_skills dts ON dts.department_id = d.department_id
        LEFT JOIN position_agg pa ON pa.department_id = d.department_id
        LEFT JOIN pos_required_skills prs ON prs.position_id = pa.position_id
        GROUP BY d.department_id, d.department_name, dh.manager_name
        ORDER BY d.department_name
        """
    )


def employee_network(employee_id):
    """获取员工的汇报链和同级关系。"""
    return json_array_query(
        f"""
        WITH mgr AS (
            SELECT manager_employee_id FROM employee WHERE employee_id = {int(employee_id)}
        )
        SELECT 'manager' AS relation, e.employee_id, e.full_name,
               p.position_name, p2.department_name
        FROM employee e, mgr
        JOIN position p ON p.position_id = e.position_id
        JOIN department p2 ON p2.department_id = p.department_id
        WHERE e.employee_id = mgr.manager_employee_id

        UNION ALL

        SELECT 'subordinate' AS relation, e.employee_id, e.full_name,
               p.position_name, p2.department_name
        FROM employee e
        JOIN position p ON p.position_id = e.position_id
        JOIN department p2 ON p2.department_id = p.department_id
        WHERE e.manager_employee_id = {int(employee_id)}
          AND e.employment_status IN ('active', 'probation')

        UNION ALL

        SELECT 'peer' AS relation, e.employee_id, e.full_name,
               p.position_name, p2.department_name
        FROM employee e, mgr
        JOIN position p ON p.position_id = e.position_id
        JOIN department p2 ON p2.department_id = p.department_id
        WHERE e.manager_employee_id = mgr.manager_employee_id
          AND e.employee_id != {int(employee_id)}
          AND mgr.manager_employee_id IS NOT NULL
          AND e.employment_status IN ('active', 'probation')
        """
    )


def _build_reporting(employee_id):
    """将扁平的 employee_network() 结果重组为 manager / peers / subordinates。"""
    rows = employee_network(employee_id)
    result = {"manager": None, "peers": [], "subordinates": []}
    for row in rows:
        rel = row.get("relation")
        item = {
            "employee_id": row.get("employee_id"),
            "full_name": row.get("full_name"),
            "position_name": row.get("position_name"),
            "department_name": row.get("department_name"),
        }
        if rel == "manager":
            result["manager"] = item
        elif rel == "peer":
            result["peers"].append(item)
        elif rel == "subordinate":
            result["subordinates"].append(item)
    return result


def get_employee_bundle(employee_id):
    """员工完整资料包（侧滑面板用）—— 批量 SQL 模式。

    聚合 7 个数据域，通过单次 gsql 会话返回所有数据：
      - employee       基本资料
      - profile        扩展档案
      - skills         技能列表
      - position_match 全岗位匹配度
      - reporting      汇报关系
      - job_history    履历
      - attrition_risk 离职风险

    性能：原来 7 次 Docker exec（~3s）→ 1 次（~0.5s）。
    """
    from src.common.db import query_json, sql_literal
    from src.services.attrition_service import (
        _ABSENT_SQ, _AVG_PERF_SQ, _COMPOSITE, _LATE_SQ,
        _RISK_COMPONENTS, _RISK_LEVEL, _risk_sql,
    )

    eid = int(employee_id)
    _l = sql_literal

    # 单条 SQL：7 个字段各自子查询，一行取出全部 JSON
    _Q = chr(39)  # single quote

    sql = f"""
    SELECT row_to_json(b)::text FROM (
        SELECT
            (SELECT row_to_json(e)::text FROM (
                SELECT e.*, d.department_name, p.position_name,
                       mgr.full_name AS manager_name
                FROM employee e
                LEFT JOIN department d ON d.department_id = e.department_id
                LEFT JOIN position p ON p.position_id = e.position_id
                LEFT JOIN employee mgr ON mgr.employee_id = e.manager_employee_id
                WHERE e.employee_id = {eid}
            ) e) AS employee_json,

            (SELECT row_to_json(p)::text FROM employee_profile p
             WHERE p.employee_id = {eid}) AS profile_json,

            (SELECT COALESCE(json_agg(s), {_Q}[]{_Q}::json)::text FROM (
                SELECT sk.*, s2.skill_name, sc.category_name, sc.category_id
                FROM employee_skill sk
                JOIN skill s2 ON s2.skill_id = sk.skill_id
                LEFT JOIN skill_category sc ON sc.category_id = s2.category_id
                WHERE sk.employee_id = {eid}
                ORDER BY sk.proficiency_level DESC
            ) s) AS skills_json,

            (SELECT COALESCE(json_agg(m), {_Q}[]{_Q}::json)::text FROM (
                SELECT p.position_id, p.position_name,
                    ROUND(SUM(COALESCE(prs.importance_weight,0) * LEAST(COALESCE(es.proficiency_level,0), COALESCE(prs.required_level,0)))::decimal
                    / NULLIF(SUM(COALESCE(prs.importance_weight,0) * COALESCE(prs.required_level,0)), 0) * 100, 1) AS match_pct,
                    COUNT(es.skill_id) FILTER (WHERE es.proficiency_level >= prs.required_level) AS fulfilled,
                    COUNT(prs.skill_id) FILTER (WHERE es.skill_id IS NULL OR es.proficiency_level < prs.required_level) AS missing
                FROM position p
                JOIN position_required_skill prs ON prs.position_id = p.position_id
                LEFT JOIN employee_skill es ON es.skill_id = prs.skill_id AND es.employee_id = {eid}
                GROUP BY p.position_id, p.position_name
                ORDER BY match_pct DESC
            ) m) AS match_json,

            (SELECT COALESCE(json_agg(r), {_Q}[]{_Q}::json)::text FROM (
                SELECT {_Q}manager{_Q} AS relation, e2.employee_id, e2.full_name,
                       p2.position_name, d2.department_name
                FROM employee e
                JOIN employee e2 ON e2.employee_id = e.manager_employee_id
                JOIN position p2 ON p2.position_id = e2.position_id
                JOIN department d2 ON d2.department_id = p2.department_id
                WHERE e.employee_id = {eid}
                UNION ALL
                SELECT {_Q}subordinate{_Q} AS relation, e2.employee_id, e2.full_name,
                       p2.position_name, d2.department_name
                FROM employee e2
                JOIN position p2 ON p2.position_id = e2.position_id
                JOIN department d2 ON d2.department_id = p2.department_id
                WHERE e2.manager_employee_id = {eid}
                  AND e2.employment_status IN ({_Q}active{_Q},{_Q}probation{_Q})
                UNION ALL
                SELECT {_Q}peer{_Q} AS relation, e2.employee_id, e2.full_name,
                       p2.position_name, d2.department_name
                FROM employee e
                JOIN employee e2 ON e2.manager_employee_id = e.manager_employee_id
                JOIN position p2 ON p2.position_id = e2.position_id
                JOIN department d2 ON d2.department_id = p2.department_id
                WHERE e.employee_id = {eid}
                  AND e2.employee_id != {eid}
                  AND e.manager_employee_id IS NOT NULL
                  AND e2.employment_status IN ({_Q}active{_Q},{_Q}probation{_Q})
            ) r) AS report_json,

            (SELECT COALESCE(json_agg(j), {_Q}[]{_Q}::json)::text FROM (
                SELECT jh.*, d3.department_name, p3.position_name
                FROM employee_job_history jh
                LEFT JOIN department d3 ON d3.department_id = jh.department_id
                LEFT JOIN position p3 ON p3.position_id = jh.position_id
                WHERE jh.employee_id = {eid}
                ORDER BY jh.start_date DESC
            ) j) AS history_json,

            (SELECT row_to_json(r2)::text FROM (
                SELECT e.employee_id, e.employee_no, e.full_name,
                       d4.department_id, d4.department_name,
                       p4.position_id, p4.position_name,
                       e.manager_employee_id,
                       mgr2.full_name AS manager_name,
                       ROUND(({_COMPOSITE})::decimal, 4) AS risk_score,
                       ROUND(({_COMPOSITE})::decimal * 100, 1) AS risk_score_pct,
                       {', '.join(_RISK_COMPONENTS)},
                       {_RISK_LEVEL} AS risk_level,
                       e.tenure, e.engagement_score, e.last_promotion_months,
                       e.manager_changes, e.overtime_count,
                       ({_ABSENT_SQ}) AS attendance_absent_count,
                       ({_LATE_SQ}) AS attendance_late_count,
                       ({_AVG_PERF_SQ}) AS avg_performance_score,
                       e.employment_status,
                       ml.ml_risk_score
                FROM employee e
                JOIN department d4 ON d4.department_id = e.department_id
                JOIN position p4 ON p4.position_id = e.position_id
                LEFT JOIN employee mgr2 ON mgr2.employee_id = e.manager_employee_id
                LEFT JOIN (
                    SELECT employee_id, ROUND((PREDICT BY attrition_model (FEATURES
                        tenure, engagement_score, last_promotion_months, manager_changes, overtime_count
                    ) * 100)::decimal, 1) AS ml_risk_score
                    FROM employee WHERE employment_status IN ({_Q}active{_Q},{_Q}probation{_Q})
                ) ml ON ml.employee_id = e.employee_id
                WHERE e.employee_id = {eid}
            ) r2) AS risk_json
    ) b;
    """

    import json as _json

    row = query_json(sql)
    if not row:
        return None

    # 各字段是 ::text 序列化的 JSON 字符串，需要二次解析
    def _j(val):
        if isinstance(val, str):
            try:
                return _json.loads(val)
            except (_json.JSONDecodeError, TypeError):
                return val
        return val

    emp = _j(row.get("employee_json"))
    if not emp:
        return None

    # 重组 reporting（扁平的 relation 行 → manager / peers / subordinates）
    raw_report = _j(row.get("report_json")) or []
    reporting = {"manager": None, "peers": [], "subordinates": []}
    for r in raw_report:
        item = {
            "employee_id": r.get("employee_id"),
            "full_name": r.get("full_name"),
            "position_name": r.get("position_name"),
            "department_name": r.get("department_name"),
        }
        rel = r.get("relation")
        if rel == "manager":
            reporting["manager"] = item
        elif rel == "peer":
            reporting["peers"].append(item)
        elif rel == "subordinate":
            reporting["subordinates"].append(item)

    return {
        "employee": emp,
        "profile": _j(row.get("profile_json")),
        "skills": _j(row.get("skills_json")) or [],
        "position_match": _j(row.get("match_json")) or [],
        "reporting": reporting,
        "job_history": _j(row.get("history_json")) or [],
        "attrition_risk": _j(row.get("risk_json")),
    }


def critical_persons():
    """关键人风险分析：按领导人数排序的关键员工。"""
    return json_array_query(
        """
        SELECT e.employee_id, e.full_name, d.department_name,
               p.position_name,
               COUNT(DISTINCT sub.employee_id) AS direct_reports,
               COUNT(DISTINCT sub2.employee_id) AS team_size
        FROM employee e
        JOIN department d ON d.department_id = e.department_id
        JOIN position p ON p.position_id = e.position_id
        LEFT JOIN employee sub ON sub.manager_employee_id = e.employee_id
                              AND sub.employment_status IN ('active', 'probation')
        LEFT JOIN employee sub2 ON sub2.manager_employee_id IN (
            SELECT employee_id FROM employee
            WHERE manager_employee_id = e.employee_id
              AND employment_status IN ('active', 'probation')
        ) AND sub2.employment_status IN ('active', 'probation')
        WHERE e.employment_status IN ('active', 'probation')
        GROUP BY e.employee_id, e.full_name, d.department_name, p.position_name
        HAVING COUNT(DISTINCT sub.employee_id) > 0
        ORDER BY team_size DESC, direct_reports DESC
        """
    )


def department_stats():
    """各部门统计：人数、技能覆盖、平均技能水平。"""
    return json_array_query(
        """
        SELECT d.department_id, d.department_name,
               COUNT(DISTINCT e.employee_id) FILTER (
                   WHERE e.employment_status IN ('active', 'probation')
               ) AS headcount,
               COUNT(DISTINCT es.skill_id) AS skill_coverage,
               ROUND(AVG(es.proficiency_level), 1) AS avg_skill_level
        FROM department d
        LEFT JOIN employee e ON e.department_id = d.department_id
        LEFT JOIN employee_skill es ON es.employee_id = e.employee_id
        GROUP BY d.department_id, d.department_name
        ORDER BY d.department_name
        """
    )
