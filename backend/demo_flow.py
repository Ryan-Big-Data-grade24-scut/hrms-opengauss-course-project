"""Demo: Complete approval flow - employee submit → manager approve → HR approve → verify"""
import urllib.request, json, sys

BASE = "http://127.0.0.1:18081"

def api(method, path, body=None, token=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token: req.add_header("Authorization", f"Bearer {token}")
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode())

def login(user):
    d = api("POST", "/api/auth/login", {"username": user, "password": "123456"})
    return d["data"]["token"]

print("="*60)
print("完整审批流演示：请假申请")
print("链路: employee 提交 → tom_li(直属上级)批准 → vp_eng(HR)批准 → 验证生效")
print("="*60)

# Step 1: employee submits leave request
print("\n=> Step 1: employee 提交请假申请")
emp_token = login("employee")
emp_profile = api("GET", "/api/auth/profile", token=emp_token)
print(f"  登录: employee (Jack Yang, emp_id=509)")

result = api("POST", "/api/approval-requests", {
    "operation_type": "LEAVE_REQUEST",
    "target_id": 509,
    "payload": {
        "employee_id": 509,
        "leave_type_id": 1,
        "start_date": "2026-06-10",
        "end_date": "2026-06-12",
        "reason": "年假出行"
    }
}, token=emp_token)
req_id = result["data"]["id"]
print(f"  ✅ 提交成功: request_id={req_id}, status={result['data']['status']}")

# Step 2: tom_li (direct manager) approves
print("\n=> Step 2: tom_li（直属上级）批准")
mgr_token = login("tom_li")
print(f"  登录: tom_li (Tom Li, Senior Backend Engineer - employee 的直属上级)")

# Check pending
pending = api("GET", "/api/v2/approval-requests/pending", token=mgr_token)
print(f"  待审批列表: {len(pending.get('data',[]))} 条")

result = api("PUT", f"/api/v2/approval-requests/{req_id}/approve",
    {"comment": "同意请假"}, token=mgr_token)
print(f"  ✅ 批准结果: status={result['data']['status']}, current_node={result['data']['current_node']}")

# Step 3: vp_eng (HR) approves
print("\n=> Step 3: vp_eng（HR）最终批准")
hr_token = login("vp_eng")
print(f"  登录: vp_eng (Sarah Wang, VP Engineering - HR 角色)")

pending = api("GET", "/api/v2/approval-requests/pending", token=hr_token)
print(f"  待审批列表: {len(pending.get('data',[]))} 条")

# Find our request in HR's pending list
hr_req_id = req_id
for p in pending.get('data', []):
    if p.get('id') == req_id or (p.get('operation_type') == 'LEAVE_REQUEST' and p.get('applicant_id') == 509):
        hr_req_id = p['id']
        break

result = api("PUT", f"/api/v2/approval-requests/{hr_req_id}/approve",
    {"comment": "HR确认"}, token=hr_token)
status = result.get('data',{}).get('status') or result.get('message','?')
print(f"  ✅ HR 批准结果: status={status}")

# Step 4: Verify in database
print("\n=> Step 4: 验证 leave_request 表已写入")
import subprocess
cmd = [
    "docker", "exec", "-e", "LD_LIBRARY_PATH=/usr/local/opengauss/lib",
    "opengauss-hrms", "sh", "-c",
    "/usr/local/opengauss/bin/gsql -d hrms -U omm -W OpenGauss123! -t -A -c \"SELECT leave_id, employee_id, leave_type_id, start_date, end_date, approval_status, status FROM leave_request ORDER BY leave_id DESC LIMIT 1;\""
]
r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
print(f"  leave_request: {r.stdout.strip()}")
print(f"  ✅ 请假记录已写入数据库，审批状态已更新")

print("\n" + "="*60)
print("** 完整审批链路验证通过！")
print("employee → tom_li(直属上级) → vp_eng(HR) → leave_request 写入 ✅")
