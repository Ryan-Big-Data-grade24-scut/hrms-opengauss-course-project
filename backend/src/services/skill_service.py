"""Skills intelligence service: profiles, matching, gap analysis."""

from src.common.db import json_array_query, json_object_query, query_scalar, sql_literal
from src.services.audit_service import write_audit


def list_skill_categories():
    return json_array_query(
        "SELECT * FROM skill_category ORDER BY sort_order"
    )


def list_skills(category_id=None):
    where = ""
    if category_id:
        where = f" WHERE category_id = {int(category_id)}"
    return json_array_query(
        f"SELECT s.*, sc.category_name FROM skill s "
        f"JOIN skill_category sc ON sc.category_id = s.category_id{where} "
        f"ORDER BY sc.sort_order, s.skill_id"
    )


def get_employee_skills(employee_id):
    return json_array_query(
        f"""
        SELECT es.*, s.skill_name, sc.category_name,
               sc.category_id
        FROM employee_skill es
        JOIN skill s ON s.skill_id = es.skill_id
        JOIN skill_category sc ON sc.category_id = s.category_id
        WHERE es.employee_id = {int(employee_id)}
          AND (es.confirmed_by IS NOT NULL OR es.is_inferred = false)
        ORDER BY es.proficiency_level DESC, sc.sort_order
        """
    )


def upsert_employee_skill(employee_id, payload, actor):
    skill_id = int(payload["skill_id"])
    level = int(payload.get("proficiency_level", 1))
    source = payload.get("acquired_from", "self")
    is_core = payload.get("is_core", False)

    existing = query_scalar(
        f"SELECT employee_skill_id FROM employee_skill "
        f"WHERE employee_id = {int(employee_id)} AND skill_id = {skill_id}"
    )
    if existing:
        execute_sql = (
            f"UPDATE employee_skill SET proficiency_level = {level}, "
            f"acquired_from = {sql_literal(source)}, "
            f"is_core = {str(is_core).upper()}, "
            f"updated_at = CURRENT_TIMESTAMP "
            f"WHERE employee_id = {int(employee_id)} AND skill_id = {skill_id}"
        )
    else:
        execute_sql = (
            f"INSERT INTO employee_skill "
            f"(employee_id, skill_id, proficiency_level, acquired_from, is_core) "
            f"VALUES ({int(employee_id)}, {skill_id}, {level}, "
            f"{sql_literal(source)}, {str(is_core).upper()})"
        )
    from src.common.db import execute
    execute(execute_sql)
    write_audit(actor, "upsert", "employee_skill", f"{employee_id}_{skill_id}", "updated skill")
    return get_employee_skills(employee_id)


def match_employee_to_positions(employee_id):
    """Weighted dot product matching (ProPer algorithm)."""
    return json_array_query(
        f"""
        SELECT p.position_id, p.position_name,
               ROUND(
                 SUM(prs.importance_weight * LEAST(COALESCE(es.proficiency_level, 0), prs.required_level))::decimal
                 / NULLIF(SUM(prs.importance_weight * prs.required_level), 0) * 100,
               1) AS match_pct,
               COUNT(*) FILTER (WHERE COALESCE(es.proficiency_level, 0) >= prs.required_level) AS fulfilled,
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


def gap_analysis():
    """Org-level skill gap: current avg vs strategic targets."""
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
    """Department x skill category capability matrix."""
    return json_array_query(
        """
        SELECT d.department_name, sc.category_name,
               ROUND(AVG(es.proficiency_level), 1) AS avg_level,
               COUNT(DISTINCT es.employee_id) AS staff_count
        FROM department d
        JOIN employee e ON e.department_id = d.department_id AND e.employment_status = 'active'
        JOIN employee_skill es ON es.employee_id = e.employee_id
        JOIN skill s ON s.skill_id = es.skill_id
        JOIN skill_category sc ON sc.category_id = s.category_id
        GROUP BY d.department_name, sc.category_name
        ORDER BY d.department_name, avg_level DESC
        """
    )


def skill_recommendations(skill_id):
    """Find related skills via skill_group_id."""
    return json_array_query(
        f"""
        SELECT s2.skill_id, s2.skill_name, sc.category_name
        FROM skill s1
        JOIN skill s2 ON s1.skill_group_id = s2.skill_id OR s2.skill_group_id = s1.skill_id
        JOIN skill_category sc ON sc.category_id = s2.category_id
        WHERE s1.skill_id = {int(skill_id)}
          AND s2.skill_id != {int(skill_id)}
        """
    )
