"""考勤服务：签到/签退、考勤记录 CRUD、汇总统计。

数据表：attendance_record（V8 创建，V9 增强）
  - V9 新增字段：work_date, late_minutes, early_leave_minutes,
    overtime_approved, approver_employee_id, approved_at, remarks

权限范围：
  - attendance.view（查看）+ attendance.manage（管理）
  - 管理员/HR：所有部门
  - 经理：本部门
  - 员工：仅自己
"""

from datetime import date, datetime

from src.common.db import execute, json_array_query, json_object_query, query_scalar, sql_literal
from src.common.permission import _require_permission_scope
from src.services.audit_service import write_audit


def _parse_ts(val):
    """Parse ISO timestamp string to datetime, or return as-is if already datetime."""
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        return datetime.fromisoformat(val.replace('Z', '+00:00').split('+')[0])
    return val


# ===================================================================
# 签到 / 签退
# ===================================================================

def clock_in(employee_id, clock_type="normal", source="manual"):
    """签到/签退（切换逻辑）。

    如果今天已有未签退的记录，则自动签退并计算时长和状态。
    否则创建新的签到记录。

    参数：
        employee_id: 员工 ID
        clock_type:  normal（正常）| overtime（加班）| remote（远程）
        source:      manual（手动）| system（系统）

    返回：
        {"action": "clock_in", ...} 或 {"action": "clock_out", ...}
    """
    today = date.today().isoformat()
    now = datetime.now()

    # 查找今天未签退的记录
    existing = json_object_query(f"""
        SELECT attendance_id, clock_in, clock_out
        FROM attendance_record
        WHERE employee_id = {int(employee_id)}
          AND work_date = {sql_literal(today)}::date
          AND clock_out IS NULL
        ORDER BY clock_in DESC
        LIMIT 1
    """)

    if existing:
        # === 签退 ===
        att_id = existing["attendance_id"]
        clock_in_time = _parse_ts(existing["clock_in"])
        duration_hours = (now - clock_in_time).total_seconds() / 3600

        # 根据时长判定状态
        if clock_type == "overtime":
            status = "overtime"
        elif duration_hours < 4:
            status = "half-day"
        else:
            status = "present"

        execute(f"""
            UPDATE attendance_record
            SET clock_out = {sql_literal(now)},
                status = {sql_literal(status)},
                clock_type = {sql_literal(clock_type)},
                source = {sql_literal(source)}
            WHERE attendance_id = {att_id}
        """)
        return {
            "action": "clock_out",
            "attendance_id": att_id,
            "status": status,
            "duration_hours": round(duration_hours, 1),
        }

    # 检查今天是否已完成签到+签退（已完整打卡）
    completed = json_object_query(f"""
        SELECT attendance_id, clock_in, clock_out
        FROM attendance_record
        WHERE employee_id = {int(employee_id)}
          AND work_date = {sql_literal(today)}::date
          AND clock_in IS NOT NULL
          AND clock_out IS NOT NULL
        ORDER BY clock_in DESC
        LIMIT 1
    """)
    if completed:
        raise ValueError("今日打卡已完成，请勿重复打卡")

    # === 签到 ===
    execute(f"""
        INSERT INTO attendance_record
            (employee_id, clock_in, work_date, clock_type, status, source)
        VALUES (
            {int(employee_id)},
            {sql_literal(now)},
            {sql_literal(today)}::date,
            {sql_literal(clock_type)},
            'present',
            {sql_literal(source)}
        )
    """)
    return {"action": "clock_in", "clock_in": now.isoformat(), "clock_type": clock_type}


# ===================================================================
# 考勤记录 CRUD
# ===================================================================

