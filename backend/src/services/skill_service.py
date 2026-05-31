"""技能智能服务：技能 CRUD、员工技能管理、岗位匹配、差距分析。

提供：
  技能目录管理：
    - list_skill_categories() / create/update/delete
    - list_skills() / create/update/delete

  员工技能管理：
    - get_employee_skills() / upsert_employee_skill() / delete_employee_skill()
    - infer_skills_from_history()

  岗位匹配（ProPer 算法）：
    - match_employee_to_positions()  —— 加权点积匹配度
    - gap_analysis()                 —— 组织级技能差距
    - heatmap()                      —— 部门 × 技能类别矩阵

  分析报表：
    - org_skills_overview()          —— 技能类别概览
    - department_comparison()        —— 部门横向对比
    - skill_recommendations()        —— 关联技能推荐

  项目管理：
    - list_employee_projects() / create_employee_project()

权限：
  - skill.manage  —— 管理技能目录和员工技能分配
  - employee.manage —— 查看员工项目和技能
"""

from src.common.db import execute, json_array_query, json_object_query, query_scalar, sql_literal
from src.common.permission import _require_permission_scope
from src.services.audit_service import write_audit


# ===================================================================
# 技能类别 CRUD
# ===================================================================

def list_skill_categories():
    """列出所有技能类别（按排序号排列）。"""
    return json_array_query(
        "SELECT * FROM skill_category ORDER BY sort_order"
    )


def create_skill_category(payload, actor):
    """创建技能类别。"""
    category_name = payload["category_name"]
    description = payload.get("description")
    sort_order = int(payload.get("sort_order", 0))
    parent_category_id = payload.get("parent_category_id")
    if parent_category_id:
        parent_category_id = int(parent_category_id)

    sql = f"""
        INSERT INTO skill_category (category_name, description, sort_order, parent_category_id)
        VALUES ({sql_literal(category_name)}, {sql_literal(description)},
                {sort_order}, {sql_literal(parent_category_id)})
        RETURNING category_id
    """
    cat_id = int(query_scalar(sql))
    write_audit(actor, "create", "skill_category", str(cat_id),
                f"created category {category_name}")
    return {"category_id": cat_id, "category_name": category_name}


def update_skill_category(category_id, payload, actor):
    """更新技能类别。"""
    fields = []
    for field in ("category_name", "description", "sort_order", "parent_category_id"):
        if field in payload:
            val = payload[field]
            if field in ("sort_order", "parent_category_id"):
                val = int(val) if val else None
            fields.append(f"{field} = {sql_literal(val)}")
    if fields:
        execute(f"UPDATE skill_category SET {', '.join(fields)} WHERE category_id = {int(category_id)}")
        write_audit(actor, "update", "skill_category", str(category_id), "updated category")
    return {"category_id": int(category_id), "status": "updated"}


def delete_skill_category(category_id, actor):
    """删除技能类别。"""
    execute(f"DELETE FROM skill_category WHERE category_id = {int(category_id)}")
    write_audit(actor, "delete", "skill_category", str(category_id), "deleted category")
    return {"status": "deleted"}


# ===================================================================
# 技能 CRUD
# ===================================================================

def list_skills(category_id=None):
    """列出技能，可按类别筛选。"""
    where = ""
    if category_id:
        where = f" WHERE category_id = {int(category_id)}"
    return json_array_query(
        f"SELECT s.*, sc.category_name FROM skill s "
        f"JOIN skill_category sc ON sc.category_id = s.category_id{where} "
        f"ORDER BY sc.sort_order, s.skill_id"
    )


def create_skill(payload, actor):
    """创建技能。"""
    skill_name = payload["skill_name"]
    category_id = int(payload["category_id"])
    description = payload.get("description")
    skill_group_id = payload.get("skill_group_id")
    if skill_group_id:
        skill_group_id = int(skill_group_id)

    sql = f"""
        INSERT INTO skill (skill_name, category_id, description, skill_group_id)
        VALUES ({sql_literal(skill_name)}, {category_id},
                {sql_literal(description)}, {sql_literal(skill_group_id)})
        RETURNING skill_id
    """
    skill_id = int(query_scalar(sql))
    write_audit(actor, "create", "skill", str(skill_id),
                f"created skill {skill_name}")
    return {"skill_id": skill_id, "skill_name": skill_name}


