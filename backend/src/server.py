import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from src.common.db import DatabaseError
from src.common.http import error, ok, page, to_json_bytes
from src.config import APP_HOST, APP_PORT
from src.services import (
    analytics_service,
    attendance_service,
    approval_service,
    attrition_service,
    auth_service,
    directory_service,
    employee_service,
    employee_job_history_service,
    employee_profile_service,
    job_service,
    leave_service,
    leave_type_service,
    location_service,
    org_people_service,
    org_service,
    performance_service,
    predict_service,
    report_service,
    skill_service,
    user_service,
)


def _parse_page(query):
    page_no = int(query.get("page", ["1"])[0] or "1")
    page_size = int(query.get("page_size", ["10"])[0] or "10")
    return max(page_no, 1), max(min(page_size, 100), 1)


def _get_employee_id(username):
    """从 sys_user/employee 表查询 username 对应的 employee_id。"""
    from src.common.db import query_scalar, sql_literal
    # 数字字符串 → 直接作为 employee_id
    try:
        return int(username)
    except (ValueError, TypeError):
        pass
    # sys_user.username → JOIN employee.full_name
    return query_scalar(f"""
        SELECT e.employee_id
        FROM sys_user u
        JOIN employee e ON e.full_name = u.full_name
        WHERE u.username = {sql_literal(username)}
    """)


