"""Cross-module analytics: combined insights from skills, attendance,
performance, and attrition for the analytics dashboard.

This service provides "combined" endpoints that aggregate data across
multiple domains to produce the strategic analytics views.
"""

from src.common.db import json_array_query


def critical_persons_enhanced():
    """Key person risk with attrition context.

    Finds managers/leaders who have:
      - high number of direct reports, AND
      - high attrition risk themselves

    Returns combined ranking so HR can identify single-point-of-failure risk.
    """
    return json_array_query("""
        WITH risk AS (
            SELECT employee_id,
                   ROUND(
                       (5.0 - e.engagement_score / 20.0) * 0.25
                       + LEAST(e.tenure::decimal / 60.0, 1.0) * 0.15
                       + (e.last_promotion_months::decimal / 36.0) * 0.20
                       + (e.manager_changes::decimal / 3.0) * 0.15
                       + (e.overtime_count::decimal / 30.0) * 0.05
                       + (e.attendance_absent_count::decimal / 10.0) * 0.05
                       + (5.0 - COALESCE(e.avg_performance_score, 75.0) / 20.0) * 0.10
                       + (e.attendance_late_count::decimal / 15.0) * 0.05,
                   4
               ) AS risk_score
            FROM employee e
            WHERE e.employment_status IN ('active', 'probation')
        )
        SELECT e.employee_id, e.full_name, d.department_name, p.position_name,
               COUNT(DISTINCT sub.employee_id) AS direct_reports,
               r.risk_score,
               CASE
                   WHEN r.risk_score >= 0.7 THEN 'critical'
                   WHEN r.risk_score >= 0.5 THEN 'high'
                   WHEN r.risk_score >= 0.3 THEN 'medium'
                   ELSE 'low'
               END AS risk_level,
               e.engagement_score,
               e.tenure
        FROM employee e
        JOIN department d ON d.department_id = e.department_id
        JOIN position p ON p.position_id = e.position_id
        JOIN risk r ON r.employee_id = e.employee_id
        LEFT JOIN employee sub ON sub.manager_employee_id = e.employee_id
            AND sub.employment_status IN ('active', 'probation')
        WHERE e.employment_status IN ('active', 'probation')
        GROUP BY e.employee_id, e.full_name, d.department_name, p.position_name,
                 r.risk_score, e.engagement_score, e.tenure
        HAVING COUNT(DISTINCT sub.employee_id) > 0
        ORDER BY r.risk_score DESC, direct_reports DESC
    """)


def department_health_score():
    """Composite department health score combining all analytics dimensions:

    - Skill coverage (from skill_service analytics)
    - Attendance rate (from attendance_service)
    - Performance avg (from performance_service)
    - Attrition risk avg (from attrition_service)

    Each dimension contributes 25% to the final score (higher = healthier).
    """
    return json_array_query("""
        WITH
        skill_coverage AS (
            SELECT d.department_id,
                   COUNT(DISTINCT es.employee_id) * 100.0
                       / NULLIF(COUNT(DISTINCT e.employee_id), 0) AS coverage_pct
            FROM department d
            LEFT JOIN employee e ON e.department_id = d.department_id
                AND e.employment_status IN ('active', 'probation')
            LEFT JOIN employee_skill es ON es.employee_id = e.employee_id
            GROUP BY d.department_id
        ),
        attendance_rate AS (
            SELECT e.department_id,
                   COUNT(*) FILTER (WHERE ar.status IN ('present', 'half-day')) * 100.0
                       / NULLIF(COUNT(*), 0) AS att_rate
            FROM attendance_record ar
            JOIN employee e ON e.employee_id = ar.employee_id
            WHERE ar.clock_in >= CURRENT_TIMESTAMP - INTERVAL '3 months'
            GROUP BY e.department_id
        ),
        perf_avg AS (
            SELECT e.department_id,
                   AVG(pr.score) AS avg_score
            FROM performance_review pr
            JOIN employee e ON e.employee_id = pr.employee_id
            WHERE pr.status IN ('submitted', 'acknowledged')
            GROUP BY e.department_id
        ),
        attrition_risk AS (
            SELECT e.department_id,
                   AVG(
                       (5.0 - e.engagement_score / 20.0) * 0.25
                       + LEAST(e.tenure::decimal / 60.0, 1.0) * 0.15
                       + (e.last_promotion_months::decimal / 36.0) * 0.20
                       + (e.manager_changes::decimal / 3.0) * 0.15
                       + (e.overtime_count::decimal / 30.0) * 0.05
                       + (e.attendance_absent_count::decimal / 10.0) * 0.05
                       + (5.0 - COALESCE(e.avg_performance_score, 75.0) / 20.0) * 0.10
                       + (e.attendance_late_count::decimal / 15.0) * 0.05
                   ) AS avg_risk
            FROM employee e
            WHERE e.employment_status IN ('active', 'probation')
            GROUP BY e.department_id
        )
        SELECT d.department_id, d.department_name,
               sc.coverage_pct,
               ar.att_rate,
               pa.avg_score,
               ROUND((1.0 - ar2.avg_risk) * 100, 1) AS health_score_from_risk,
               ROUND(
                   (COALESCE(sc.coverage_pct, 0) * 0.25
                    + COALESCE(ar.att_rate, 0) * 0.25
                    + COALESCE(pa.avg_score, 75.0) * 0.25
                    + (1.0 - COALESCE(ar2.avg_risk, 0.5)) * 100 * 0.25)
               , 1) AS composite_health_score
        FROM department d
        LEFT JOIN skill_coverage sc ON sc.department_id = d.department_id
        LEFT JOIN attendance_rate ar ON ar.department_id = d.department_id
        LEFT JOIN perf_avg pa ON pa.department_id = d.department_id
        LEFT JOIN attrition_risk ar2 ON ar2.department_id = d.department_id
        ORDER BY composite_health_score DESC
    """)


