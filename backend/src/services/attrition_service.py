"""Hybrid attrition risk service: rule-based composite scoring + ML secondary signal.

Enhanced formula (V8) includes attendance and performance components:

  risk = (5 - engagement_score/20) * 0.25      -- inverted engagement (25%)
       + min(tenure/60, 1)          * 0.15      -- tenure plateau (15%)
       + (last_promotion_months/36) * 0.20      -- promotion delay (20%)
       + (manager_changes/3)        * 0.15      -- mgr instability (15%)
       + (overtime_count/30)        * 0.05      -- overtime burden (5%)
       + (absent_count/10)          * 0.05      -- absenteeism (5%)
       + (5 - avg_performance/20)   * 0.10      -- inverted performance (10%)
       + (late_count/15)            * 0.05      -- lateness (5%)

Thresholds for risk_level:
  < 0.3  → low      (green)
  0.3-0.5 → medium  (yellow, monitor)
  0.5-0.7 → high    (orange, action needed)
  >= 0.7  → critical (red, immediate intervention)
"""

from src.common.db import execute, json_array_query, json_object_query, query_scalar

# ---------------------------------------------------------------------------
# Subquery expressions replacing non‑existent employee table columns
# ---------------------------------------------------------------------------
_ABSENT_SQ = "(SELECT COUNT(*) FROM attendance_record WHERE employee_id = e.employee_id AND status = 'absent')"
_LATE_SQ = "(SELECT COUNT(*) FROM attendance_record WHERE employee_id = e.employee_id AND status = 'late')"
_AVG_PERF_SQ = "(SELECT AVG(score)::decimal FROM performance_review WHERE employee_id = e.employee_id AND status IN ('submitted', 'acknowledged'))"

# ---------------------------------------------------------------------------
# Shared SQL fragment – the composite score expression (V8 enhanced)
# ---------------------------------------------------------------------------
_COMPOSITE = (
    "(5.0 - COALESCE(e.engagement_score, 75) / 20.0) * 0.25 "
    "+ LEAST(COALESCE(e.tenure, 12)::decimal / 60.0, 1.0) * 0.15 "
    "+ (COALESCE(e.last_promotion_months, 6)::decimal / 36.0) * 0.20 "
    "+ (COALESCE(e.manager_changes, 0)::decimal / 3.0) * 0.15 "
    "+ (COALESCE(e.overtime_count, 0)::decimal / 30.0) * 0.05 "
    f"+ ({_ABSENT_SQ}::decimal / 10.0) * 0.05 "
    f"+ (5.0 - COALESCE({_AVG_PERF_SQ}, 75.0) / 20.0) * 0.10 "
    f"+ ({_LATE_SQ}::decimal / 15.0) * 0.05"
)

_RISK_LEVEL = (
    "CASE "
    f"WHEN ({_COMPOSITE}) >= 0.7 THEN 'critical' "
    f"WHEN ({_COMPOSITE}) >= 0.5 THEN 'high' "
    f"WHEN ({_COMPOSITE}) >= 0.3 THEN 'medium' "
    "ELSE 'low' END"
)

# ---------------------------------------------------------------------------
# Risk components (individual factor contributions for transparency)
# ---------------------------------------------------------------------------
_RISK_COMPONENTS = (
    f"ROUND((5.0 - COALESCE(e.engagement_score, 75) / 20.0) * 0.25, 4) AS engagement_risk",
    f"ROUND(LEAST(COALESCE(e.tenure, 12)::decimal / 60.0, 1.0) * 0.15, 4) AS tenure_risk",
    f"ROUND(COALESCE(e.last_promotion_months, 6)::decimal / 36.0 * 0.20, 4) AS promotion_risk",
    f"ROUND(COALESCE(e.manager_changes, 0)::decimal / 3.0 * 0.15, 4) AS manager_change_risk",
    f"ROUND(COALESCE(e.overtime_count, 0)::decimal / 30.0 * 0.05, 4) AS overtime_risk",
    f"ROUND(({_ABSENT_SQ}::decimal / 10.0) * 0.05, 4) AS attendance_risk",
    f"ROUND((5.0 - COALESCE({_AVG_PERF_SQ}, 75.0) / 20.0) * 0.10, 4) AS performance_risk",
    f"ROUND(({_LATE_SQ}::decimal / 15.0) * 0.05, 4) AS late_risk",
)