def update_skill(skill_id, payload, actor):
    """更新技能。"""
    fields = []
    for field in ("skill_name", "category_id", "description", "skill_group_id", "status"):
        if field in payload:
            val = payload[field]
            if field in ("category_id", "skill_group_id"):
                val = int(val) if val else None
            fields.append(f"{field} = {sql_literal(val)}")
    if fields:
        execute(f"UPDATE skill SET {', '.join(fields)} WHERE skill_id = {int(skill_id)}")
        write_audit(actor, "update", "skill", str(skill_id), "updated skill")
    return {"skill_id": int(skill_id), "status": "updated"}


def delete_skill(skill_id, actor):
    """删除技能。"""
    execute(f"DELETE FROM skill WHERE skill_id = {int(skill_id)}")
    write_audit(actor, "delete", "skill", str(skill_id), "deleted skill")
    return {"status": "deleted"}


# ===================================================================
# 员工技能管理
# ===================================================================

def get_employee_skills(employee_id):
    """获取员工的技能列表（含分类和熟练度）。"""
    return json_array_query(
        f"""
        SELECT es.*, s.skill_name, sc.category_name, sc.category_id
        FROM employee_skill es
        JOIN skill s ON s.skill_id = es.skill_id
        JOIN skill_category sc ON sc.category_id = s.category_id
        WHERE es.employee_id = {int(employee_id)}
          AND (es.confirmed_by IS NOT NULL OR es.is_inferred = false)
        ORDER BY es.proficiency_level DESC, sc.sort_order
        """
    )


def upsert_employee_skill(employee_id, payload, actor):
    """新增或更新员工技能（有则更新，无则插入）。"""
    skill_id = int(payload["skill_id"])
    level = int(payload.get("proficiency_level", 1))
    source = payload.get("acquired_from", "self")
    is_core = payload.get("is_core", False)

    existing = query_scalar(
        f"SELECT employee_skill_id FROM employee_skill "
        f"WHERE employee_id = {int(employee_id)} AND skill_id = {skill_id}"
    )
    if existing:
        execute(
            f"UPDATE employee_skill SET proficiency_level = {level}, "
            f"acquired_from = {sql_literal(source)}, "
            f"is_core = {str(is_core).upper()}, "
            f"updated_at = CURRENT_TIMESTAMP "
            f"WHERE employee_id = {int(employee_id)} AND skill_id = {skill_id}"
        )
    else:
        execute(
            f"INSERT INTO employee_skill "
            f"(employee_id, skill_id, proficiency_level, acquired_from, is_core) "
            f"VALUES ({int(employee_id)}, {skill_id}, {level}, "
            f"{sql_literal(source)}, {str(is_core).upper()})"
        )
    write_audit(actor, "upsert", "employee_skill", f"{employee_id}_{skill_id}",
                "updated skill")
    return get_employee_skills(employee_id)


def delete_employee_skill(employee_id, skill_id, actor):
    """删除员工技能。"""
    execute(f"""
        DELETE FROM employee_skill
        WHERE employee_id = {int(employee_id)} AND skill_id = {int(skill_id)}
    """)
    write_audit(actor, "delete", "employee_skill", f"{employee_id}_{skill_id}",
                "removed skill from employee")
    return {"status": "deleted"}


