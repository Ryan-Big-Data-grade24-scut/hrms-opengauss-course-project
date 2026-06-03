"""HRMS 全量集成测试脚本

使用方法：
    cd backend
    python test_all.py

本脚本：
  1. 备份所有可能被修改的表
  2. 执行全部功能测试
  3. 输出测试报告
  4. 回滚数据到测试前状态

环境要求：
  - openGauss 容器 opengauss-hrms 运行中
  - hrms 数据库已初始化
  - Python 3.8+
"""

import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

# ===================================================================
# 配置
# ===================================================================
BASE = "http://127.0.0.1:18083"
DB_CONTAINER = "opengauss-hrms"
GSQL = "/usr/local/opengauss/bin/gsql"

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
SKIP = "\033[93mSKIP\033[0m"

passed = 0
failed = 0
total = 0
errors = []


def _gsql(sql):
    """在容器内执行 SQL，返回 stdout。"""
    cmd = [
        "docker", "exec", "-e", "LD_LIBRARY_PATH=/usr/local/opengauss/lib",
        DB_CONTAINER, "sh", "-c",
        f'{GSQL} -d hrms -U omm -W OpenGauss123! -t -A -c {json.dumps(sql)}'
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        print(f"  SQL ERROR: {r.stderr[:200]}")
        return ""
    return r.stdout.strip()


def http(method, path, body=None, token=None):
    """发送 HTTP 请求，返回 (status, data_dict)。"""
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            raw = resp.read().decode()
            return status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode() if e.fp else "{}"
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"message": raw[:200]}
    except Exception as e:
        return 0, {"message": str(e)}


def login(username="admin", password="123456"):
    """登录并返回 token。"""
    status, data = http("POST", "/api/auth/login", {"username": username, "password": password})
    if status == 200:
        return data.get("data", {}).get("token", "")
    return ""


def get_token(username):
    return login(username)


# ===================================================================
# 测试函数
# ===================================================================

def test(name, fn, *args):
    """执行一个测试用例。"""
    global passed, failed, total
    total += 1
    try:
        result = fn(*args)
        if result is True or result is None:
            passed += 1
            print(f"  {PASS} {name}")
        elif isinstance(result, str):
            failed += 1
            errors.append(f"{name}: {result}")
            print(f"  {FAIL} {name} — {result}")
        else:
            failed += 1
            errors.append(f"{name}: unexpected result {result}")
            print(f"  {FAIL} {name}: {result}")
    except Exception as e:
        failed += 1
        errors.append(f"{name}: {e}")
        print(f"  {FAIL} {name} — {e}")


def check_status(expect, status, data, msg_field="message"):
    """验证 HTTP 状态码。"""
    if status == expect:
        return True
    msg = data.get(msg_field, str(data))[:100]
    return f"期望 {expect}，实际 {status}: {msg}"


def check_data_fields(data, *fields):
    """验证 JSON data 包含指定字段。"""
    d = data.get("data", data) if isinstance(data, dict) else data
    for f in fields:
        if isinstance(d, list) and len(d) > 0:
            if f not in d[0]:
                return f"缺少字段: {f}"
        elif isinstance(d, dict):
            if f not in d:
                return f"缺少字段: {f}"
    return True


# ===================================================================
# 备份 & 回滚
# ===================================================================

BACKUP_SQLS = []


def backup_tables():
    """备份可能被修改的表。"""
    global BACKUP_SQLS
    tables = ["approval_request", "approval_step", "employee_skill",
              "leave_request", "employee_project", "project_tech_stack"]
    print("\n  === Backup tables ===")
    for table in tables:
        # Check if table exists
        exists = _gsql(f"SELECT 1 FROM information_schema.tables WHERE table_name='{table}'")
        if not exists:
            print(f"  {SKIP} {table}: 表不存在，跳过")
            continue
        # Count rows
        cnt = _gsql(f"SELECT COUNT(*) FROM {table}")
        print(f"  {PASS} {table}: {cnt} 行")
        # Backup
        _gsql(f"""
            DROP TABLE IF EXISTS __test_bak_{table};
            CREATE TABLE __test_bak_{table} AS SELECT * FROM {table}
        """)
        BACKUP_SQLS.append(table)
    print(f"  已备份 {len(BACKUP_SQLS)} 个表")