def org_skill_gap_department(department_id: int):
    """Per-department skill gap detail.

    Shows which skills the department is below target on,
    with current avg proficiency vs required level.
    """
    return json_array_query(f"""
        WITH dept_positions AS (
            SELECT DISTINCT position_id
            FROM employee
            WHERE department_id = {int(department_id)}
              AND employment_status IN ('active', 'probation')
        ),
        dept_targets AS (
            SELECT prs.skill_id, s.skill_name, sc.category_name,
                   MAX(prs.required_level) AS target_level
            FROM dept_positions dp
            JOIN position_required_skill prs ON prs.position_id = dp.position_id
            JOIN skill s ON s.skill_id = prs.skill_id
            JOIN skill_category sc ON sc.category_id = s.category_id
            GROUP BY prs.skill_id, s.skill_name, sc.category_name
        ),
        dept_skills AS (
            SELECT es.skill_id, AVG(es.proficiency_level) AS current_avg,
                   COUNT(DISTINCT es.employee_id) AS staff_with_skill
            FROM employee e
            JOIN employee_skill es ON es.employee_id = e.employee_id
            WHERE e.department_id = {int(department_id)}
              AND e.employment_status IN ('active', 'probation')
            GROUP BY es.skill_id
        )
        SELECT dt.skill_id, dt.skill_name, dt.category_name,
               dt.target_level,
               COALESCE(ds.current_avg, 0) AS current_avg,
               ROUND(COALESCE(ds.current_avg, 0) - dt.target_level, 1) AS gap,
               COALESCE(ds.staff_with_skill, 0) AS staff_with_skill,
               (SELECT COUNT(*) FROM employee
                WHERE department_id = {int(department_id)}
                  AND employment_status IN ('active', 'probation')
               ) AS dept_size
        FROM dept_targets dt
        LEFT JOIN dept_skills ds ON ds.skill_id = dt.skill_id
        ORDER BY gap, dt.category_name, dt.skill_name
    """)


def org_risk_trend_summary():
    """Engagement and attrition trend data across departments.

    Returns per-department averages of key indicators so the analytics
    dashboard can show time-series-style comparisons.
    """
    return json_array_query("""
        SELECT d.department_id, d.department_name,
               COUNT(*) AS headcount,
               ROUND(AVG(e.engagement_score), 1) AS avg_engagement,
               ROUND(AVG(e.tenure), 1) AS avg_tenure,
               ROUND(AVG(e.last_promotion_months), 1) AS avg_promotion_months,
               ROUND(AVG(e.manager_changes), 2) AS avg_manager_changes,
               ROUND(AVG(e.overtime_count), 1) AS avg_overtime,
               ROUND(AVG(e.attendance_absent_count), 1) AS avg_absent_count,
               ROUND(AVG(e.attendance_late_count), 1) AS avg_late_count,
               ROUND(AVG(COALESCE(e.avg_performance_score, 0)), 1) AS avg_performance
        FROM employee e
        JOIN department d ON d.department_id = e.department_id
        WHERE e.employment_status IN ('active', 'probation')
        GROUP BY d.department_id, d.department_name
        ORDER BY d.department_name
    """)


def skill_gap_analysis_enhanced():
    """Enhanced org-level skill gap: current avg vs strategic target for ALL skills,
    not just the hardcoded ones in skill_service.gap_analysis().

    For every skill that has at least one position_required_skill entry,
    compute the org-wide average proficiency and the gap vs required level.
    """
    return json_array_query("""
        WITH skill_targets AS (
            SELECT skill_id, MAX(required_level) AS target_level
            FROM position_required_skill
            GROUP BY skill_id
        ),
        skill_avgs AS (
            SELECT s.skill_id, s.skill_name, sc.category_name,
                   st.target_level,
                   COUNT(DISTINCT es.employee_id) AS staff_count,
                   ROUND(AVG(es.proficiency_level), 1) AS current_avg
            FROM skill_targets st
            JOIN skill s ON s.skill_id = st.skill_id
            JOIN skill_category sc ON sc.category_id = s.category_id
            LEFT JOIN employee_skill es ON es.skill_id = s.skill_id
            GROUP BY s.skill_id, s.skill_name, sc.category_name, st.target_level
        )
        SELECT skill_id, skill_name, category_name,
               target_level, current_avg,
               ROUND(current_avg - target_level, 1) AS gap,
               staff_count,
               CASE
                   WHEN current_avg >= target_level THEN 'sufficient'
                   WHEN current_avg >= target_level * 0.7 THEN 'developing'
                   ELSE 'critical_shortage'
               END AS gap_severity
        FROM skill_avgs
        ORDER BY gap, category_name, skill_name
    """)