def infer_skills_from_history(employee_id, actor):
    """从履历数据 AI 推断员工技能（启发式）。

    从以下来源收集技能候选：
      - 岗位要求技能（position_required_skill）
      - 项目技术栈（project_tech_stack）

    将推断的技能以 is_inferred=true 标记插入。
    """
    existing = set()
    for row in json_array_query(
        f"SELECT skill_id FROM employee_skill WHERE employee_id = {int(employee_id)}"
    ):
        existing.add(row["skill_id"])

    candidates = json_array_query(f"""
        SELECT DISTINCT prs.skill_id, s.skill_name
        FROM position_required_skill prs
        JOIN skill s ON s.skill_id = prs.skill_id
        WHERE prs.position_id IN (
            SELECT position_id FROM employee WHERE employee_id = {int(employee_id)}
        )
        AND prs.skill_id NOT IN (
            SELECT skill_id FROM employee_skill WHERE employee_id = {int(employee_id)}
        )

        UNION

        SELECT DISTINCT pts.skill_id, s.skill_name
        FROM employee_project ep
        JOIN project_tech_stack pts ON pts.project_id = ep.project_id
        JOIN skill s ON s.skill_id = pts.skill_id
        WHERE ep.employee_id = {int(employee_id)}
        AND pts.skill_id NOT IN (
            SELECT skill_id FROM employee_skill WHERE employee_id = {int(employee_id)}
        )
    """)

    inserted = []
    for row in candidates:
        skill_id = row["skill_id"]
        if skill_id in existing:
            continue
        execute(f"""
            INSERT INTO employee_skill
                (employee_id, skill_id, proficiency_level, acquired_from,
                 is_core, is_inferred, confirmed_by)
            VALUES ({int(employee_id)}, {skill_id}, 2,
                    'inferred', false, true, NULL)
        """)
        inserted.append({"skill_id": skill_id, "skill_name": row["skill_name"]})
        existing.add(skill_id)

    write_audit(actor, "infer", "employee_skill", str(employee_id),
                f"inferred {len(inserted)} skills from history")
    return {"employee_id": employee_id, "inferred": inserted, "count": len(inserted)}


# ===================================================================
# 岗位匹配（ProPer 加权点积算法）
# ===================================================================

def match_employee_to_positions(employee_id):
    """员工与全岗位匹配度计算（ProPer 算法）。

    公式：
      match_pct = SUM(importance_weight * MIN(proficiency, required))
                  / SUM(importance_weight * required) * 100

    返回每个岗位的匹配度、已满足技能数、缺失技能数。
    """
    return json_array_query(
        f"""
        SELECT p.position_id, p.position_name,
               ROUND(
                 SUM(prs.importance_weight
                     * LEAST(COALESCE(es.proficiency_level, 0), prs.required_level))::decimal
                 / NULLIF(SUM(prs.importance_weight * prs.required_level), 0) * 100,
               1) AS match_pct,
               COUNT(*) FILTER (
                   WHERE COALESCE(es.proficiency_level, 0) >= prs.required_level
               ) AS fulfilled,
               COUNT(*) FILTER (WHERE es.proficiency_level IS NULL) AS missing
        FROM position p
        JOIN position_required_skill prs ON prs.position_id = p.position_id
        LEFT JOIN employee_skill es
          ON es.employee_id = {int(employee_id)}
          AND es.skill_id = prs.skill_id
          AND es.is_inferred = false
        GROUP BY p.position_id, p.position_name
        ORDER BY match_pct DESC
        """
    )


def match_position_to_candidates(position_id):
    """岗位候选人匹配：找出最适合某岗位的员工。

    返回按匹配度降序排列的员工列表。
    """
    return json_array_query(
        f"""
        SELECT e.employee_id, e.full_name, e.employee_no,
               d.department_name,
               ROUND(
                 SUM(prs.importance_weight
                     * LEAST(COALESCE(es.proficiency_level, 0), prs.required_level))::decimal
                 / NULLIF(SUM(prs.importance_weight * prs.required_level), 0) * 100,
               1) AS match_pct,
               COUNT(*) FILTER (
                   WHERE COALESCE(es.proficiency_level, 0) >= prs.required_level
               ) AS fulfilled,
               COUNT(*) FILTER (WHERE es.proficiency_level IS NULL) AS missing
        FROM position_required_skill prs
        CROSS JOIN employee e
        JOIN department d ON d.department_id = e.department_id
        LEFT JOIN employee_skill es
          ON es.employee_id = e.employee_id
          AND es.skill_id = prs.skill_id
          AND es.is_inferred = false
        WHERE prs.position_id = {int(position_id)}
          AND e.employment_status IN ('active', 'probation')
        GROUP BY e.employee_id, e.full_name, e.employee_no, d.department_name
        HAVING SUM(prs.importance_weight * prs.required_level) > 0
        ORDER BY match_pct DESC
        LIMIT 20
        """
    )