def restore_tables():
    """从备份恢复表。"""
    restored = 0
    print("\n  === 回滚数据 ===")
    for table in BACKUP_SQLS:
        _gsql(f"""
            DELETE FROM {table};
            INSERT INTO {table} SELECT * FROM __test_bak_{table};
            DROP TABLE IF EXISTS __test_bak_{table}
        """)
        restored += 1
        print(f"  {PASS} {table} 已恢复")
    _gsql("DROP TABLE IF EXISTS __test_bak_approval_request CASCADE")
    print(f"  已回滚 {restored} 个表")


# ===================================================================
# 主测试流程
# ===================================================================

def run_all_tests():
    global total, passed, failed

    # 1. 启动后端的检查
    print("\n\033[1m[1/5] 环境检查\033[0m")
    token = login()
    test("登录 admin", lambda: check_status(200, *http("POST", "/api/auth/login",
         {"username": "admin", "password": "123456"})))
    test("登录 employee", lambda: check_status(200, *http("POST", "/api/auth/login",
         {"username": "employee", "password": "123456"})))
    test("登录失败", lambda: check_status(401, *http("POST", "/api/auth/login",
         {"username": "admin", "password": "wrong"})))
    if not token:
        print(f"\n  {FAIL} 无法获取 token，终止测试")
        return

    # 2. Auth
    print("\n\033[1m[2/5] 认证与用户模块\033[0m")
    test("登录返回 token", lambda: len(token) > 10 or "token length")
    status, data = http("GET", "/api/auth/profile", token=token)
    test("获取个人信息", lambda: check_status(200, status, data))

    # 3. 部门 & 员工
    print("\n\033[1m  —— 部门与员工 ——\033[0m")
    status, data = http("GET", "/api/departments", token=token)
    test("列出部门", lambda: check_status(200, status, data) or check_data_fields(data, "department_id"))
    depts = data.get("data", [])
    dept_id = depts[0]["department_id"] if depts else 1

    status, data = http("GET", "/api/employees?page=1&page_size=10", token=token)
    test("员工列表(分页)", lambda: check_status(200, status, data) or check_data_fields(data, "data"))
    emp_list = data.get("data", {}).get("list", data.get("data", []))
    emp_id = emp_list[0]["employee_id"] if emp_list else 503

    # 4. 组织人员
    print("\n\033[1m  —— 组织人员 ——\033[0m")
    status, data = http("GET", "/api/v2/org-people/tree", token=token)
    test("组织树", lambda: check_status(200, status, data))

    status, data = http("GET", f"/api/org-people/employees?department_id={dept_id}", token=token)
    test("部门员工", lambda: check_status(200, status, data))

    status, data = http("GET", f"/api/org-people/employees?department_id={dept_id}&position_id=1", token=token)
    test("部门+岗位筛选", lambda: check_status(200, status, data))

    status, data = http("GET", f"/api/org/employee/{emp_id}", token=token)
    test("Bundle API", lambda: check_status(200, status, data) or check_data_fields(data, "employee"))

    status, data = http("GET", f"/api/org-people/search?q=Alex", token=token)
    test("人员搜索", lambda: check_status(200, status, data))

    # 5. 技能
    print("\n\033[1m  —— 技能 ——\033[0m")
    status, data = http("GET", "/api/skills", token=token)
    test("全部技能", lambda: check_status(200, status, data))

    status, data = http("GET", f"/api/employees/skills?employee_id={emp_id}", token=token)
    test("员工技能", lambda: check_status(200, status, data))

    status, data = http("GET", "/api/skills/required?position_id=1", token=token)
    test("岗位技能要求", lambda: check_status(200, status, data))

    status, data = http("GET", "/api/skills/analytics/overview", token=token)
    test("技能概览", lambda: check_status(200, status, data))

    status, data = http("GET", "/api/skills/gap", token=token)
    test("技能缺口分析", lambda: check_status(200, status, data))

    status, data = http("GET", "/api/skills/heatmap", token=token)
    test("技能热力图", lambda: check_status(200, status, data))

    # 6. 审批流（核心）
    print("\n\033[1m  —— 审批流 ——\033[0m")

    # 6a. 提交审批
    emp_token = get_token("employee")
    if emp_token:
        # SKILL_ADD
        status, data = http("POST", "/api/approval-requests",
            {"operation_type": "SKILL_ADD", "target_id": emp_id,
             "payload": {"action": "add", "skill_id": 1, "proficiency": 3}},
            token=emp_token)
        test("技能新增审批", lambda: check_status(200, status, data) or check_data_fields(data.get("data", {}), "id"))
        skill_req_id = data.get("data", {}).get("id")

        # LEAVE_REQUEST
        status, data = http("POST", "/api/approval-requests",
            {"operation_type": "LEAVE_REQUEST", "target_id": emp_id,
             "payload": {"leave_type_id": 1, "start_date": "2026-06-10", "end_date": "2026-06-12", "reason": "年假"}},
            token=emp_token)
        test("请假申请审批", lambda: check_status(200, status, data) or check_data_fields(data.get("data", {}), "id"))
        leave_req_id = data.get("data", {}).get("id")

        # ATTENDANCE_CORRECTION
        status, data = http("POST", "/api/approval-requests",
            {"operation_type": "ATTENDANCE_CORRECTION", "target_id": emp_id,
             "payload": {"date": "2026-06-03", "period": "full", "reason": "忘打卡"}},
            token=emp_token)
        test("考勤补卡审批", lambda: check_status(200, status, data) or check_data_fields(data.get("data", {}), "id"))

        # PROFILE_UPDATE
        status, data = http("POST", "/api/approval-requests",
            {"operation_type": "PROFILE_UPDATE", "target_id": emp_id,
             "payload": {"fields": {"phone": "13800138000"}, "reason": "更新手机号"}},
            token=emp_token)
        test("信息修改审批", lambda: check_status(200, status, data) or check_data_fields(data.get("data", {}), "id"))

        # 6b. 查询待审批（manager / HR 视角）
        mgr_token = get_token("tom_li")   # 员工 employee 的直接上级
        hr_token = get_token("vp_eng")    # HR 角色

        if mgr_token:
            status, data = http("GET", "/api/v2/approval-requests/pending", token=mgr_token)
            test("管理者待审批列表", lambda: check_status(200, status, data))

        if hr_token:
            status, data = http("GET", "/api/v2/approval-requests/pending", token=hr_token)
            test("HR 待审批列表", lambda: check_status(200, status, data))

        # 6c. 我发起的
        status, data = http("GET", "/api/v2/approval-requests/my", token=emp_token)
        test("我的申请列表", lambda: check_status(200, status, data))

        # 6d. 批准
        # employee 的 direct_manager 是 Tom Li (tom_li)。用他的 token 批准 skill change
        if mgr_token and skill_req_id:
            status, data = http("PUT", f"/api/v2/approval-requests/{skill_req_id}/approve",
                {"comment": "批准技能变更"}, token=mgr_token)
            test("审批通过", lambda: check_status(200, status, data))
            # 检查最终状态
            final_status = data.get("data", {}).get("status")
            test(f"审批终态", lambda: final_status == "approved" or f"期望 approved 实际 {final_status}")

        # 6e. 详情
        if skill_req_id:
            status, data = http("GET", f"/api/v2/approval-requests/{skill_req_id}/logs", token=emp_token)
            test("审批详情", lambda: check_status(200, status, data))

    # 7. 考勤
    print("\n\033[1m  —— 考勤 ——\033[0m")
    status, data = http("GET", "/api/attendance/summary", token=token)
    test("考勤汇总", lambda: check_status(200, status, data))
    att = data.get("data", [])
    if att:
        test("考勤数据完整性", lambda: all(a.get("attendance_rate") is not None for a in att) or "缺少 attendance_rate")

    status, data = http("GET", f"/api/attendance?employee_id={emp_id}", token=token)
    test("个人考勤记录", lambda: check_status(200, status, data))

    # 8. 绩效
    print("\n\033[1m  —— 绩效 ——\033[0m")
    status, data = http("GET", "/api/performance/summary", token=token)
    test("绩效汇总", lambda: check_status(200, status, data))
    perf = data.get("data", [])
    if perf:
        test("绩效数据完整性", lambda: all(p.get("avg_score") is not None for p in perf) or "缺少 avg_score")

    status, data = http("GET", f"/api/performance/reviews?employee_id={emp_id}", token=token)
    test("个人绩效记录", lambda: check_status(200, status, data))

    # 9. 数据分析
    print("\n\033[1m  —— 数据分析 ——\033[0m")
    status, data = http("GET", "/api/attrition/risk", token=token)
    test("离职风险", lambda: check_status(200, status, data))

    status, data = http("GET", "/api/analytics/department-health", token=token)
    test("部门健康度", lambda: check_status(200, status, data))

    status, data = http("GET", "/api/analytics/critical-persons", token=token)
    test("重点人员", lambda: check_status(200, status, data))

    status, data = http("GET", "/api/analytics/risk-trends", token=token)
    test("风险趋势", lambda: check_status(200, status, data))

    status, data = http("GET", "/api/attrition/risk/detail?employee_id=503", token=token)
    test("风险因子分解", lambda: check_status(200, status, data))

    # 10. 请假
    print("\n\033[1m  —— 请假 ——\033[0m")
    status, data = http("GET", "/api/leave-types", token=token)
    test("请假类型", lambda: check_status(200, status, data))

    status, data = http("GET", f"/api/leaves?employee_id={emp_id}", token=token)
    test("个人请假记录", lambda: check_status(200, status, data))

    # 11. 履历
    print("\n\033[1m  —— 履历 ——\033[0m")
    status, data = http("GET", f"/api/employees/{emp_id}/projects", token=token)
    test("项目列表", lambda: check_status(200, status, data))

    status, data = http("POST", f"/api/employees/{emp_id}/projects",
        {"project_name": "测试项目", "role": "测试工程师",
         "start_date": "2026-01-01", "end_date": "2026-06-01",
         "description": "Python, SQL, Docker"}, token=token)
    test("新建项目", lambda: check_status(200, status, data))
    proj_id = data.get("data", {}).get("project_id")

    if proj_id:
        status, data = http("PUT", f"/api/employees/{emp_id}/projects/{proj_id}",
            {"project_name": "测试项目(已更新)"}, token=token)
        test("更新项目", lambda: check_status(200, status, data))

        status, data = http("DELETE", f"/api/employees/{emp_id}/projects/{proj_id}", token=token)
        test("删除项目", lambda: check_status(200, status, data))

    # 12. 岗位匹配
    print("\n\033[1m  —— 岗位匹配 ——\033[0m")
    status, data = http("GET", f"/api/match/employee?employee_id={emp_id}", token=token)
    test("岗位匹配", lambda: check_status(200, status, data))

    # 13. 离职预测
    print("\n\033[1m  —— 离职预测 ——\033[0m")
    status, data = http("GET", "/api/predict/attrition", token=token)
    test("离职预测", lambda: check_status(200, status, data))

    # ===================================================================
    # 报告
    # ===================================================================
    print(f"\n\033[1m{'='*50}\033[0m")
    print(f"\033[1m测试完成: 总计 {total}  |  通过 {passed}  |  失败 {failed}\033[0m")
    if errors:
        print(f"\n\033[91m失败详情:\033[0m")
        for e in errors:
            print(f"  • {e}")
    print(f"\033[1m{'='*50}\033[0m")


# ===================================================================
# 入口
# ===================================================================

if __name__ == "__main__":
    # 1. 确认后端运行
    print("Checking backend...")
    try:
        req = urllib.request.Request(f"{BASE}/api/auth/login", data=b'{}', method="POST")
        req.add_header("Content-Type", "application/json")
        urllib.request.urlopen(req, timeout=5)
    except urllib.error.HTTPError:
        pass  # 401 is fine - means server is up
    except Exception as e:
        print(f"Backend not running on {BASE}: {e}")
        sys.exit(1)
    print("  Backend OK")

    # 2. 备份
    backup_tables()

    # 3. 跑测试
    run_all_tests()

    # 4. 回滚
    if passed + failed > 0:
        restore_tables()

    # 5. 最终状态
    if failed > 0:
        print(f"\n{FAIL} {failed} 个测试失败，已自动回滚数据")
        sys.exit(1)
    else:
        print(f"\n{PASS} 全部 {total} 个测试通过，数据已回滚")