class ApiHandler(BaseHTTPRequestHandler):
    server_version = "HRMSBackend/0.1"

    def do_OPTIONS(self):
        self._send(200, ok())

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def do_PUT(self):
        self._dispatch("PUT")

    def do_DELETE(self):
        self._dispatch("DELETE")

    def log_message(self, format, *args):
        return

    def _dispatch(self, method):
        try:
            parsed = urlparse(self.path)
            path = parsed.path.rstrip("/") or "/"
            query = parse_qs(parsed.query)
            body = self._read_json()

            if path == "/api/auth/login" and method == "POST":
                return self._handle_login(body)
            if path == "/api/auth/profile" and method == "GET":
                return self._handle_profile()
            if path == "/api/auth/logout" and method == "POST":
                return self._handle_logout()

            user = self._require_auth()
            if not user:
                return

            if path == "/api/users" and method == "GET":
                self._require_permission(user, "user.manage")
                page_no, page_size = _parse_page(query)
                rows, total = user_service.list_users(
                    page_no,
                    page_size,
                    username=query.get("username", [None])[0],
                    status=query.get("status", [None])[0],
                )
                return self._send(200, page(rows, total, page_no, page_size))

            if path == "/api/users" and method == "POST":
                self._require_permission(user, "user.manage")
                data = user_service.create_user(body, user["username"])
                return self._send(200, ok(data))

            match = re.fullmatch(r"/api/users/(\d+)", path)
            if match and method == "PUT":
                self._require_permission(user, "user.manage")
                data = user_service.update_user(int(match.group(1)), body, user["username"])
                return self._send(200, ok(data))
            if match and method == "DELETE":
                self._require_permission(user, "user.manage")
                user_service.delete_user(int(match.group(1)), user["username"])
                return self._send(200, ok())

            if path == "/api/roles" and method == "GET":
                self._require_permission(user, "user.manage")
                return self._send(200, ok(user_service.list_roles()))

            match = re.fullmatch(r"/api/users/(\d+)/roles", path)
            if match and method == "PUT":
                self._require_permission(user, "user.manage")
                data = user_service.replace_user_roles(
                    int(match.group(1)), body.get("role_ids", []), user["username"]
                )
                return self._send(200, ok(data))

            if path == "/api/departments" and method == "GET":
                self._require_permission(user, "department.manage")
                return self._send(200, ok(directory_service.list_departments()))
            if path == "/api/departments" and method == "POST":
                self._require_permission(user, "department.manage")
                return self._send(200, ok(directory_service.create_department(body, user["username"])))

            match = re.fullmatch(r"/api/departments/(\d+)", path)
            if match and method == "PUT":
                self._require_permission(user, "department.manage")
                return self._send(
                    200,
                    ok(directory_service.update_department(int(match.group(1)), body, user["username"])),
                )
            if match and method == "DELETE":
                self._require_permission(user, "department.manage")
                directory_service.delete_department(int(match.group(1)), user["username"])
                return self._send(200, ok())

            if path == "/api/positions" and method == "GET":
                self._require_permission(user, "department.manage")
                dept_id = query.get("department_id", [None])[0]
                return self._send(200, ok(directory_service.list_positions(
                    department_id=int(dept_id) if dept_id else None
                )))
            if path == "/api/positions" and method == "POST":
                self._require_permission(user, "department.manage")
                return self._send(200, ok(directory_service.create_position(body, user["username"])))

            match = re.fullmatch(r"/api/positions/(\d+)", path)
            if match and method == "PUT":
                self._require_permission(user, "department.manage")
                return self._send(
                    200,
                    ok(directory_service.update_position(int(match.group(1)), body, user["username"])),
                )
            if match and method == "DELETE":
                self._require_permission(user, "department.manage")
                directory_service.delete_position(int(match.group(1)), user["username"])
                return self._send(200, ok())

            if path == "/api/employees" and method == "GET":
                self._require_permission(user, "employee.manage")
                page_no, page_size = _parse_page(query)
                filters = {k: v[0] for k, v in query.items()}
                # Map ?q= search param to ?keyword= for consistency with directory search
                if "q" in filters and "keyword" not in filters:
                    filters["keyword"] = filters.pop("q")
                rows, total = employee_service.list_employees(page_no, page_size, filters)
                return self._send(200, page(rows, total, page_no, page_size))
            if path == "/api/employees" and method == "POST":
                self._require_permission(user, "employee.manage")
                return self._send(200, ok(employee_service.create_employee(body, user["username"])))

            match = re.fullmatch(r"/api/employees/(\d+)", path)
            if match and method == "GET":
                self._require_permission(user, "employee.manage")
                return self._send(200, ok(employee_service.get_employee(int(match.group(1)))))
            if match and method == "PUT":
                self._require_permission(user, "employee.manage")
                return self._send(
                    200,
                    ok(employee_service.update_employee(int(match.group(1)), body, user["username"])),
                )
            if match and method == "DELETE":
                self._require_permission(user, "employee.manage")
                employee_service.delete_employee(int(match.group(1)), user["username"])
                return self._send(200, ok())

            if path == "/api/locations" and method == "GET":
                self._require_permission(user, "department.manage")
                return self._send(200, ok(location_service.list_locations()))
            if path == "/api/locations" and method == "POST":
                self._require_permission(user, "department.manage")
                return self._send(200, ok(location_service.create_location(body, user["username"])))

            match = re.fullmatch(r"/api/locations/(\d+)", path)
            if match and method == "GET":
                self._require_permission(user, "department.manage")
                return self._send(200, ok(location_service.get_location(int(match.group(1)))))
            if match and method == "PUT":
                self._require_permission(user, "department.manage")
                return self._send(
                    200,
                    ok(location_service.update_location(int(match.group(1)), body, user["username"])),
                )
            if match and method == "DELETE":
                self._require_permission(user, "department.manage")
                location_service.delete_location(int(match.group(1)), user["username"])
                return self._send(200, ok())

            if path == "/api/jobs" and method == "GET":
                self._require_permission(user, "department.manage")
                return self._send(200, ok(job_service.list_jobs()))
            if path == "/api/jobs" and method == "POST":
                self._require_permission(user, "department.manage")
                return self._send(200, ok(job_service.create_job(body, user["username"])))

            match = re.fullmatch(r"/api/jobs/(\d+)", path)
            if match and method == "GET":
                self._require_permission(user, "department.manage")
                return self._send(200, ok(job_service.get_job(int(match.group(1)))))
            if match and method == "PUT":
                self._require_permission(user, "department.manage")
                return self._send(
                    200,
                    ok(job_service.update_job(int(match.group(1)), body, user["username"])),
                )
            if match and method == "DELETE":
                self._require_permission(user, "department.manage")
                job_service.delete_job(int(match.group(1)), user["username"])
                return self._send(200, ok())

            if path == "/api/leave-types" and method == "GET":
                self._require_permission(user, "leave.manage")
                return self._send(200, ok(leave_type_service.list_leave_types()))
            if path == "/api/leave-types" and method == "POST":
                self._require_permission(user, "leave.manage")
                return self._send(200, ok(leave_type_service.create_leave_type(body, user["username"])))

            match = re.fullmatch(r"/api/leave-types/(\d+)", path)
            if match and method == "GET":
                self._require_permission(user, "leave.manage")
                return self._send(200, ok(leave_type_service.get_leave_type(int(match.group(1)))))
            if match and method == "PUT":
                self._require_permission(user, "leave.manage")
                return self._send(
                    200,
                    ok(leave_type_service.update_leave_type(int(match.group(1)), body, user["username"])),
                )
            if match and method == "DELETE":
                self._require_permission(user, "leave.manage")
                leave_type_service.delete_leave_type(int(match.group(1)), user["username"])
                return self._send(200, ok())

            match = re.fullmatch(r"/api/employees/(\d+)/profile", path)
            if match and method == "GET":
                self._require_permission(user, "employee.manage")
                return self._send(200, ok(employee_profile_service.get_employee_profile(int(match.group(1)))))
            if match and method == "PUT":
                self._require_permission(user, "employee.manage")
                return self._send(
                    200,
                    ok(employee_profile_service.update_employee_profile(int(match.group(1)), body, user["username"])),
                )

            match = re.fullmatch(r"/api/employees/(\d+)/job-history", path)
            if match and method == "GET":
                self._require_permission(user, "employee.manage")
                return self._send(
                    200,
                    ok(employee_job_history_service.list_employee_job_history(int(match.group(1)))),
                )
            if match and method == "POST":
                self._require_permission(user, "employee.manage")
                return self._send(
                    200,
                    ok(employee_job_history_service.create_employee_job_history(
                        int(match.group(1)), body, user["username"]
                    )),
                )

            if path == "/api/leaves" and method == "GET":
                self._require_permission(user, "leave.manage")
                page_no, page_size = _parse_page(query)
                filters = {k: v[0] for k, v in query.items()}
                rows, total = leave_service.list_leaves(page_no, page_size, filters)
                return self._send(200, page(rows, total, page_no, page_size))
            if path == "/api/leaves" and method == "POST":
                self._require_permission(user, "leave.manage")
                return self._send(200, ok(leave_service.create_leave(body, user["username"])))

            match = re.fullmatch(r"/api/leaves/(\d+)/(approve|reject)", path)
            if match and method == "PUT":
                self._require_permission(user, "leave.manage")
                next_status = "approved" if match.group(2) == "approve" else "rejected"
                return self._send(
                    200,
                    ok(leave_service.update_leave_status(
                        int(match.group(1)), next_status, user["username"],
                        comment=body.get("approval_comment")
                    )),
                )

            if path == "/api/audits" and method == "GET":
                self._require_permission(user, "audit.view")
                page_no, page_size = _parse_page(query)
                filters = {k: v[0] for k, v in query.items()}
                rows, total = report_service.list_audits(page_no, page_size, filters)
                return self._send(200, page(rows, total, page_no, page_size))

            if path == "/api/backups" and method == "GET":
                return self._send(200, ok(report_service.list_backups()))
            if path == "/api/backups" and method == "POST":
                return self._send(
                    200,
                    ok({"status": "reserved", "message": "backup workflow reserved for next phase"}),
                )
            if path == "/api/restores" and method == "POST":
                return self._send(
                    200,
                    ok({"status": "reserved", "message": "restore workflow reserved for next phase"}),
                )

            # === Profile self-service ===
            if path == "/api/profile/self" and method == "GET":
                return self._send(200, ok(auth_service.get_employee_profile(user)))

            if path == "/api/profile/contact" and method == "PUT":
                eid = int(body.get("employee_id", user.get("employee_id", 0)))
                upd = {}
                if "phone" in body: upd["phone"] = body["phone"]
                if "email" in body: upd["email"] = body["email"]
                if "birth_date" in body: upd["birth_date"] = body["birth_date"]
                if upd:
                    employee_service.update_employee(eid, upd, user["username"])
                return self._send(200, ok({"status": "updated"}))

            # === Directory ===
            if path == "/api/directory/tree" and method == "GET":
                return self._send(200, ok(directory_service.directory_tree()))

            if path == "/api/directory/search" and method == "GET":
                keyword = query.get("q", [""])[0]
                return self._send(200, ok(directory_service.directory_search(keyword)))

            if path == "/api/directory/filters" and method == "GET":
                return self._send(200, ok(directory_service.directory_filters()))

            # === New discover endpoints ===
            if path == "/api/skills" and method == "GET":
                return self._send(200, ok(skill_service.list_skills(query.get("category_id",[None])[0])))
            if path == "/api/skills" and method == "POST":
                self._require_permission(user, "skill.manage")
                return self._send(200, ok(skill_service.create_skill(body, user["username"])))

            match = re.fullmatch(r"/api/skills/(\d+)", path)
            if match and method == "PUT":
                self._require_permission(user, "skill.manage")
                return self._send(200, ok(skill_service.update_skill(int(match.group(1)), body, user["username"])))
            if match and method == "DELETE":
                self._require_permission(user, "skill.manage")
                return self._send(200, ok(skill_service.delete_skill(int(match.group(1)), user["username"])))

            if path == "/api/skills/categories" and method == "GET":
                return self._send(200, ok(skill_service.list_skill_categories()))
            if path == "/api/skills/categories" and method == "POST":
                self._require_permission(user, "skill.manage")
                return self._send(200, ok(skill_service.create_skill_category(body, user["username"])))

            match = re.fullmatch(r"/api/skills/categories/(\d+)", path)
            if match and method == "PUT":
                self._require_permission(user, "skill.manage")
                return self._send(200, ok(skill_service.update_skill_category(int(match.group(1)), body, user["username"])))
            if match and method == "DELETE":
                self._require_permission(user, "skill.manage")
                return self._send(200, ok(skill_service.delete_skill_category(int(match.group(1)), user["username"])))

            if path == "/api/skills/required" and method == "GET":
                pid = query.get("position_id", [None])[0]
                if pid: return self._send(200, ok(skill_service.get_skills_by_position(int(pid))))
                return self._send(200, ok([]))
            if path == "/api/skills/recommend" and method == "GET":
                sid = query.get("skill_id",[None])[0]
                if sid: return self._send(200, ok(skill_service.skill_recommendations(int(sid))))
                return self._send(200, ok([]))
            if path == "/api/employees/skills" and method == "GET":
                eid = query.get("employee_id",[None])[0]
                if eid: return self._send(200, ok(skill_service.get_employee_skills(int(eid))))
                return self._send(200, ok([]))
            if path == "/api/employees/skills" and method == "POST":
                # 任何用户可通过审批流提交技能变更申请
                applicant_id = approval_service.resolve_employee_id(user["username"])
                if not applicant_id:
                    return self._send(400, error("无法解析当前用户的员工 ID"))
                action = body.get("action", "add")
                action_type_map = {"add": "SKILL_ADD", "delete": "SKILL_REMOVE", "update": "SKILL_UPDATE"}
                action_type = action_type_map.get(action, "SKILL_ADD")
                result = approval_service.submit_approval(
                    employee_id=applicant_id,
                    action_type=action_type,
                    target_id=int(body["employee_id"]),
                    payload={
                        "action": action,
                        "employee_id": body["employee_id"],
                        "skill_id": body["skill_id"],
                        "proficiency_level": body.get("proficiency_level", 1),
                    },
                    actor=user["username"],
                )
                return self._send(200, ok(result))
            if path == "/api/employees/skills" and method == "DELETE":
                eid = int(query.get("employee_id", ["0"])[0])
                sid = int(query.get("skill_id", ["0"])[0])
                applicant_id = approval_service.resolve_employee_id(user["username"])
                if not applicant_id:
                    return self._send(400, error("无法解析当前用户的员工 ID"))
                result = approval_service.submit_approval(
                    employee_id=applicant_id,
                    action_type="SKILL_REMOVE",
                    target_id=eid,
                    payload={
                        "action": "delete",
                        "employee_id": eid,
                        "skill_id": sid,
                    },
                    actor=user["username"],
                )
                return self._send(200, ok(result))
            if path == "/api/match/employee" and method == "GET":
                eid = query.get("employee_id",[None])[0]
                if eid: return self._send(200, ok(skill_service.match_employee_to_positions(int(eid))))
                return self._send(200, ok([]))
            if path == "/api/skills/gap" and method == "GET":
                return self._send(200, ok(skill_service.gap_analysis()))
            if path == "/api/skills/heatmap" and method == "GET":
                return self._send(200, ok(skill_service.heatmap()))
            if path == "/api/skills/analytics/overview" and method == "GET":
                return self._send(200, ok(skill_service.org_skills_overview()))
            if path == "/api/skills/analytics/department-comparison" and method == "GET":
                return self._send(200, ok(skill_service.department_comparison()))

            match = re.fullmatch(r"/api/skills/infer/(\d+)", path)
            if match and method == "POST":
                return self._send(200, ok(skill_service.infer_skills_from_history(int(match.group(1)), user["username"])))

            match = re.fullmatch(r"/api/employees/(\d+)/projects", path)
            if match and method == "GET":
                self._require_permission(user, "employee.manage")
                return self._send(200, ok(skill_service.list_employee_projects(int(match.group(1)))))
            if match and method == "POST":
                self._require_permission(user, "employee.manage")
                return self._send(200, ok(skill_service.create_employee_project(int(match.group(1)), body, user["username"])))

            match = re.fullmatch(r"/api/employees/(\d+)/projects/(\d+)", path)
            if match and method == "PUT":
                self._require_permission(user, "employee.manage")
                return self._send(200, ok(skill_service.update_employee_project(int(match.group(1)), int(match.group(2)), body, user["username"])))
            if match and method == "DELETE":
                self._require_permission(user, "employee.manage")
                skill_service.delete_employee_project(int(match.group(1)), int(match.group(2)), user["username"])
                return self._send(200, ok())
            if path == "/api/predict/attrition" and method == "GET":
                return self._send(200, ok(predict_service.predict_attrition()))
            if path == "/api/predict/attrition/train" and method == "POST":
                return self._send(200, ok(predict_service.train_attrition_model()))
            if path == "/api/predict/model" and method == "GET":
                return self._send(200, ok(predict_service.get_model_info()))
            if path == "/api/org/tree" and method == "GET":
                return self._send(200, ok(org_service.org_tree()))
            if path == "/api/org/network" and method == "GET":
                eid = query.get("employee_id",[None])[0]
                if eid: return self._send(200, ok(org_service.employee_network(int(eid))))
                return self._send(200, ok([]))
            if path == "/api/org/critical" and method == "GET":
                return self._send(200, ok(org_service.critical_persons()))
            if path == "/api/org/departments" and method == "GET":
                return self._send(200, ok(org_service.department_stats()))
            if path == "/api/org/hierarchy" and method == "GET":
                self._require_permission(user, "employee.manage")
                return self._send(200, ok(org_service.org_hierarchy()))
            match = re.fullmatch(r"/api/org/employee/(\d+)", path)
            if match and method == "GET":
                self._require_permission(user, "employee.manage")
                bundle = org_service.get_employee_bundle(int(match.group(1)))
                if bundle is None:
                    self._send(*error(4001, "employee not found", 404))
                    return
                return self._send(200, ok(bundle))

            # === Attrition risk (hybrid engine) ===
            if path == "/api/attrition/risk" and method == "GET":
                self._require_permission(user, "analytics.view")
                eid = query.get("employee_id", [None])[0]
                if eid:
                    return self._send(200, ok(attrition_service.compute_risk(int(eid))))
                # If no page/page_size params, return all data (backwards compat)
                if "page" not in query and "page_size" not in query:
                    return self._send(200, ok(attrition_service.compute_risk_all()))
                page_no, page_size = _parse_page(query)
                rows, total = attrition_service.compute_risk_all_paginated(page_no, page_size)
                return self._send(200, page(rows, total, page_no, page_size))
            if path == "/api/attrition/summary" and method == "GET":
                self._require_permission(user, "analytics.view")
                return self._send(200, ok(attrition_service.get_risk_summary()))
            if path == "/api/attrition/flags" and method == "GET":
                self._require_permission(user, "analytics.view")
                threshold = float(query.get("threshold", ["0.5"])[0])
                return self._send(200, ok(attrition_service.get_flagged_employees(threshold)))
            if path == "/api/attrition/drivers" and method == "GET":
                self._require_permission(user, "analytics.view")
                return self._send(200, ok(attrition_service.get_high_risk_drivers()))
            if path == "/api/attrition/distribution" and method == "GET":
                self._require_permission(user, "analytics.view")
                return self._send(200, ok(attrition_service.distribution()))
            if path == "/api/attrition/snapshot" and method == "POST":
                self._require_permission(user, "analytics.view")
                return self._send(200, ok(attrition_service.snapshot_risk_history()))
            match = re.fullmatch(r"/api/attrition/history/(\d+)", path)
            if match and method == "GET":
                self._require_permission(user, "analytics.view")
                return self._send(200, ok(attrition_service.get_risk_history(int(match.group(1)))))

            # === Attendance ===
            if path == "/api/attendance/clock" and method == "POST":
                eid = int(body.get("employee_id", user.get("employee_id", 0)))
                clock_type = body.get("clock_type", "normal")
                return self._send(200, ok(attendance_service.clock_in(eid, clock_type)))

            if path == "/api/attendance/my" and method == "GET":
                eid = int(query.get("employee_id", [0])[0])
                if not eid:
                    eid = user.get("employee_id", 0)
                limit = int(query.get("limit", ["30"])[0])
                return self._send(200, ok(attendance_service.get_my_attendance(eid, limit)))

            if path == "/api/attendance/records" and method == "GET":
                self._require_permission(user, "attendance.view")
                page_no, page_size = _parse_page(query)
                filters = {k: v[0] for k, v in query.items()}
                rows, total = attendance_service.list_attendance_records(
                    page_no, page_size,
                    employee_id=filters.get("employee_id") and int(filters["employee_id"]) or None,
                    department_id=filters.get("department_id") and int(filters["department_id"]) or None,
                    date_from=filters.get("date_from"),
                    date_to=filters.get("date_to"),
                    manager_employee_id=filters.get("manager_employee_id") and int(filters["manager_employee_id"]) or None,
                )
                return self._send(200, page(rows, total, page_no, page_size))

            if path == "/api/attendance/summary" and method == "GET":
                self._require_permission(user, "analytics.view")
                dept_id = query.get("department_id", [None])[0]
                return self._send(200, ok(attendance_service.attendance_summary(
                    department_id=int(dept_id) if dept_id else None,
                    date_from=query.get("date_from", [None])[0],
                    date_to=query.get("date_to", [None])[0],
                )))

            if path == "/api/attendance/sync" and method == "POST":
                self._require_permission(user, "analytics.view")
                return self._send(200, ok(attendance_service.update_absent_late_counts()))

            # === Performance Reviews ===
            if path == "/api/performance/reviews" and method == "GET":
                self._require_permission(user, "performance.view")
                page_no, page_size = _parse_page(query)
                filters = {k: v[0] for k, v in query.items()}
                rows, total = performance_service.list_reviews(
                    page_no, page_size,
                    employee_id=filters.get("employee_id") and int(filters["employee_id"]) or None,
                    department_id=filters.get("department_id") and int(filters["department_id"]) or None,
                    review_period=filters.get("review_period"),
                    status=filters.get("status"),
                    manager_employee_id=filters.get("manager_employee_id") and int(filters["manager_employee_id"]) or None,
                )
                return self._send(200, page(rows, total, page_no, page_size))

            if path == "/api/performance/reviews" and method == "POST":
                self._require_permission(user, "performance.manage")
                return self._send(200, ok(performance_service.create_review(body, user["username"])))

            match = re.fullmatch(r"/api/performance/reviews/(\d+)", path)
            if match and method == "PUT":
                self._require_permission(user, "performance.manage")
                return self._send(200, ok(performance_service.update_review(int(match.group(1)), body, user["username"])))

            if path == "/api/performance/my" and method == "GET":
                eid = int(query.get("employee_id", [0])[0])
                if not eid:
                    eid = user.get("employee_id", 0)
                return self._send(200, ok(performance_service.get_my_reviews(eid)))

            if path == "/api/performance/summary" and method == "GET":
                self._require_permission(user, "analytics.view")
                dept_id = query.get("department_id", [None])[0]
                period = query.get("review_period", [None])[0]
                return self._send(200, ok(performance_service.performance_summary(
                    department_id=int(dept_id) if dept_id else None,
                    review_period=period,
                )))

            if path == "/api/performance/sync" and method == "POST":
                self._require_permission(user, "analytics.view")
                return self._send(200, ok(performance_service.sync_avg_performance_score()))

            # === Analytics (cross-module) ===
            if path == "/api/analytics/department-health" and method == "GET":
                self._require_permission(user, "analytics.view")
                return self._send(200, ok(analytics_service.department_health_score()))

            if path == "/api/analytics/risk-trends" and method == "GET":
                self._require_permission(user, "analytics.view")
                return self._send(200, ok(analytics_service.org_risk_trend_summary()))

            if path == "/api/analytics/critical-persons" and method == "GET":
                self._require_permission(user, "analytics.view")
                return self._send(200, ok(analytics_service.critical_persons_enhanced()))

            match = re.fullmatch(r"/api/skills/gap/department/(\d+)", path)
            if match and method == "GET":
                self._require_permission(user, "analytics.view")
                return self._send(200, ok(analytics_service.org_skill_gap_department(int(match.group(1)))))

            if path == "/api/skills/gap/enhanced" and method == "GET":
                self._require_permission(user, "analytics.view")
                return self._send(200, ok(analytics_service.skill_gap_analysis_enhanced()))

            # === Org-People (V2 unified) ===
            if path == "/api/v2/org-people/tree" and method == "GET":
                return self._send(200, ok(org_people_service.org_people_tree()))

            if path == "/api/v2/org-people/search" and method == "GET":
                q = query.get("q", [""])[0]
                return self._send(200, ok(org_people_service.org_people_search(q)))

            if path == "/api/v2/org-people/filters" and method == "GET":
                return self._send(200, ok(org_people_service.org_people_filters()))

            if path == "/api/v2/org-people/positions" and method == "GET":
                dept_id = query.get("department_id", [None])[0]
                if dept_id:
                    return self._send(200, ok(org_people_service.get_positions_by_department(int(dept_id))))
                return self._send(200, ok([]))

            if path == "/api/v2/org-people/employees" and method == "GET":
                dept_id = query.get("department_id", [None])[0]
                pos_id = query.get("position_id", [None])[0]
                if dept_id:
                    return self._send(200, ok(org_people_service.get_employees_by_dept(
                        int(dept_id),
                        position_id=int(pos_id) if pos_id else None
                    )))
                return self._send(200, ok([]))

            match = re.fullmatch(r"/api/v2/org-people/employee/(\d+)/profile", path)
            if match and method == "GET":
                profile = org_people_service.employee_profile(int(match.group(1)))
                if profile is None:
                    self._send(*error(4001, "employee not found", 404))
                    return
                return self._send(200, ok(profile))

            # === Org-People (V2 aliases without v2 prefix for simplicity) ===
            if path == "/api/org-people/tree" and method == "GET":
                return self._send(200, ok(org_people_service.org_people_tree()))

            if path == "/api/org-people/search" and method == "GET":
                q = query.get("q", [""])[0]
                return self._send(200, ok(org_people_service.org_people_search(q)))

            if path == "/api/org-people/filters" and method == "GET":
                return self._send(200, ok(org_people_service.org_people_filters()))

            if path == "/api/org-people/positions" and method == "GET":
                dept_id = query.get("department_id", [None])[0]
                if dept_id:
                    return self._send(200, ok(org_people_service.get_positions_by_department(int(dept_id))))
                return self._send(200, ok([]))

            if path == "/api/org-people/employees" and method == "GET":
                dept_id = query.get("department_id", [None])[0]
                pos_id = query.get("position_id", [None])[0]
                if dept_id:
                    return self._send(200, ok(org_people_service.get_employees_by_dept(
                        int(dept_id),
                        position_id=int(pos_id) if pos_id else None
                    )))
                return self._send(200, ok([]))

            match = re.fullmatch(r"/api/org-people/employee/(\d+)/profile", path)
            if match and method == "GET":
                profile = org_people_service.employee_profile(int(match.group(1)))
                if profile is None:
                    self._send(*error(4001, "employee not found", 404))
                    return
                return self._send(200, ok(profile))

            # === Approval (V2) ===
            if path == "/api/v2/approval-requests/pending" and method == "GET":
                data = approval_service.get_pending_approvals(user["username"])
                return self._send(200, ok(data))

            if path == "/api/v2/approval-requests/my" and method == "GET":
                emp_id = _get_employee_id(user["username"])
                data = approval_service.get_my_requests(emp_id) if emp_id else []
                return self._send(200, ok(data))

            if path == "/api/v2/approval-requests/done" and method == "GET":
                emp_id = _get_employee_id(user["username"])
                data = approval_service.get_processed_requests(emp_id) if emp_id else []
                return self._send(200, ok(data))

            match = re.fullmatch(r"/api/v2/approval-requests/(\d+)/logs", path)
            if match and method == "GET":
                data = approval_service.get_request_detail(int(match.group(1)))
                return self._send(200, ok(data))

            match = re.fullmatch(r"/api/v2/approval-requests/(\d+)/(approve|reject)", path)
            if match and method == "PUT":
                request_id = int(match.group(1))
                action = match.group(2)
                comment = (body or {}).get("comment", "")
                if action == "approve":
                    data = approval_service.approve(request_id, user["username"], comment)
                else:
                    data = approval_service.reject(request_id, user["username"], comment)
                return self._send(200, ok(data))

            match = re.fullmatch(r"/api/v2/approval-requests/(\d+)/recall", path)
            if match and method == "PUT":
                data = approval_service.recall(int(match.group(1)), user["username"])
                return self._send(200, ok(data))

            # === Approval aliases (non-v2) ===
            if path == "/api/approval-requests/pending" and method == "GET":
                data = approval_service.get_pending_approvals(user["username"])
                return self._send(200, ok(data))

            if path == "/api/approval-requests/my" and method == "GET":
                emp_id = _get_employee_id(user["username"])
                data = approval_service.get_my_requests(emp_id) if emp_id else []
                return self._send(200, ok(data))

            if path == "/api/approval-requests/done" and method == "GET":
                emp_id = _get_employee_id(user["username"])
                data = approval_service.get_processed_requests(emp_id) if emp_id else []
                return self._send(200, ok(data))

            match = re.fullmatch(r"/api/approval-requests/(\d+)/logs", path)
            if match and method == "GET":
                data = approval_service.get_request_detail(int(match.group(1)))
                return self._send(200, ok(data))

            match = re.fullmatch(r"/api/approval-requests/(\d+)/(approve|reject)", path)
            if match and method == "PUT":
                request_id = int(match.group(1))
                action = match.group(2)
                comment = (body or {}).get("comment", "")
                if action == "approve":
                    data = approval_service.approve(request_id, user["username"], comment)
                else:
                    data = approval_service.reject(request_id, user["username"], comment)
                return self._send(200, ok(data))

            match = re.fullmatch(r"/api/approval-requests/(\d+)/recall", path)
            if match and method == "PUT":
                data = approval_service.recall(int(match.group(1)), user["username"])
                return self._send(200, ok(data))

            # === Approval submit ===
            if path == "/api/approval-requests" and method == "POST":
                emp_id = _get_employee_id(user["username"])
                if not emp_id:
                    return self._send(*error(4001, "无法解析当前用户对应的员工", 400))
                action_type = body.get("action_type") or body.get("operation_type")
                target_id = body.get("target_id") or body.get("employee_id", emp_id)
                if not action_type:
                    return self._send(*error(4001, "缺少 action_type 或 operation_type", 400))
                data = approval_service.submit_approval(
                    employee_id=emp_id,
                    action_type=action_type,
                    target_id=target_id,
                    payload=body.get("payload", {}),
                    actor=user["username"],
                )
                return self._send(200, ok(data))

            self._send(*error(4004, "endpoint not found", 404))
        except PermissionError as exc:
            self._send(*error(4003, str(exc), 403))
        except ValueError as exc:
            self._send(*error(4001, str(exc), 400))
        except DatabaseError as exc:
            self._send(*error(5000, str(exc), 500))
        except Exception as exc:
            self._send(*error(5000, f"unexpected server error: {exc}", 500))

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def _send(self, http_status, payload):
        body = to_json_bytes(payload)
        self.send_response(http_status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _extract_token(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return None
        return auth.split(" ", 1)[1].strip()

    def _require_auth(self):
        token = self._extract_token()
        profile = auth_service.get_profile(token)
        if not profile:
            self._send(*error(4001, "missing or invalid token", 401))
            return None
        return profile

    def _require_permission(self, user, permission_code):
        permissions = set(user.get("permissions", []))
        if permission_code not in permissions:
            raise PermissionError(f"permission denied: {permission_code}")

    def _handle_login(self, body):
        username = (body.get("username") or "").strip()
        password = body.get("password") or ""
        if not username or not password:
            self._send(*error(4001, "username and password are required", 400))
            return
        result = auth_service.login(username, password)
        if not result:
            self._send(*error(4001, "invalid username or password", 401))
            return
        self._send(200, ok(result))

    def _handle_profile(self):
        user = self._require_auth()
        if user:
            self._send(200, ok(user))

    def _handle_logout(self):
        token = self._extract_token()
        auth_service.logout(token)
        self._send(200, ok())


def run():
    server = ThreadingHTTPServer((APP_HOST, APP_PORT), ApiHandler)
    print(f"HRMS backend listening on http://{APP_HOST}:{APP_PORT}")
    print("Demo login password: 123456")
    server.serve_forever()