# ===================================================================
# 技能差距与热力图分析
# ===================================================================

def gap_analysis():
    """组织级技能差距：当前平均水平 vs 战略目标水平。"""
    return json_array_query(
        """
        WITH targets (skill_name, target) AS (
            VALUES ('Python', 4), ('openGauss', 4), ('SQL', 4),
                   ('Docker', 3), ('DataAnalysis', 3)
        )
        SELECT t.skill_name, t.target,
               COALESCE(ROUND(AVG(es.proficiency_level), 1), 0.0) AS current_avg,
               ROUND(COALESCE(AVG(es.proficiency_level), 0) - t.target, 1) AS gap,
               COUNT(es.employee_id) AS staff_count
        FROM targets t
        LEFT JOIN skill sk ON sk.skill_name = t.skill_name
        LEFT JOIN employee_skill es ON es.skill_id = sk.skill_id
        GROUP BY t.skill_name, t.target
        ORDER BY gap
        """
    )


def heatmap():
    """部门 × 技能类别能力矩阵热力图。"""
    return json_array_query(
        """
        SELECT d.department_name, sc.category_name,
               ROUND(AVG(es.proficiency_level), 1) AS avg_level,
               COUNT(DISTINCT es.employee_id) AS staff_count
        FROM department d
        JOIN employee e ON e.department_id = d.department_id
            AND e.employment_status = 'active'
        JOIN employee_skill es ON es.employee_id = e.employee_id
        JOIN skill s ON s.skill_id = es.skill_id
        JOIN skill_category sc ON sc.category_id = s.category_id
        GROUP BY d.department_name, sc.category_name
        ORDER BY d.department_name, avg_level DESC
        """
    )


# ===================================================================
# 技能分析报表
# ===================================================================

def org_skills_overview():
    """技能类别概览：每类技能的员工覆盖率和平均熟练度。"""
    return json_array_query(
        """
        WITH active_total AS (
            SELECT COUNT(*) AS total
            FROM employee
            WHERE employment_status = 'active'
        )
        SELECT sc.category_id, sc.category_name,
               COUNT(DISTINCT s.skill_id)          AS skills_in_category,
               COUNT(DISTINCT es.employee_id)      AS employee_count,
               COALESCE(ROUND(AVG(es.proficiency_level), 1), 0.0)
                                                   AS avg_proficiency,
               ROUND(
                   COUNT(DISTINCT es.employee_id)
                   * 100.0 / NULLIF(at.total, 0), 1
               )                                    AS coverage_pct
        FROM skill_category sc
        CROSS JOIN active_total at
        LEFT JOIN skill s              ON s.category_id = sc.category_id
        LEFT JOIN employee_skill es    ON es.skill_id   = s.skill_id
        LEFT JOIN employee e           ON e.employee_id = es.employee_id
                                      AND e.employment_status = 'active'
        GROUP BY sc.category_id, sc.category_name, sc.sort_order, at.total
        ORDER BY sc.sort_order
        """
    )