def create_attendance_record(payload, actor):
    """创建考勤记录（管理员补录用）。

    参数：
        payload: {
            "employee_id": int,
            "clock_in": "2026-05-20 09:00:00",
            "clock_out": "2026-05-20 18:00:00",  # 可选
            "clock_type": "normal",
            "status": "present",
            "late_minutes": 0,
            "early_leave_minutes": 0,
            "remarks": "..."
        }
    """
    employee_id = int(payload["employee_id"])
    clock_in_time = payload["clock_in"]
    clock_out_time = payload.get("clock_out")
    work_date = payload.get("work_date", clock_in_time[:10])
    clock_type = payload.get("clock_type", "normal")
    status = payload.get("status", "present")
    late_minutes = int(payload.get("late_minutes", 0))
    early_leave_minutes = int(payload.get("early_leave_minutes", 0))
    remarks = payload.get("remarks")

    if late_minutes < 0 or early_leave_minutes < 0:
        raise ValueError("late_minutes and early_leave_minutes must be >= 0")

    sql = f"""
        INSERT INTO attendance_record
            (employee_id, clock_in, clock_out, work_date, clock_type,
             status, late_minutes, early_leave_minutes, source, remarks)
        VALUES (
            {employee_id},
            {sql_literal(clock_in_time)}::timestamp,
            {sql_literal(clock_out_time)}::timestamp,
            {sql_literal(work_date)}::date,
            {sql_literal(clock_type)},
            {sql_literal(status)},
            {late_minutes}, {early_leave_minutes},
            'manual',
            {sql_literal(remarks)}
        )
        RETURNING attendance_id
    """
    att_id = int(query_scalar(sql))
    write_audit(actor, "create", "attendance_record", str(att_id),
                f"created attendance for employee {employee_id} on {work_date}")
    return get_attendance_record(att_id)


def get_attendance_record(attendance_id):
    """获取单条考勤记录详情。"""
    return json_object_query(f"""
        SELECT ar.*, e.employee_no, e.full_name,
               d.department_name,
               ROUND(EXTRACT(EPOCH FROM (COALESCE(ar.clock_out, CURRENT_TIMESTAMP)
                         - ar.clock_in)) / 3600, 1) AS duration_hours
        FROM attendance_record ar
        JOIN employee e ON e.employee_id = ar.employee_id
        JOIN department d ON d.department_id = e.department_id
        WHERE ar.attendance_id = {int(attendance_id)}
    """)


def update_attendance_record(attendance_id, payload, actor):
    """更新考勤记录（管理员调整用）。

    参数：
        payload 中可包含：clock_in, clock_out, clock_type, status,
                          late_minutes, early_leave_minutes, remarks,
                          overtime_approved, approver_employee_id
    """
    fields = []
    for field in ("clock_in", "clock_out", "clock_type", "status",
                  "late_minutes", "early_leave_minutes", "remarks",
                  "overtime_approved", "approver_employee_id"):
        if field in payload:
            val = payload[field]
            if field in ("late_minutes", "early_leave_minutes"):
                val = int(val)
                if val < 0:
                    raise ValueError(f"{field} must be >= 0")
                fields.append(f"{field} = {val}")
            elif field == "overtime_approved":
                fields.append(f"{field} = {str(bool(val)).upper()}")
                fields.append("approved_at = CURRENT_TIMESTAMP")
            elif field == "approver_employee_id":
                fields.append(f"{field} = {int(val)}")
            else:
                fields.append(f"{field} = {sql_literal(val)}")

    if fields:
        execute(f"""
            UPDATE attendance_record
            SET {', '.join(fields)}
            WHERE attendance_id = {int(attendance_id)}
        """)
        write_audit(actor, "update", "attendance_record", str(attendance_id),
                    "updated attendance record")

    return get_attendance_record(attendance_id)


def delete_attendance_record(attendance_id, actor):
    """删除考勤记录。"""
    execute(f"DELETE FROM attendance_record WHERE attendance_id = {int(attendance_id)}")
    write_audit(actor, "delete", "attendance_record", str(attendance_id),
                "deleted attendance record")
    return {"status": "deleted"}


# ===================================================================
# 考勤查询与列表
# ===================================================================

def get_my_attendance(employee_id, limit=30):
    """获取当前用户的考勤记录（最近优先）。"""
    return json_array_query(f"""
        SELECT attendance_id, clock_in, clock_out, work_date,
               clock_type, status, source, late_minutes,
               early_leave_minutes, remarks, created_at,
               ROUND(EXTRACT(EPOCH FROM (COALESCE(clock_out, CURRENT_TIMESTAMP)
                         - clock_in)) / 3600, 1) AS duration_hours
        FROM attendance_record
        WHERE employee_id = {int(employee_id)}
        ORDER BY clock_in DESC
        LIMIT {int(limit)}
    """)