def _risk_sql(extra_where: str = "") -> str:
    """Build the full risk SELECT statement.

    Parameters
    ----------
    extra_where : str
        Additional WHERE clause fragment (e.g. ``AND e.employee_id = 5``).
    """
    return f"""
    SELECT
        e.employee_id,
        e.employee_no,
        e.full_name,
        d.department_id,
        d.department_name,
        p.position_id,
        p.position_name,
        e.manager_employee_id,
        mgr.full_name AS manager_name,
        ROUND(({_COMPOSITE})::decimal, 4) AS risk_score,
        ROUND(({_COMPOSITE})::decimal * 100, 1) AS risk_score_pct,
        {', '.join(_RISK_COMPONENTS)},
        {_RISK_LEVEL} AS risk_level,
        e.tenure,
        e.engagement_score,
        e.last_promotion_months,
        e.manager_changes,
        e.overtime_count,
        {_ABSENT_SQ} AS attendance_absent_count,
        {_LATE_SQ} AS attendance_late_count,
        {_AVG_PERF_SQ} AS avg_performance_score,
        e.employment_status,
        ml.ml_risk_score
    FROM employee e
    JOIN department d ON d.department_id = e.department_id
    JOIN position p ON p.position_id = e.position_id
    LEFT JOIN employee mgr ON mgr.employee_id = e.manager_employee_id
    LEFT JOIN (
        -- ML secondary signal (openGauss DB4AI); NULL if model absent
        SELECT employee_id,
               ROUND((PREDICT BY attrition_model (FEATURES
                   tenure, engagement_score,
                   last_promotion_months, manager_changes,
                   overtime_count, attendance_absent_count,
                   attendance_late_count, avg_performance_score
               ) * 100)::decimal, 1) AS ml_risk_score
        FROM employee
        WHERE employment_status IN ('active', 'probation')
    ) ml ON ml.employee_id = e.employee_id
    WHERE e.employment_status IN ('active', 'probation') {extra_where}
    ORDER BY risk_score DESC
    """


# ===================================================================
# Public API
# ===================================================================


def compute_risk_all():
    """Compute rule-based risk score + ML signal for every active/probation employee."""
    return json_array_query(_risk_sql())


def compute_risk_all_paginated(page_no=1, page_size=20):
    """Paginated version of compute_risk_all.

    Returns:
        tuple: (list[dict] rows, int total_count)
    """
    offset = (max(page_no, 1) - 1) * max(page_size, 1)
    limit = max(min(page_size, 100), 1)

    total = int(query_scalar(f"""
        SELECT COUNT(*) FROM employee
        WHERE employment_status IN ('active', 'probation')
    """) or 0)

    rows = json_array_query(_risk_sql() + f" LIMIT {limit} OFFSET {offset}")
    return rows, total


def compute_risk(employee_id: int):
    """Compute risk for a single employee."""
    return json_object_query(_risk_sql(f"AND e.employee_id = {int(employee_id)}"))


def get_risk_summary():
    """Department-level attrition risk summary with trend data.

    Returns:
        dict: {
            "departments": [...],  # per-department risk summary
            "trends": [...]        # monthly avg risk per department
        }
    """
    departments = json_array_query(
        f"""
        SELECT
            d.department_id,
            d.department_name,
            COUNT(*) AS headcount,
            ROUND(AVG(sub.risk_score)::decimal, 4) AS avg_risk_score,
            ROUND(AVG(sub.risk_score)::decimal * 100, 1) AS avg_risk_pct,
            COUNT(*) FILTER (WHERE sub.risk_level = 'critical') AS critical_count,
            COUNT(*) FILTER (WHERE sub.risk_level = 'high')     AS high_count,
            COUNT(*) FILTER (WHERE sub.risk_level = 'medium')   AS medium_count,
            COUNT(*) FILTER (WHERE sub.risk_level = 'low')      AS low_count
        FROM (
            SELECT
                e.department_id,
                ({_COMPOSITE}) AS risk_score,
                {_RISK_LEVEL}  AS risk_level
            FROM employee e
            WHERE e.employment_status IN ('active', 'probation')
        ) sub
        JOIN department d ON d.department_id = sub.department_id
        GROUP BY d.department_id, d.department_name
        ORDER BY avg_risk_score DESC
        """
    )

    # Monthly trend: average risk score per department per month from attrition_history
    trends = json_array_query(
        """
        SELECT
            d.department_id,
            d.department_name,
            TO_CHAR(ah.snapshot_date, 'YYYY-MM') AS month,
            ROUND(AVG(ah.risk_score)::decimal, 4) AS avg_risk_score,
            COUNT(*) AS sample_count
        FROM attrition_history ah
        JOIN employee e ON e.employee_id = ah.employee_id
        JOIN department d ON d.department_id = e.department_id
        WHERE ah.snapshot_date >= CURRENT_TIMESTAMP - INTERVAL '6 months'
        GROUP BY d.department_id, d.department_name, TO_CHAR(ah.snapshot_date, 'YYYY-MM')
        ORDER BY d.department_name, month
        """
    )

    return {
        "departments": departments,
        "trends": trends,
    }


def get_flagged_employees(threshold: float = 0.5):
    """Return employees whose risk_score >= *threshold* (default 0.5 = high+critical).

    Filters in SQL to avoid loading all rows into Python memory.
    """
    return json_array_query(_risk_sql(f"AND ({_COMPOSITE}) >= {threshold}"))


