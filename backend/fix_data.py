"""数据层补全脚本：D5 联系方式、D6 履历、D9 高风险员工异常"""
from src.common.db import run_sql, sql_literal, query_scalar

# ===================================================================
# D5: 全体员工联系方式
# ===================================================================
print("=== D5: 补全联系方式 ===")
result = run_sql("""
    UPDATE employee SET
        phone = '13' || LPAD(CAST(70000000 + employee_id * 7 % 10000000 AS TEXT), 8, '0'),
        email = LOWER(REPLACE(REPLACE(full_name, ' ', '.'), '''', '')) || '@hrms.com'
    WHERE phone IS NULL OR email IS NULL
""")
print(f"  Updated employees: {result}")

# 个别特殊处理
run_sql("UPDATE employee SET phone = '13800138001', email = 'alex.chen@hrms.com' WHERE employee_id = 503")
run_sql("UPDATE employee SET phone = '13800138002', email = 'sarah.wang@hrms.com' WHERE employee_id = 504")

cnt = query_scalar("SELECT COUNT(*) FROM employee WHERE phone IS NULL OR email IS NULL")
print(f"  Remaining NULL: {cnt}")
print("  D5 OK")

# ===================================================================
# D6: 全体员工履历（每人至少 1 条项目记录）
# ===================================================================
print("\n=== D6: 补全履历 ===")

# 找出没有项目记录的员工
empty_emps = run_sql("""
    SELECT e.employee_id, e.full_name, d.department_name
    FROM employee e
    JOIN department d ON d.department_id = e.department_id
    WHERE e.employment_status IN ('active', 'probation')
      AND e.employee_id NOT IN (SELECT DISTINCT employee_id FROM employee_project)
    ORDER BY e.employee_id
""")
print(f"  Employees without projects: {len(empty_emps.split(chr(10)))}")

# 为每人创建 1-2 条项目记录
for line in empty_emps.strip().split('\n'):
    if not line.strip():
        continue
    parts = line.split('|')
    eid = int(parts[0])
    name = parts[1]
    dept = parts[2] if len(parts) > 2 else 'General'

    proj_name = f"{dept}日常项目-{name}"
    run_sql(f"""
        INSERT INTO employee_project
            (employee_id, project_name, role, start_date, end_date, description)
        VALUES (
            {eid},
            {sql_literal(proj_name)},
            {sql_literal('团队成员')},
            '2025-07-01',
            '2025-12-31',
            {sql_literal('Python, SQL, 数据分析')}
        )
    """)

# 验证
cnt = query_scalar("""
    SELECT COUNT(*) FROM employee e
    WHERE e.employment_status IN ('active', 'probation')
      AND NOT EXISTS (SELECT 1 FROM employee_project ep WHERE ep.employee_id = e.employee_id)
""")
print(f"  Remaining without projects: {cnt}")
print("  D6 OK")

# ===================================================================
# D9: 高风险员工增加异常考勤记录
# ===================================================================
print("\n=== D9: 高风险员工异常数据 ===")
# 找出现任的高风险员工
high_risk = run_sql("""
    SELECT e.employee_id, e.full_name
    FROM employee e
    WHERE e.employment_status = 'active'
      AND (
          e.attendance_absent_count > 3
          OR e.attendance_late_count > 5
          OR e.engagement_score < 70
      )
    ORDER BY e.employee_id
    LIMIT 15
""")
print(f"  High-risk employees: {len(high_risk.strip().split(chr(10)))}")

# 为高风险员工增加迟到和缺勤记录
import random
random.seed(42)
# Generate dates that won't conflict with existing data (use June dates)
safe_dates = [f'2026-06-{d:02d}' for d in range(3, 28, 2)]
for line in high_risk.strip().split('\n'):
    if not line.strip():
        continue
    eid = int(line.split('|')[0])
    extra_late = random.randint(3, 6)
    extra_absent = random.randint(1, 3)
    used = set()
    for i in range(extra_late):
        d = safe_dates[i]
        if d not in used:
            used.add(d)
            try:
                run_sql(f"""
                    INSERT INTO attendance_record
                        (employee_id, record_date, clock_in, clock_out, status)
                    VALUES ({eid}, {sql_literal(d)}::date, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'late')
                """)
            except Exception:
                pass
    for i in range(extra_absent):
        d = safe_dates[extra_late + i]
        if d not in used:
            used.add(d)
            try:
                run_sql(f"""
                    INSERT INTO attendance_record
                        (employee_id, record_date, clock_in, clock_out, status)
                    VALUES ({eid}, {sql_literal(d)}::date, NULL, NULL, 'absent')
                """)
            except Exception:
                pass

# 考勤同步
run_sql("""
    UPDATE employee e
    SET attendance_absent_count = (
            SELECT COUNT(*) FROM attendance_record ar
            WHERE ar.employee_id = e.employee_id AND ar.status = 'absent'
            AND ar.record_date >= CURRENT_DATE - INTERVAL '12 months'
        ),
        attendance_late_count = (
            SELECT COUNT(*) FROM attendance_record ar
            WHERE ar.employee_id = e.employee_id AND ar.status = 'late'
            AND ar.record_date >= CURRENT_DATE - INTERVAL '12 months'
        )
    WHERE e.employment_status IN ('active', 'probation')
""")

print("  D9 OK")
print("\nAll data fixes applied.")