def list_attendance_records(page_no=1, page_size=20,
                            employee_id=None, department_id=None,
                            date_from=None, date_to=None,
                            manager_employee_id=None,
                            status=None, clock_type=None,
                            subtree_ids=None):
    """分页列出考勤记录（含筛选）。

    参数：
        page_no:             页码
        page_size:           每页条数
        employee_id:         员工 ID 筛选
        department_id:       部门 ID 筛选
        date_from:           起始日期
        date_to:             截止日期
        manager_employee_id: 上级 ID（团队视图）
        status:              考勤状态筛选
        clock_type:          考勤类型筛选
        subtree_ids:         组织树节点 ID 列表（用于权限过滤）
    """
    where_parts = ["1=1"]

    if employee_id:
        where_parts.append(f"ar.employee_id = {int(employee_id)}")
    if department_id:
        where_parts.append(f"e.department_id = {int(department_id)}")
    if date_from:
        where_parts.append(f"ar.record_date >= {sql_literal(date_from)}::date")
    if date_to:
        where_parts.append(f"ar.record_date <= {sql_literal(date_to)}::date")
    if manager_employee_id:
        where_parts.append(f"e.manager_employee_id = {int(manager_employee_id)}")
    if status:
        where_parts.append(f"ar.status = {sql_literal(status)}")
    if clock_type:
        where_parts.append(f"ar.clock_type = {sql_literal(clock_type)}")
    if subtree_ids:
        ids_str = ",".join(str(i) for i in subtree_ids)
        where_parts.append(f"ar.employee_id IN ({ids_str})")

    where_clause = " AND ".join(where_parts)
    offset = (page_no - 1) * page_size

    count_sql = f"""
        SELECT COUNT(*)
        FROM attendance_record ar
        JOIN employee e ON e.employee_id = ar.employee_id
        WHERE {where_clause}
    """
    list_sql = f"""
        SELECT ar.attendance_id, ar.employee_id,
               e.employee_no, e.full_name,
               d.department_name,
               ar.record_date, ar.clock_in, ar.clock_out,
               ar.status, ar.created_at
        FROM attendance_record ar
        JOIN employee e ON e.employee_id = ar.employee_id
        JOIN department d ON d.department_id = e.department_id
        WHERE {where_clause}
        ORDER BY ar.record_date DESC, ar.clock_in DESC
        LIMIT {page_size} OFFSET {offset}
    """

    total = int(query_scalar(count_sql) or "0")
    rows = json_array_query(list_sql)
    return rows, total


# ===================================================================
# 加班审批
# ===================================================================

def approve_overtime(attendance_id, approver_employee_id, actor):
    """审批加班记录。

    将 overtime_approved 设为 true，记录审批人和审批时间。
    """
    execute(f"""
        UPDATE attendance_record
        SET overtime_approved = TRUE,
            approver_employee_id = {int(approver_employee_id)},
            approved_at = CURRENT_TIMESTAMP
        WHERE attendance_id = {int(attendance_id)}
    """)
    write_audit(actor, "approve", "attendance_record", str(attendance_id),
                f"overtime approved by {approver_employee_id}")
    return get_attendance_record(attendance_id)


# ===================================================================
# 汇总统计
# ===================================================================

