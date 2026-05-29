"""Organization network analysis using recursive CTEs.
Requires openGauss 7.0+.
Alternative: Apache AGE via CREATE EXTENSION age when enable_thread_pool=off.
"""

from src.common.db import json_array_query


def org_tree():
    """Full org hierarchy using recursive CTE."""
    return json_array_query(
        """
        WITH RECURSIVE org AS (
            SELECT e.employee_id, e.full_name, e.department_id,
                   e.manager_employee_id, d.department_name,
                   0 AS depth, e.full_name AS path
            FROM employee e
            JOIN department d ON d.department_id = e.department_id
            WHERE e.manager_employee_id IS NULL

            UNION ALL

            SELECT e.employee_id, e.full_name, e.department_id,
                   e.manager_employee_id, d.department_name,
                   org.depth + 1,
                   org.path || ' -> ' || e.full_name
            FROM employee e
            JOIN department d ON d.department_id = e.department_id
            JOIN org ON org.employee_id = e.manager_employee_id
        )
        SELECT * FROM org ORDER BY path
        """
    )


def employee_network(employee_id):
    """Get employee's reporting chain and peers."""
    return json_array_query(
        f"""
        WITH mgr AS (
            SELECT manager_employee_id FROM employee WHERE employee_id = {int(employee_id)}
        )
        SELECT 'manager' AS relation, e.employee_id, e.full_name, p.position_name
        FROM employee e, mgr
        JOIN position p ON p.position_id = e.position_id
        WHERE e.employee_id = mgr.manager_employee_id

        UNION ALL

        SELECT 'subordinate' AS relation, e.employee_id, e.full_name, p.position_name
        FROM employee e
        JOIN position p ON p.position_id = e.position_id
        WHERE e.manager_employee_id = {int(employee_id)}

        UNION ALL

        SELECT 'peer' AS relation, e.employee_id, e.full_name, p.position_name
        FROM employee e, mgr
        JOIN position p ON p.position_id = e.position_id
        WHERE e.manager_employee_id = mgr.manager_employee_id
          AND e.employee_id != {int(employee_id)}
          AND mgr.manager_employee_id IS NOT NULL
        """
    )


def critical_persons():
    """Find employees with most dependencies (key person risk)."""
    return json_array_query(
        """
        SELECT e.employee_id, e.full_name, d.department_name,
               COUNT(sub.employee_id) AS direct_reports,
               COUNT(DISTINCT sub2.employee_id) AS team_size
        FROM employee e
        JOIN department d ON d.department_id = e.department_id
        LEFT JOIN employee sub ON sub.manager_employee_id = e.employee_id
        LEFT JOIN employee sub2 ON sub2.manager_employee_id IN (
            SELECT employee_id FROM employee WHERE manager_employee_id = e.employee_id
        )
        WHERE e.employment_status = 'active'
        GROUP BY e.employee_id, e.full_name, d.department_name
        HAVING COUNT(sub.employee_id) > 0
        ORDER BY team_size DESC
        """
    )


def department_stats():
    """Per-department headcount and skill coverage."""
    return json_array_query(
        """
        SELECT d.department_id, d.department_name,
               COUNT(DISTINCT e.employee_id) FILTER (WHERE e.employment_status = 'active') AS headcount,
               COUNT(DISTINCT es.skill_id) AS skill_coverage,
               ROUND(AVG(es.proficiency_level), 1) AS avg_skill_level
        FROM department d
        LEFT JOIN employee e ON e.department_id = d.department_id
        LEFT JOIN employee_skill es ON es.employee_id = e.employee_id
        GROUP BY d.department_id, d.department_name
        ORDER BY d.department_name
        """
    )