def department_comparison():
    """部门横向对比：每个 (部门, 技能类别) 组合的数据。

    即使某部门无人拥有某类技能，也返回零值行。
    """
    return json_array_query(
        """
        WITH dept_employees AS (
            SELECT department_id, COUNT(*) AS dept_size
            FROM employee
            WHERE employment_status = 'active'
            GROUP BY department_id
        )
        SELECT d.department_id, d.department_name,
               sc.category_id, sc.category_name,
               COALESCE(ROUND(AVG(es.proficiency_level), 1), 0.0) AS avg_proficiency,
               COUNT(DISTINCT es.employee_id)     AS employee_count,
               COALESCE(de.dept_size, 0)          AS dept_size,
               ROUND(
                   COUNT(DISTINCT es.employee_id)
                   * 100.0 / NULLIF(de.dept_size, 0), 1
               )                                   AS coverage_pct
        FROM department d
        CROSS JOIN skill_category sc
        LEFT JOIN dept_employees de ON de.department_id = d.department_id
        LEFT JOIN employee e
            ON e.department_id = d.department_id
           AND e.employment_status = 'active'
        LEFT JOIN skill s ON s.category_id = sc.category_id
        LEFT JOIN employee_skill es
            ON es.skill_id = s.skill_id
           AND es.employee_id = e.employee_id
        GROUP BY d.department_id, d.department_name,
                 sc.category_id, sc.category_name, sc.sort_order, de.dept_size
        ORDER BY d.department_name, sc.sort_order
        """
    )


def skill_recommendations(skill_id):
    """关联技能推荐：通过 skill_group_id 关联查找。"""
    return json_array_query(
        f"""
        SELECT s2.skill_id, s2.skill_name, sc.category_name
        FROM skill s1
        JOIN skill s2
            ON s1.skill_group_id = s2.skill_id
            OR s2.skill_group_id = s1.skill_id
        JOIN skill_category sc ON sc.category_id = s2.category_id
        WHERE s1.skill_id = {int(skill_id)}
          AND s2.skill_id != {int(skill_id)}
        """
    )


# ===================================================================
# 员工项目管理
# ===================================================================

def list_employee_projects(employee_id):
    """列出员工的参与项目（含技术栈）。"""
    return json_array_query(f"""
        SELECT ep.project_id, ep.project_name, ep.role,
               ep.start_date, ep.end_date, ep.description,
               COALESCE(
                   json_agg(
                       json_build_object(
                           'skill_id', pts.skill_id,
                           'skill_name', s.skill_name
                       )
                   ) FILTER (WHERE pts.skill_id IS NOT NULL),
                   '[]'::json
               ) AS tech_stack
        FROM employee_project ep
        LEFT JOIN project_tech_stack pts ON pts.project_id = ep.project_id
        LEFT JOIN skill s ON s.skill_id = pts.skill_id
        WHERE ep.employee_id = {int(employee_id)}
        GROUP BY ep.project_id, ep.project_name, ep.role,
                 ep.start_date, ep.end_date, ep.description
        ORDER BY ep.start_date DESC NULLS LAST
    """)


def create_employee_project(employee_id, payload, actor):
    """创建员工项目（可选技术栈技能）。"""
    project_name = payload["project_name"]
    role = payload.get("role")
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    description = payload.get("description")
    tech_stack = payload.get("tech_stack", [])

    project_id = int(query_scalar(f"""
        INSERT INTO employee_project
            (project_name, employee_id, role, start_date, end_date, description)
        VALUES ({sql_literal(project_name)}, {int(employee_id)},
                {sql_literal(role)}, {sql_literal(start_date)},
                {sql_literal(end_date)}, {sql_literal(description)})
        RETURNING project_id
    """))

    for skill_id in tech_stack:
        execute(f"""
            INSERT INTO project_tech_stack (project_id, skill_id)
            VALUES ({project_id}, {int(skill_id)})
            ON CONFLICT (project_id, skill_id) DO NOTHING
        """)

    write_audit(actor, "create", "employee_project", str(project_id),
                f"created project {project_name} for employee {employee_id}")
    return {"project_id": project_id, "project_name": project_name}


def delete_employee_project(project_id, actor):
    """删除员工项目（级联删除技术栈）。"""
    execute(f"DELETE FROM employee_project WHERE project_id = {int(project_id)}")
    write_audit(actor, "delete", "employee_project", str(project_id),
                "deleted project")
    return {"status": "deleted"}
