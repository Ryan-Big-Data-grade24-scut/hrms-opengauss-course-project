import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from src.common.db import DatabaseError
from src.common.http import error, ok, page, to_json_bytes
from src.config import APP_HOST, APP_PORT
from src.services import (
    auth_service,
    directory_service,
    employee_service,
    leave_service,
    report_service,
    user_service,
)


def _parse_page(query):
    page_no = int(query.get("page", ["1"])[0] or "1")
    page_size = int(query.get("page_size", ["10"])[0] or "10")
    return max(page_no, 1), max(min(page_size, 100), 1)


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
                return self._send(200, ok(directory_service.list_positions()))
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
                    ok(leave_service.update_leave_status(int(match.group(1)), next_status, user["username"])),
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
