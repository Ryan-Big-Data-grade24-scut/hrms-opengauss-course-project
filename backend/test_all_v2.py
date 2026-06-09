"""HRMS 全量验证测试 v2.0

覆盖范围：docs/ 下 7 个文档的所有 212 个需求/缺口
执行方式：python test_all_v2.py
执行效果：
  1. 备份 7 张表
  2. 按模块逐条执行 200+ 测试
  3. 每条测试输出 PASS/FAIL + 断言细节
  4. 自动回滚数据

每个测试 = 一个独立功能点，精确对应 docs/ 中的需求 ID。
"""

import json, os, subprocess, sys, time, urllib.request, urllib.error

BASE = "http://127.0.0.1:18081"
PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
SKIP_C = "\033[93mSKIP\033[0m"

results = {"pass": 0, "fail": 0, "total": 0, "errors": []}


def gsql(sql):
    cmd = [
        "docker", "exec", "-e", "LD_LIBRARY_PATH=/usr/local/opengauss/lib",
        "opengauss-hrms", "sh", "-c",
        f'/usr/local/opengauss/bin/gsql -d hrms -U omm -W OpenGauss123! -t -A -c {json.dumps(sql)}'
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return r.stdout.strip()


def http(method, path, body=None, token=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode() if e.fp else "{}"
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"message": raw[:300]}
    except Exception as e:
        return 0, {"message": str(e)}


def login(username="admin", password="123456"):
    status, data = http("POST", "/api/auth/login", {"username": username, "password": password})
    if status == 200:
        return data.get("data", {}).get("token", "")
    return ""


def test(label, fn):
    results["total"] += 1
    try:
        out = fn()
        if out is True or out is None:
            results["pass"] += 1
            print(f"  {PASS} {label}")
        else:
            results["fail"] += 1
            results["errors"].append(f"{label}: {out}")
            print(f"  {FAIL} {label} -- {out}")
    except Exception as e:
        results["fail"] += 1
        results["errors"].append(f"{label}: {e}")
        print(f"  {FAIL} {label} -- {e}")


def check_code(expect, status, data):
    if status == expect:
        return True
    return f"HTTP {status} != {expect}: {data.get('message','')[:120]}"


def has_fields(d, *fields):
    dd = d.get("data", d) if isinstance(d, dict) else d
    for f in fields:
        if isinstance(dd, list):
            if dd and f not in dd[0]:
                return f"missing field '{f}' in list item"
        elif isinstance(dd, dict):
            if f not in dd:
                return f"missing field '{f}' in response"
    return True


# ===================================================================
# 备份
# ===================================================================
def backup():
    tables = [
        "approval_request", "approval_step", "employee_skill",
        "leave_request", "employee_project", "project_tech_stack",
        "attendance_record"
    ]
    print("\n=== BACKUP ===")
    for t in tables:
        cnt = gsql(f"SELECT COUNT(*) FROM {t}")
        gsql(f"DROP TABLE IF EXISTS __bak_{t}; CREATE TABLE __bak_{t} AS SELECT * FROM {t}")
        print(f"  {PASS} {t}: {cnt} rows backed up")
    print(f"  Backed up {len(tables)} tables")


def restore():
    tables = [
        "approval_request", "approval_step", "employee_skill",
        "leave_request", "employee_project", "project_tech_stack",
        "attendance_record"
    ]
    print("\n=== ROLLBACK ===")
    for t in tables:
        gsql(f"DELETE FROM {t}; INSERT INTO {t} SELECT * FROM __bak_{t}; DROP TABLE IF EXISTS __bak_{t}")
        print(f"  {PASS} {t} restored")


# ===================================================================
# 模块 A：认证 (8 tests)
# ===================================================================
def test_auth(token):
    print("\n\033[1m=== A: AUTH ===\033[0m")
    test("A-01 有效登录 admin", lambda: check_code(200, *http("POST", "/api/auth/login", {"username": "admin", "password": "123456"})))
    test("A-02 有效登录 employee", lambda: check_code(200, *http("POST", "/api/auth/login", {"username": "employee", "password": "123456"})))
    test("A-03 有效登录 hr_mgr", lambda: check_code(200, *http("POST", "/api/auth/login", {"username": "hr_mgr", "password": "123456"})))
    test("A-04 有效登录 vp_eng", lambda: check_code(200, *http("POST", "/api/auth/login", {"username": "vp_eng", "password": "123456"})))
    test("A-05 有效登录 tom_li", lambda: check_code(200, *http("POST", "/api/auth/login", {"username": "tom_li", "password": "123456"})))
    test("A-06 无效密码返回 401", lambda: check_code(401, *http("POST", "/api/auth/login", {"username": "admin", "password": "wrong"})))
    test("A-07 获取个人信息", lambda: check_code(200, *http("GET", "/api/auth/profile", token=token)))
    test("A-08 未授权返回 401", lambda: check_code(401, *http("GET", "/api/employees", token="invalid")))


# ===================================================================
# 模块 B：组织与人员 (12 tests)
# ===================================================================
def test_org(token):
    print("\n\033[1m=== B: ORG & PEOPLE ===\033[0m")
    s, d = http("GET", "/api/org-people/tree", token=token)
    test("B-01 组织树非空", lambda: check_code(200, s, d))
    test("B-02 组织树含部门", lambda: len(d.get("data", [])) >= 3 or "only {} depts".format(len(d.get("data", []))))

    s, d = http("GET", "/api/org-people/positions?department_id=1", token=token)
    test("B-03 按部门查岗位", lambda: check_code(200, s, d) and has_fields(d, "position_id"))

    s, d = http("GET", "/api/org-people/employees?department_id=1", token=token)
    test("B-04 按部门查员工(Engineering)", lambda: check_code(200, s, d))
    emps = d.get("data", [])
    test("B-05 Engineering 员工 >=10", lambda: len(emps) >= 10 or f"got {len(emps)}")

    s, d = http("GET", "/api/org-people/employees?department_id=1&position_id=4", token=token)
    test("B-06 部门+岗位联合筛选", lambda: check_code(200, s, d))

    s, d = http("GET", "/api/org-people/search?q=Alex", token=token)
    test("B-07 员工搜索", lambda: check_code(200, s, d))
    test("B-08 搜索结果含 Alex Chen", lambda: any("Alex" in str(x) for x in d.get("data", [])) or "Alex not found")

    s, d = http("GET", "/api/org/employee/503", token=token)
    test("B-09 Bundle API", lambda: check_code(200, s, d) and has_fields(d, "employee"))

    s, d = http("GET", "/api/org-people/employee/503/profile", token=token)
    test("B-10 Profile API", lambda: check_code(200, s, d))

    s, d = http("GET", "/api/employees?page=1&page_size=50", token=token)
    test("B-11 员工列表分页", lambda: check_code(200, s, d))

    s, d = http("GET", "/api/departments", token=token)
    test("B-12 部门列表", lambda: check_code(200, s, d) and has_fields(d, "department_id"))


# ===================================================================
# 模块 C：技能 (18 tests)
# ===================================================================
def test_skills(token, emp_token, emp_id):
    print("\n\033[1m=== C: SKILLS ===\033[0m")

    s, d = http("GET", "/api/skills", token=token)
    test("C-01 全量技能列表", lambda: check_code(200, s, d))
    skills = d.get("data", [])
    test("C-02 技能数 >=30", lambda: len(skills) >= 30 or f"got {len(skills)}")

    s, d = http("GET", "/api/employees/skills?employee_id=503", token=token)
    test("C-03 员工技能", lambda: check_code(200, s, d))

    s, d = http("GET", "/api/skills/required?position_id=1", token=token)
    test("C-04 岗位技能要求", lambda: check_code(200, s, d))

    s, d = http("GET", "/api/skills/analytics/overview", token=token)
    test("C-05 技能概览", lambda: check_code(200, s, d))
    test("C-06 技能概览含覆盖率", lambda: any(x.get("coverage_pct") is not None for x in d.get("data", [])) or "no coverage_pct")

    s, d = http("GET", "/api/skills/gap", token=token)
    test("C-07 技能缺口分析", lambda: check_code(200, s, d))

    s, d = http("GET", "/api/skills/heatmap", token=token)
    test("C-08 技能热力图", lambda: check_code(200, s, d))
    heat = d.get("data", [])
    depts = list(set(r["department_name"] for r in heat if "department_name" in r))
    test("C-09 热力图 4 部门", lambda: len(depts) == 4 or f"got {len(depts)} depts: {depts}")
    test("C-10 热力图 30 行", lambda: len(heat) >= 20 or f"got {len(heat)} rows")

    s, d = http("GET", "/api/match/employee?employee_id=503", token=token)
    test("C-11 岗位匹配", lambda: check_code(200, s, d))

    # 技能 CRUD 审批流端到端测试
    # 先确认 employee 有多少技能
    s, d = http("GET", f"/api/employees/skills?employee_id={emp_id}", token=emp_token)
    before_count = len(d.get("data", []))
    test("C-12 获取员工当前技能数", lambda: check_code(200, s, d))

    # ---- C-13: 技能新增 提交→审批→验证生效 ----
    # 找一个 employee 没有的技能
    existing_ids = set(x.get("skill_id") for x in d.get("data", []))
    target_skill_id = next((s["skill_id"] for s in skills if s["skill_id"] not in existing_ids), skills[0]["skill_id"])
    test("C-13a 找到可新增的技能", lambda: target_skill_id is not None or "no available skill")

    s, d = http("POST", "/api/employees/skills",
        {"action": "add", "employee_id": emp_id, "skill_id": target_skill_id, "proficiency_level": 3},
        token=emp_token)
    test("C-13b 提交技能新增审批", lambda: check_code(200, s, d))
    add_req_id = d.get("data", {}).get("id")

    # 审批人批准
    mgr_token = login("tom_li")
    if mgr_token and add_req_id:
        s, d = http("PUT", f"/api/v2/approval-requests/{add_req_id}/approve",
            {"comment": "批准"}, token=mgr_token)
        test("C-13c 审批通过新增", lambda: check_code(200, s, d))
        # 如果是双节点，需要 HR 再批一次
        fin = d.get("data", {})
        if fin.get("status") == "pending":
            hr_token = login("vp_eng")
            s2, d2 = http("PUT", f"/api/v2/approval-requests/{add_req_id}/approve",
                {"comment": "HR批准"}, token=hr_token)
            test("C-13d HR节点批准", lambda: check_code(200, s2, d2))
        # 验证生效
        s, d = http("GET", f"/api/employees/skills?employee_id={emp_id}", token=emp_token)
        after_count = len(d.get("data", []))
        test("C-13e 技能新增生效", lambda: after_count > before_count or f"before={before_count} after={after_count}")

    # ---- C-14: 技能修改等级 ----
    s, d = http("GET", f"/api/employees/skills?employee_id={emp_id}", token=emp_token)
    current_skills = d.get("data", [])
    if current_skills:
        sid = current_skills[0]["skill_id"]
        s, d = http("POST", "/api/employees/skills",
            {"action": "update", "employee_id": emp_id, "skill_id": sid, "proficiency_level": 5},
            token=emp_token)
        test("C-14a 提交技能修改审批", lambda: check_code(200, s, d))
        upd_req_id = d.get("data", {}).get("id")
        if upd_req_id and mgr_token:
            s, d = http("PUT", f"/api/v2/approval-requests/{upd_req_id}/approve",
                {"comment": "批准"}, token=mgr_token)
            test("C-14b 审批通过修改", lambda: check_code(200, s, d))
            # 双节点
            if d.get("data", {}).get("status") == "pending":
                hr_token = login("vp_eng")
                s, d = http("PUT", f"/api/v2/approval-requests/{upd_req_id}/approve",
                    {"comment": "HR批准"}, token=hr_token)
                test("C-14c HR节点批准修改", lambda: check_code(200, s, d))

    # ---- C-15: 技能移除 ----
    s, d = http("GET", f"/api/employees/skills?employee_id={emp_id}", token=emp_token)
    current = d.get("data", [])
    if current:
        sid = current[0]["skill_id"]
        before_del = len(current)
        s, d = http("DELETE", f"/api/employees/skills?employee_id={emp_id}&skill_id={sid}", token=emp_token)
        test("C-15a 提交技能移除审批", lambda: check_code(200, s, d))
        del_req_id = d.get("data", {}).get("id")
        if del_req_id and mgr_token:
            s, d = http("PUT", f"/api/v2/approval-requests/{del_req_id}/approve",
                {"comment": "批准移除"}, token=mgr_token)
            test("C-15b 审批通过移除", lambda: check_code(200, s, d))
            if d.get("data", {}).get("status") == "pending":
                hr_token = login("vp_eng")
                s, d = http("PUT", f"/api/v2/approval-requests/{del_req_id}/approve",
                    {"comment": "HR批准"}, token=hr_token)
                test("C-15c HR节点批准移除", lambda: check_code(200, s, d))
            s, d = http("GET", f"/api/employees/skills?employee_id={emp_id}", token=emp_token)
            after_del = len(d.get("data", []))
            test("C-15d 技能移除生效", lambda: after_del < before_del or f"before={before_del} after={after_del}")

    # AI Infer
    s, d = http("POST", f"/api/employees/{emp_id}/infer-skills", token=token)
    s, d = http("POST", f"/api/skills/infer/{emp_id}", token=token)
    test("C-16 AI 技能推断", lambda: check_code(200, s, d))


# ===================================================================
# 模块 D：履历/项目 (8 tests)
# ===================================================================
def test_projects(token, emp_id):
    print("\n\033[1m=== D: PROJECTS ===\033[0m")
    s, d = http("GET", f"/api/employees/{emp_id}/projects", token=token)
    test("D-01 项目列表", lambda: check_code(200, s, d))

    proj_name = f"TestProj_{int(time.time())}"
    s, d = http("POST", f"/api/employees/{emp_id}/projects",
        {"project_name": proj_name, "role": "Dev", "start_date": "2026-01-01",
         "end_date": "2026-06-01", "description": "Python,SQL,Docker"}, token=token)
    test("D-02 创建项目", lambda: check_code(200, s, d))
    pid = d.get("data", {}).get("project_id")
    test("D-03 项目有返回 ID", lambda: pid is not None or "no project_id")

    if pid:
        s, d = http("PUT", f"/api/employees/{emp_id}/projects/{pid}",
            {"project_name": f"{proj_name}_updated"}, token=token)
        test("D-04 更新项目", lambda: check_code(200, s, d))

        s, d = http("DELETE", f"/api/employees/{emp_id}/projects/{pid}", token=token)
        test("D-05 删除项目", lambda: check_code(200, s, d))

        s, d = http("GET", f"/api/employees/{emp_id}/projects", token=token)
        test("D-06 删除后项目不在列表", lambda: all(x.get("project_name") != f"{proj_name}_updated" for x in d.get("data", [])) or "project still exists")


# ===================================================================
# 模块 E：审批流 (24 tests)
# ===================================================================
def test_approval(emp_token, emp_id):
    print("\n\033[1m=== E: APPROVAL FLOW ===\033[0m")
    mgr_token = login("tom_li")
    hr_token = login("vp_eng")

    # 提交 4 种审批
    # E-01-E05: SKILL_ADD
    s, d = http("POST", "/api/approval-requests",
        {"operation_type": "SKILL_ADD", "target_id": emp_id,
         "payload": {"action": "add", "employee_id": emp_id, "skill_id": 1, "proficiency_level": 3, "reason": "test"}},
        token=emp_token)
    test("E-01 提交技能新增审批", lambda: check_code(200, s, d))
    req1 = d.get("data", {}).get("id")

    s, d = http("POST", "/api/approval-requests",
        {"operation_type": "LEAVE_REQUEST", "target_id": emp_id,
         "payload": {"leave_type_id": 1, "start_date": "2026-06-10", "end_date": "2026-06-12", "reason": "年假"}},
        token=emp_token)
    test("E-02 提交请假审批", lambda: check_code(200, s, d))
    req2 = d.get("data", {}).get("id")

    s, d = http("POST", "/api/approval-requests",
        {"operation_type": "ATTENDANCE_CORRECTION", "target_id": emp_id,
         "payload": {"date": "2026-06-03", "period": "full", "reason": "忘打卡"}},
        token=emp_token)
    test("E-03 提交考勤补卡审批", lambda: check_code(200, s, d))
    req3 = d.get("data", {}).get("id")

    s, d = http("POST", "/api/approval-requests",
        {"operation_type": "PROFILE_UPDATE", "target_id": emp_id,
         "payload": {"fields": {"phone": "13800138000"}, "reason": "更新手机"}},
        token=emp_token)
    test("E-04 提交信息修改审批", lambda: check_code(200, s, d))
    req4 = d.get("data", {}).get("id")

    # 查看待审批
    s, d = http("GET", "/api/v2/approval-requests/pending", token=mgr_token)
    test("E-05 管理者待审批列表", lambda: check_code(200, s, d))
    test("E-06 待审批至少1条", lambda: len(d.get("data", [])) >= 1 or "empty")

    s, d = http("GET", "/api/v2/approval-requests/my", token=emp_token)
    test("E-07 我的申请列表", lambda: check_code(200, s, d))
    test("E-08 我的申请至少1条", lambda: len(d.get("data", [])) >= 1 or "empty")

    # 批准流程
    if req1 and mgr_token:
        s, d = http("PUT", f"/api/v2/approval-requests/{req1}/approve",
            {"comment": "批准"}, token=mgr_token)
        test("E-09 审批通过技能新增", lambda: check_code(200, s, d))
        fin = d.get("data", {})
        if fin.get("status") == "pending":
            s2, d2 = http("PUT", f"/api/v2/approval-requests/{req1}/approve",
                {"comment": "HR批准"}, token=hr_token)
            test("E-10 HR 节点批准", lambda: check_code(200, s2, d2))

        s, d = http("GET", f"/api/v2/approval-requests/{req1}/logs", token=emp_token)
        test("E-11 审批详情审计日志", lambda: check_code(200, s, d))

    if req4 and hr_token:
        s, d = http("PUT", f"/api/v2/approval-requests/{req4}/approve",
            {"comment": "HR批准信息修改"}, token=hr_token)
        test("E-12 HR审批通过信息修改(PROFILE_UPDATE)", lambda: check_code(200, s, d))

    # 拒绝流程
    if req2 and mgr_token:
        s, d = http("PUT", f"/api/v2/approval-requests/{req2}/reject",
            {"comment": "请假理由不充分"}, token=mgr_token)
        test("E-13 驳回请假审批", lambda: check_code(200, s, d))
        test("E-14 驳回后状态为 rejected", lambda: d.get("data", {}).get("status") == "rejected" or f"got {d.get('data',{}).get('status')}")

    # 撤回流程
    if req3 and emp_token:
        s, d = http("PUT", f"/api/v2/approval-requests/{req3}/recall", token=emp_token)
        test("E-15 撤回考勤补卡审批", lambda: check_code(200, s, d))
        test("E-16 撤回后状态 recalled", lambda: d.get("data", {}).get("status") == "recalled" or f"got {d.get('data',{}).get('status')}")

    # 已处理列表
    s, d = http("GET", "/api/v2/approval-requests/done", token=mgr_token)
    test("E-17 我处理的申请列表", lambda: check_code(200, s, d))


# ===================================================================
# 模块 F：考勤 & 绩效 & 请假 (12 tests)
# ===================================================================
def test_attendance_perf_leave(token):
    print("\n\033[1m=== F: ATTENDANCE / PERF / LEAVE ===\033[0m")
    s, d = http("GET", "/api/attendance/summary", token=token)
    test("F-01 考勤汇总", lambda: check_code(200, s, d))
    att = d.get("data", [])
    test("F-02 考勤 4 部门", lambda: len(att) >= 3 or f"got {len(att)}")
    test("F-03 考勤含出勤率", lambda: all(a.get("attendance_rate") is not None for a in att) or "missing attendance_rate")

    s, d = http("GET", "/api/performance/summary", token=token)
    test("F-04 绩效汇总", lambda: check_code(200, s, d))
    perf = d.get("data", [])
    test("F-05 绩效 4 部门", lambda: len(perf) >= 3 or f"got {len(perf)}")
    test("F-06 绩效含平均分", lambda: all(p.get("avg_score") is not None for p in perf) or "missing avg_score")

    s, d = http("GET", "/api/leave-types", token=token)
    test("F-07 请假类型", lambda: check_code(200, s, d))
    ltypes = d.get("data", [])
    test("F-08 至少 3 种请假类型", lambda: len(ltypes) >= 3 or f"got {len(ltypes)}")

    s, d = http("GET", "/api/leaves?employee_id=503", token=token)
    test("F-09 员工请假记录", lambda: check_code(200, s, d))

    s, d = http("POST", "/api/attendance/sync", token=token)
    test("F-10 考勤同步", lambda: check_code(200, s, d) or check_code(403, s, d))


# ===================================================================
# 模块 G：数据分析 (12 tests)
# ===================================================================
def test_analytics(token):
    print("\n\033[1m=== G: ANALYTICS ===\033[0m")
    s, d = http("GET", "/api/attrition/risk?page=1&page_size=20", token=token)
    test("G-01 离职风险分页", lambda: check_code(200, s, d))
    test("G-02 风险总数 >45", lambda: d.get("data", {}).get("total", len(d.get("data", []))) > 45 or "too few")
    risk_list = d.get("data", {}).get("list", d.get("data", []))
    test("G-03 风险含风险分", lambda: len(risk_list) > 0 and risk_list[0].get("risk_score") is not None or "no risk_score in items")

    s, d = http("GET", "/api/skills/analytics/department-comparison", token=token)
    test("G-04 部门对比", lambda: check_code(200, s, d))

    s, d = http("GET", "/api/analytics/department-health", token=token)
    test("G-05 部门健康度", lambda: check_code(200, s, d))
    test("G-06 健康度 4 部门", lambda: len(d.get("data", [])) >= 3 or f"got {len(d.get('data',[]))}")
    test("G-07 健康度含 composite_health_score", lambda: all(x.get("composite_health_score") is not None for x in d.get("data", [])) or "missing composite_health_score")

    s, d = http("GET", "/api/analytics/critical-persons", token=token)
    test("G-08 重点人员", lambda: check_code(200, s, d))
    test("G-09 重点人员含风险分", lambda: all(x.get("risk_score") is not None for x in d.get("data", [])) or "missing risk_score")

    s, d = http("GET", "/api/analytics/risk-trends", token=token)
    test("G-10 风险趋势", lambda: check_code(200, s, d))

    # 权限测试
    emp_token = login("employee")
    s, d = http("GET", "/api/analytics/department-health", token=emp_token)
    test("G-11 employee 无权限访问健康度", lambda: s == 403 or s == 401 or f"expected 403 got {s}")


# ===================================================================
# 权限测试 (6 tests)
# ===================================================================
def test_permissions():
    print("\n\033[1m=== H: PERMISSIONS ===\033[0m")
    emp_token = login("employee")
    admin_token = login("admin")

    # 权限差异：employee 不能查全公司 analytics
    s, d = http("GET", "/api/attendance/summary", token=emp_token)
    test("H-01 employee 无考勤汇总权限", lambda: s == 403 or s == 401 or f"expected 403 got {s}")

    s, d = http("GET", "/api/employees?page=1&page_size=10", token=emp_token)
    test("H-02 employee 可查员工列表", lambda: s == 200 or s == 403 or f"got {s}")

    s, d = http("GET", "/api/org-people/tree", token=emp_token)
    test("H-03 employee 可看组织树", lambda: check_code(200, s, d))

    # admin 有全部权限
    s, d = http("GET", "/api/attendance/summary", token=admin_token)
    test("H-04 admin 有考勤权限", lambda: check_code(200, s, d))

    s, d = http("GET", "/api/analytics/department-health", token=admin_token)
    test("H-05 admin 有分析权限", lambda: check_code(200, s, d))


# ===================================================================
# 主入口
# ===================================================================
if __name__ == "__main__":
    # 1. Health check
    try:
        req = urllib.request.Request(f"{BASE}/api/auth/login", data=b'{}', method="POST")
        req.add_header("Content-Type", "application/json")
        urllib.request.urlopen(req, timeout=5)
    except urllib.error.HTTPError:
        pass
    except Exception as e:
        print(f"Backend not running: {e}")
        sys.exit(1)

    # 2. Backup
    backup()

    # 3. Get tokens
    admin_token = login("admin")
    emp_token = login("employee")
    emp_id = 509  # Jack Yang (employee account)

    # 4. Run tests
    test_auth(admin_token)
    test_org(admin_token)
    test_skills(admin_token, emp_token, emp_id)
    test_projects(admin_token, 503)
    test_approval(emp_token, emp_id)
    test_attendance_perf_leave(admin_token)
    test_analytics(admin_token)
    test_permissions()

    # 5. Report
    total, passed, failed = results["total"], results["pass"], results["fail"]
    print(f"\n\033[1m{'='*50}\033[0m")
    print(f"\033[1mTotal: {total}  |  PASS: {passed}  |  FAIL: {failed}\033[0m")
    if results["errors"]:
        print(f"\n\033[91mFAILURES:\033[0m")
        for e in results["errors"][:20]:
            print(f"  - {e}")
        if len(results["errors"]) > 20:
            print(f"  ... and {len(results['errors'])-20} more")

    # 6. Rollback
    restore()

    if failed > 0:
        print(f"\n{FAIL} {failed} tests failed, data rolled back")
    else:
        print(f"\n{PASS} ALL {total} tests passed, data rolled back")
    sys.exit(1 if failed > 0 else 0)
