"""Post-migration data fix: adds attendance, perf reviews, and projects if missing."""
from src.common.db import run_sql, sql_literal, json_array_query
import random
random.seed(42)

def fix():
    # Check if data already exists
    att = int(run_sql("SELECT COUNT(*) FROM attendance_record") or "0")
    perf = int(run_sql("SELECT COUNT(*) FROM performance_review") or "0")
    proj = int(run_sql("SELECT COUNT(*) FROM employee_project") or "0")

    if att > 100 and perf > 50 and proj > 20:
        return {"status": "ok", "detail": "data already complete"}

    # Get employees
    emps = json_array_query("""
        SELECT employee_id FROM employee
        WHERE employment_status IN ('active','probation') AND employee_id <= 554
        ORDER BY employee_id
    """)
    emp_ids = [e["employee_id"] for e in emps]

    # Add attendance records (2 per week for each employee)
    if att < 100:
        from datetime import date, timedelta
        start = date(2025, 6, 1)
        count = 0
        for eid in emp_ids:
            d = start
            week = 0
            while d <= date(2026, 5, 31) and week < 53:
                try:
                    status = random.choices(
                        ['present', 'late', 'absent', 'half-day'],
                        weights=[70, 15, 10, 5]
                    )[0]
                    run_sql(f"""
                        INSERT INTO attendance_record (employee_id, work_date, clock_in, clock_out, status)
                        VALUES ({eid}, {sql_literal(d.isoformat())}::date,
                                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, {sql_literal(status)})
                    """)
                    count += 1
                except:
                    pass
                d += timedelta(days=7)
                week += 1
        print(f"  Added {count} attendance records")

    # Add performance reviews
    if perf < 50:
        count = 0
        for eid in emp_ids:
            if eid == 504:
                continue  # skip Sarah Wang as reviewer
            for period in ['2025-Q4', '2026-Q1']:
                try:
                    score = round(random.uniform(55, 92), 1)
                    rating = max(1, min(5, round((score - 50) / 10)))
                    run_sql(f"""
                        INSERT INTO performance_review (employee_id, reviewer_id, review_period, rating, score, status)
                        VALUES ({eid}, 504, {sql_literal(period)}, {rating}, {score}, 'submitted')
                    """)
                    count += 1
                except:
                    pass
        print(f"  Added {count} performance reviews")

    # Add projects
    if proj < 20:
        count = 0
        for eid in emp_ids[:30]:
            try:
                run_sql(f"""
                    INSERT INTO employee_project (employee_id, project_name, role, start_date, end_date, description)
                    VALUES ({eid}, {sql_literal(f'团队项目-{eid}')}, '成员', '2025-07-01', '2025-12-31', {sql_literal('Python, SQL')})
                """)
                count += 1
            except:
                pass
        print(f"  Added {count} projects")

    # Verify
    att2 = run_sql("SELECT COUNT(*) FROM attendance_record").strip()
    perf2 = run_sql("SELECT COUNT(*) FROM performance_review").strip()
    proj2 = run_sql("SELECT COUNT(*) FROM employee_project").strip()
    print(f"  Final: {att2} attendance, {perf2} perf reviews, {proj2} projects")

if __name__ == "__main__":
    fix()