def attendance_summary(department_id=None, date_from=None, date_to=None):
    """部门考勤汇总：出勤率、迟到/缺勤统计。

    返回每个部门的聚合数据，用于分析仪表盘。
    """
    where_emp = ""
    if department_id:
        where_emp = f"AND e.department_id = {int(department_id)}"

    date_filter = ""
    if date_from and date_to:
        date_filter = (
            f"AND ar.record_date BETWEEN {sql_literal(date_from)}::date "
            f"AND {sql_literal(date_to)}::date"
        )
    elif date_from:
        date_filter = f"AND ar.record_date >= {sql_literal(date_from)}::date"
    elif date_to:
        date_filter = f"AND ar.record_date <= {sql_literal(date_to)}::date"

    return json_array_query(f"""
        SELECT d.department_id, d.department_name,
               COUNT(DISTINCT e.employee_id) FILTER (
                   WHERE e.employment_status IN ('active', 'probation')
               ) AS total_headcount,
               COUNT(DISTINCT ar.employee_id) AS active_employees,
               COUNT(*) AS total_records,
               COUNT(*) FILTER (WHERE ar.status = 'late') AS late_count,
               COUNT(*) FILTER (WHERE ar.status = 'absent') AS absent_count,
               COUNT(*) FILTER (WHERE ar.status = 'present') AS present_count,
               COUNT(*) FILTER (WHERE ar.status = 'half-day') AS half_day_count,
               COUNT(*) FILTER (WHERE ar.status = 'overtime') AS overtime_count,
               ROUND(
                   COUNT(*) FILTER (WHERE ar.status IN ('present', 'half-day'))::decimal
                   / NULLIF(COUNT(*), 0) * 100, 1
               ) AS attendance_rate
        FROM department d
        LEFT JOIN employee e ON e.department_id = d.department_id {where_emp}
        LEFT JOIN attendance_record ar ON ar.employee_id = e.employee_id {date_filter}
        GROUP BY d.department_id, d.department_name
        ORDER BY d.department_name
    """)


def update_absent_late_counts():
    """同步员工表的缺勤/迟到次数（基于过去 12 个月数据）。

    定时任务（每日 cron）或管理员手动调用。
    """
    execute("""
        UPDATE employee e
        SET attendance_absent_count = (
                SELECT COUNT(*)
                FROM attendance_record ar
                WHERE ar.employee_id = e.employee_id
                  AND ar.status = 'absent'
                  AND ar.record_date >= CURRENT_DATE - INTERVAL '12 months'
            ),
            attendance_late_count = (
                SELECT COUNT(*)
                FROM attendance_record ar
                WHERE ar.employee_id = e.employee_id
                  AND ar.status = 'late'
                  AND ar.record_date >= CURRENT_DATE - INTERVAL '12 months'
            )
        WHERE e.employment_status IN ('active', 'probation')
    """)
    return {"status": "synced",
            "detail": "attendance_absent_count and attendance_late_count updated"}


def monthly_attendance_report(year, month, department_id=None):
    """月度考勤报表：每个员工的出勤明细汇总。

    参数：
        year:          年份（如 2026）
        month:         月份（1-12）
        department_id: 部门筛选（可选）

    返回：
        每个员工的月度统计：出勤天数、迟到次数、缺勤次数等
    """
    month_start = f"{year}-{month:02d}-01"
    # 下月第一天
    if month == 12:
        month_end = f"{year + 1}-01-01"
    else:
        month_end = f"{year}-{month + 1:02d}-01"

    where_dept = ""
    if department_id:
        where_dept = f"AND e.department_id = {int(department_id)}"

    return json_array_query(f"""
        SELECT e.employee_id, e.employee_no, e.full_name,
               d.department_name,
               COUNT(ar.attendance_id) AS total_days,
               COUNT(*) FILTER (WHERE ar.status = 'present') AS present_days,
               COUNT(*) FILTER (WHERE ar.status = 'late') AS late_days,
               COUNT(*) FILTER (WHERE ar.status = 'absent') AS absent_days,
               COUNT(*) FILTER (WHERE ar.status = 'half-day') AS half_days,
               COUNT(*) FILTER (WHERE ar.status = 'overtime') AS overtime_days,
               COALESCE(SUM(ar.late_minutes), 0) AS total_late_minutes,
               COALESCE(SUM(ar.early_leave_minutes), 0) AS total_early_leave_minutes,
               ROUND(
                   COUNT(*) FILTER (WHERE ar.status IN ('present', 'half-day'))::decimal
                   / NULLIF(COUNT(ar.attendance_id), 0) * 100, 1
               ) AS attendance_rate
        FROM employee e
        JOIN department d ON d.department_id = e.department_id
        LEFT JOIN attendance_record ar
            ON ar.employee_id = e.employee_id
            AND ar.record_date >= {sql_literal(month_start)}::date
            AND ar.record_date < {sql_literal(month_end)}::date
        WHERE e.employment_status IN ('active', 'probation') {where_dept}
        GROUP BY e.employee_id, e.employee_no, e.full_name, d.department_name
        ORDER BY d.department_name, e.full_name
    """)