def get_high_risk_drivers(limit: int = 10):
    """Top risk drivers — employees with the highest single-factor outlier scores.

    Returns rows where any individual component exceeds 60 % of its max weight,
    helping HR see *why* an employee scores highly. Enhanced with attendance
    and performance flags.
    """
    return json_array_query(
        f"""
        SELECT
            e.employee_id, e.full_name,
            d.department_id, d.department_name,
            ROUND(({_COMPOSITE})::decimal * 100, 1) AS risk_score_pct,
            {_RISK_LEVEL} AS risk_level,
            e.engagement_score,
            e.last_promotion_months,
            e.manager_changes,
            e.overtime_count,
            ({_ABSENT_SQ}) AS attendance_absent_count,
            ({_LATE_SQ}) AS attendance_late_count,
            ({_AVG_PERF_SQ}) AS avg_performance_score,
            -- Mark true for each factor that is a primary red flag
            (e.engagement_score < 50)   AS flag_low_engagement,
            (e.last_promotion_months >= 24) AS flag_no_promotion_2y,
            (e.manager_changes >= 2)    AS flag_frequent_mgr_change,
            (e.overtime_count >= 15)    AS flag_high_overtime,
            ({_ABSENT_SQ} >= 5) AS flag_high_absenteeism,
            ({_LATE_SQ} >= 10) AS flag_high_lateness,
            (COALESCE({_AVG_PERF_SQ}, 75) < 60) AS flag_low_performance
        FROM employee e
        JOIN department d ON d.department_id = e.department_id
        WHERE e.employment_status IN ('active', 'probation')
          AND (   e.engagement_score < 50
               OR e.last_promotion_months >= 24
               OR e.manager_changes >= 2
               OR e.overtime_count >= 15
               OR {_ABSENT_SQ} >= 5
               OR {_LATE_SQ} >= 10
               OR COALESCE({_AVG_PERF_SQ}, 75) < 60)
        ORDER BY risk_score_pct DESC
        LIMIT {int(limit)}
        """
    )


def snapshot_risk_history():
    """Persist current risk snapshot into attrition_history for trend tracking.

    Retains only the last 6 months of history to bound table growth.
    Older snapshots are automatically purged after each new snapshot.
    Includes new attendance_risk and performance_risk components.
    """
    execute(f"""
    INSERT INTO attrition_history (
        employee_id, risk_score, risk_level,
        engagement_risk, tenure_risk, promotion_risk,
        manager_change_risk, overtime_risk,
        attendance_risk, performance_risk,
        tenure, engagement_score, last_promotion_months,
        manager_changes, overtime_count
    )
    SELECT
        e.employee_id,
        ({_COMPOSITE})::decimal,
        {_RISK_LEVEL},
        (5.0 - e.engagement_score / 20.0) * 0.25,
        LEAST(e.tenure::decimal / 60.0, 1.0) * 0.15,
        (e.last_promotion_months::decimal / 36.0) * 0.20,
        (e.manager_changes::decimal / 3.0) * 0.15,
        (e.overtime_count::decimal / 30.0) * 0.05,
        ({_ABSENT_SQ}::decimal / 10.0) * 0.05,
        (5.0 - COALESCE({_AVG_PERF_SQ}, 75.0) / 20.0) * 0.10,
        e.tenure, e.engagement_score,
        e.last_promotion_months,
        e.manager_changes, e.overtime_count
    FROM employee e
    WHERE e.employment_status IN ('active', 'probation');
    """)
    # Retention: purge snapshots older than 6 months to bound table growth
    execute("""
    DELETE FROM attrition_history
    WHERE snapshot_date < CURRENT_TIMESTAMP - INTERVAL '6 months';
    """)
    return {"status": "snapshot saved", "retention": "6 months"}


def get_risk_history(employee_id: int, limit: int = 12):
    """Return historical risk snapshots for a given employee (most recent first).

    Includes new attendance_risk and performance_risk columns.
    """
    return json_array_query(
        f"""
        SELECT snapshot_date, risk_score, risk_level, risk_score_pct,
               engagement_risk, tenure_risk, promotion_risk,
               manager_change_risk, overtime_risk,
               attendance_risk, performance_risk
        FROM attrition_history
        WHERE employee_id = {int(employee_id)}
        ORDER BY snapshot_date DESC
        LIMIT {int(limit)}
        """
    )


def distribution():
    """Risk score distribution histogram (buckets of 10 percentage points)."""
    return json_array_query(
        f"""
        SELECT
            bucket,
            CASE
                WHEN bucket = 0 THEN '0-9'
                WHEN bucket = 9 THEN '90-100'
                ELSE (bucket*10)::text || '-' || (bucket*10+9)::text
            END AS range_label,
            COUNT(*) AS count
        FROM (
            SELECT LEAST(FLOOR(({_COMPOSITE}) * 10)::int, 9) AS bucket
            FROM employee e
            WHERE e.employment_status IN ('active', 'probation')
        ) b
        GROUP BY bucket
        ORDER BY bucket
        """
    )
