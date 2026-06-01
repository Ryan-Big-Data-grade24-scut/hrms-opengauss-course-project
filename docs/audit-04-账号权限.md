# 安全审计报告：账号与权限系统

审计日期：2026-06-01
审计范围：认证系统、RBAC 数据、路由权限检查、数据访问范围
代码基准：`lrx_discover` 分支

---

## 1. 用户账号与密码

### 1.1 全部用户列表

| 用户名 | 全名 | 角色 | 状态 | 密码 |
|--------|------|------|------|------|
| admin | System Admin | ADMIN | 启用 | `sha256$8d969eef...` |
| ceo | Alex Chen | ADMIN | 启用 | 同上 |
| vp_eng | Sarah Wang | HR | 启用 | 同上 |
| vp_product | Oscar Lin | HR | 启用 | 同上 |
| vp_sales | Benny Cai | HR | 启用 | 同上 |
| vp_ops | Nina Qin | HR | 启用 | 同上 |
| hr_mgr | Owen Ren | HR | 启用 | 同上 |
| eng_mgr | Mike Zhang | HR | 启用 | 同上 |
| employee | Jack Yang | EMPLOYEE | 启用 | 同上 |

### 1.2 密码安全

**严重：所有 9 个账号密码完全相同。**

- 全部用户密码哈希一致：`sha256$8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92`
- 该哈希对应明文 `123456`（server.py 第 853 行也写明 "Demo login password: 123456"）
- 这是 demo 系统，可以理解，但必须记录为风险：一旦一个账号被攻破，所有账号都可被登录。

---

## 2. 角色权限矩阵

### 2.1 角色定义

| role_id | role_code | 说明 | 权限数 |
|---------|-----------|------|--------|
| 1 | ADMIN | 系统管理员 | 27 |
| 2 | HR | HR 管理员 | 16 |
| 3 | EMPLOYEE | 普通员工 | 7 |
| 4 | MANAGER | 部门经理 | 2 |
| 5 | CEO | CEO/超级管理员 | 27 |

### 2.2 角色-权限详细映射

#### ADMIN / CEO（27 权限，完全相同）

| 权限代码 | 权限名称 |
|----------|----------|
| analytics.view | 查看分析数据（路由检查） |
| analytics.view.all | 查看全部分析 |
| analytics.view.team | 查看团队分析 |
| attendance.manage | 管理考勤 |
| attendance.view.all | 查看全部考勤 |
| attendance.view.self | 查看个人考勤 |
| attendance.view.team | 查看团队考勤 |
| audit.view | 审计查看 |
| department.manage | 部门管理 |
| directory.view | 查看通讯录 |
| employee.manage | 员工管理 |
| leave.manage | 请假管理 |
| org.view | View Org |
| performance.view.self | 查看个人绩效 |
| performance.view.team | 查看团队绩效 |
| predict.view | View Predictions |
| profile.edit.all | 编辑全部信息 |
| profile.edit.self | 编辑个人信息 |
| profile.edit.team | 编辑团队信息 |
| profile.view.all | 查看全部信息 |
| profile.view.self | 查看个人信息 |
| profile.view.team | 查看团队信息 |
| skill.manage.all | 管理全部技能 |
| skill.manage.team | 管理团队技能 |
| skill.view | View Skills |
| skill.view.self | 查看个人技能 |
| user.manage | 用户管理 |

问题：`ceo` 用户绑定的角色是 ADMIN，不是 CEO。两者权限完全相同，但概念混淆。

#### HR（16 权限）

| 权限代码 |
|----------|
| analytics.view |
| analytics.view.team |
| attendance.manage |
| attendance.view.team |
| audit.view |
| department.manage |
| directory.view |
| employee.manage |
| leave.manage |
| performance.view.team |
| predict.view |
| profile.edit.team |
| profile.view.team |
| skill.manage.team |
| skill.view |
| skill.view.self |

HR 没有 `analytics.view.all`、`attendance.view.all`、`profile.edit.all`、`profile.view.all`、`skill.manage.all`、`user.manage`。

#### EMPLOYEE（7 权限）

| 权限代码 |
|----------|
| attendance.view.self |
| leave.manage |
| performance.view.self |
| profile.edit.self |
| profile.view.self |
| skill.view |
| skill.view.self |

#### MANAGER（2 权限——**已废弃，无用户绑定**）

| 权限代码 |
|----------|
| analytics.view |
| leave.manage |

**严重：MANAGER 角色定义了但没有任何用户被赋予该角色。**

### 2.3 用户-角色绑定的问题

- `vp_eng`, `vp_product`, `vp_sales`, `vp_ops` 全部是 VP 级别，但都绑定 HR 角色。这意味着他们拥有 HR 的团队级管理权限，如果系统需要区分职能 VP 和 HR 操作，则权限过大。
- `eng_mgr`（工程经理）绑定的是 HR 角色而不是 MANAGER 角色——MANAGER 角色已废弃。

---

## 3. 路由权限检查清单

以下为 `server.py` 中所有 `_require_permission` 调用点的遍历审查。

### 3.1 权限路由清单

| 路由 | 方法 | 检查的权限 | DB 中是否存在？ | 效果 |
|------|------|-----------|----------------|------|
| `/api/users` | GET | user.manage | 是 (ID=1) | 正常 |
| `/api/users` | POST | user.manage | 是 | 正常 |
| `/api/users/{id}` | PUT | user.manage | 是 | 正常 |
| `/api/users/{id}` | DELETE | user.manage | 是 | 正常 |
| `/api/roles` | GET | user.manage | 是 | 正常 |
| `/api/users/{id}/roles` | PUT | user.manage | 是 | 正常 |
| `/api/departments` | GET/POST | department.manage | 是 (ID=3) | 正常 |
| `/api/departments/{id}` | PUT/DELETE | department.manage | 是 | 正常 |
| `/api/positions` | GET/POST | department.manage | 是 | 正常 |
| `/api/positions/{id}` | PUT/DELETE | department.manage | 是 | 正常 |
| `/api/employees` | GET/POST | employee.manage | 是 (ID=2) | 正常 |
| `/api/employees/{id}` | GET/PUT/DELETE | employee.manage | 是 | 正常 |
| `/api/employees/{id}/profile` | GET/PUT | employee.manage | 是 | 正常 |
| `/api/employees/{id}/job-history` | GET/POST | employee.manage | 是 | 正常 |
| `/api/employees/{id}/projects` | GET/POST | employee.manage | 是 | 正常 |
| `/api/locations` | GET/POST | department.manage | 是 | 正常 |
| `/api/locations/{id}` | GET/PUT/DELETE | department.manage | 是 | 正常 |
| `/api/jobs` | GET/POST | department.manage | 是 | 正常 |
| `/api/jobs/{id}` | GET/PUT/DELETE | department.manage | 是 | 正常 |
| `/api/leave-types` | GET/POST | leave.manage | 是 (ID=4) | 正常 |
| `/api/leave-types/{id}` | GET/PUT/DELETE | leave.manage | 是 | 正常 |
| `/api/leaves` | GET/POST | leave.manage | 是 | 正常 |
| `/api/leaves/{id}/approve|reject` | PUT | leave.manage | 是 | 正常 |
| `/api/audits` | GET | audit.view | 是 (ID=5) | 正常 |
| **`/api/attendance/records`** | **GET** | **attendance.view** | **否！** | **全部拒绝 (403)** |
| `/api/attendance/summary` | GET | analytics.view | 是 (ID=25) | 正常 |
| `/api/attendance/sync` | POST | analytics.view | 是 | 正常 |
| **`/api/performance/reviews`** | **GET** | **performance.view** | **否！** | **全部拒绝 (403)** |
| **`/api/performance/reviews`** | **POST** | **performance.manage** | **否！** | **全部拒绝 (403)** |
| **`/api/performance/reviews/{id}`** | **PUT** | **performance.manage** | **否！** | **全部拒绝 (403)** |
| `/api/performance/summary` | GET | analytics.view | 是 | 正常 |
| `/api/performance/sync` | POST | analytics.view | 是 | 正常 |
| `/api/skills` / categories | POST | **skill.manage** | **否！** | **全部拒绝 (403)** |
| `/api/skills/{id}` | PUT/DELETE | **skill.manage** | **否！** | **全部拒绝 (403)** |
| `/api/skills/categories/{id}` | PUT/DELETE | **skill.manage** | **否！** | **全部拒绝 (403)** |
| `/api/employees/skills` | POST/DELETE | **skill.manage** | **否！** | **全部拒绝 (403)** |
| `/api/skills/infer/{id}` | POST | **skill.manage** | **否！** | **全部拒绝 (403)** |
| `/api/attrition/risk` | GET | analytics.view | 是 | 正常 |
| `/api/attrition/summary` | GET | analytics.view | 是 | 正常 |
| `/api/attrition/flags` | GET | analytics.view | 是 | 正常 |
| `/api/attrition/drivers` | GET | analytics.view | 是 | 正常 |
| `/api/attrition/distribution` | GET | analytics.view | 是 | 正常 |
| `/api/attrition/snapshot` | POST | analytics.view | 是 | 正常 |
| `/api/attrition/history/{id}` | GET | analytics.view | 是 | 正常 |
| `/api/analytics/department-health` | GET | analytics.view | 是 | 正常 |
| `/api/analytics/risk-trends` | GET | analytics.view | 是 | 正常 |
| `/api/analytics/critical-persons` | GET | analytics.view | 是 | 正常 |
| `/api/skills/gap/department/{id}` | GET | analytics.view | 是 | 正常 |
| `/api/skills/gap/enhanced` | GET | analytics.view | 是 | 正常 |
| `/api/org/hierarchy` | GET | employee.manage | 是 | 正常 |
| `/api/org/employee/{id}` | GET | employee.manage | 是 | 正常 |

### 3.2 严重发现：权限代码与 DB 不匹配

**4 个权限代码在 DB 中不存在，导致对应路由对全员返回 403：**

1. **`attendance.view`** —— DB 只有 `attendance.view.self` / `.team` / `.all`，没有基础代码。导致 `GET /api/attendance/records` 无人可用。
2. **`performance.view`** —— DB 只有 `performance.view.self` / `.team`，没有基础代码。导致 `GET /api/performance/reviews` 无人可用。
3. **`performance.manage`** —— DB 中不存在任何形式。导致 `POST /api/performance/reviews` 和 `PUT /api/performance/reviews/{id}` 无人可用。
4. **`skill.manage`** —— DB 只有 `skill.manage.all` / `.team`，没有基础代码。导致所有技能管理路由（约 9 个端点）无人可用。

**审计推测：** 这是一个近期重构遗留问题——原本的 `.self/.team/.all` 层级设计与扁平检查混用了。DB 种子数据中的权限是带后缀的细粒度版本，但 `server.py` 中的 `_require_permission` 使用的是不带后缀的粗粒度代码。修复方案要么改种子数据添加基础权限代码，要么改路由检查匹配带后缀的代码。

---

## 4. 无认证（公开）端点

以下路由完全跳过 `_require_auth`，不需要任何登录即可访问：

| 路由 | 方法 | 风险 |
|------|------|------|
| `/api/auth/login` | POST | 正常，登录必须公开 |
| `/api/auth/profile` | GET | 低，但需 token 才能获取 profile |
| `/api/auth/logout` | POST | 低 |
| `/api/profile/self` | GET | **中**——无需认证即可获取绑定 employee bundle 信息（含技能、职位匹配、流失风险） |
| `/api/profile/contact` | PUT | **高**——无认证即可修改员工联系方式（phone/email/birth_date） |
| `/api/directory/tree` | GET | 低，组织架构树是公开信息 |
| `/api/directory/search` | GET | 低 |
| `/api/directory/filters` | GET | 低 |
| `/api/v2/org-people/tree` | GET | 低 |
| `/api/v2/org-people/search` | GET | 低 |
| `/api/v2/org-people/filters` | GET | 低 |
| `/api/v2/org-people/positions` | GET | 低 |
| `/api/v2/org-people/employees` | GET | **中**——无需认证即可查看员工列表 |
| `/api/v2/org-people/employee/{id}/profile` | GET | **高**——无需认证即可查看任意员工完整档案 |
| `/api/skills` | GET | 低 |
| `/api/skills/categories` | GET | 低 |
| `/api/skills/recommend` | GET | 低 |
| `/api/employees/skills` | GET | **中**——无需认证即可查看任意员工技能 |
| `/api/match/employee` | GET | 低 |
| `/api/skills/gap` | GET | **中**——无需认证即可查看组织技能差距分析 |
| `/api/skills/heatmap` | GET | **中** |
| `/api/skills/analytics/overview` | GET | **中**——无需认证即可查看组织技能概览 |
| `/api/skills/analytics/department-comparison` | GET | **中** |
| `/api/predict/attrition` | GET | **高**——无需认证即可查看全部员工流失预测 |
| `/api/predict/attrition/train` | POST | **高**——无需认证即可触发模型训练 |
| `/api/predict/model` | GET | 低 |
| `/api/org/tree` | GET | 低 |
| `/api/org/network` | GET | **中**——无需认证即可查看组织网络关系 |
| `/api/org/critical` | GET | **中**——无需认证即可查看关键人员 |
| `/api/org/departments` | GET | 低 |
| `/api/attendance/clock` | POST | **中**——无认证即可打卡（需 employee_id） |
| `/api/attendance/my` | GET | **中**——无认证即可查看考勤记录 |
| `/api/performance/my` | GET | **中**——无认证即可查看绩效记录 |
| `/api/v2/approval-requests/pending` | GET | **高**——无认证但代码实际调用了 `user["username"]`，未认证时会抛 KeyError 导致 500 错误 |
| `/api/v2/approval-requests/my` | GET | **高** |
| `/api/v2/approval-requests/done` | GET | **高** |
| `/api/v2/approval-requests/{id}/logs` | GET | **高** |
| `/api/v2/approval-requests/{id}/approve|reject` | PUT | **高** |
| `/api/v2/approval-requests/{id}/recall` | PUT | **高** |
| `/api/approval-requests/pending` | GET | **高** |
| `/api/approval-requests/my` | GET | **高** |
| `/api/approval-requests/done` | GET | **高** |
| `/api/approval-requests/{id}/logs` | GET | **高** |
| `/api/approval-requests/{id}/approve|reject` | PUT | **高** |
| `/api/approval-requests/{id}/recall` | PUT | **高** |
| `/api/approval-requests` | POST | **高**——无认证即可提交审批 |
| `/api/backups` | GET/POST | **高**——无认证即可查看和创建备份 |
| `/api/restores` | POST | **高**——无认证即可触发恢复操作 |

**危害等级说明：** 以上路由中 `/api/v2/approval-requests/*` 和 `/api/approval-requests/*` 表面上无认证拦截，但实际上代码直接引用 `user["username"]`——若未登录（`_require_auth` 返回 None），会触发 `TypeError: 'NoneType' object is not subscriptable`，最终被 `except Exception` 捕获返回 500。但考虑到 `_dispatch` 中 `_require_auth` 只在第一个 auth 路由段后执行，这里的逻辑路径是先跳过了认证检查又使用了 user 对象。实际效果是这些端点要么返回 500，要么返回不可预测的结果。

---

## 5. 数据访问范围（Scope）检查实际效果

### 5.1 定义的 Scope 系统

`permission.py` 定义了 `_require_permission_scope` 函数，预期返回 `"self"` / `"team"` / `"all"`。

### 5.2 实际使用情况

4 个服务文件导入了 `_require_permission_scope`，但 **没有一个地方实际调用了它**：

- `attendance_service.py` —— 导入但未使用
- `org_service.py` —— 导入但未使用
- `performance_service.py` —— 导入但未使用
- `skill_service.py` —— 导入但未使用

### 5.3 后果

当前系统只有**两级访问控制**：
- **有权限** —— 可以访问该模块的所有数据（无 scope 过滤）
- **无权限** —— 完全拒绝

DB 中定义的 `*.self` / `*.team` / `*.all` 细粒度权限**没有实际生效**。例如：
- 一个 HR 如果只有 `attendance.view.team`，但 DB 中没有 `attendance.view`。如果修复了第 3.2 节的问题把 `attendance.view` 加进 DB，则一旦 HR 拥有此权限，就能看到全公司的所有考勤记录，而不仅限于其团队。

### 5.4 数据层缺乏行级过滤

所有 service 层的查询（如 `leave_service.list_leaves`）直接接受客户端传入的 `filters` 参数，不做当前用户的数据范围过滤。这意味着：
- 一个有 `leave.manage` 权限的 employee 可以通过传 `employee_id=5` 查看其他所有人的请假记录
- 没有任何代码限制用户只能查询自己/团队的数据

---

## 6. 关键风险总结

### 严重（Critical）

| # | 风险 | 影响 |
|---|------|------|
| C-1 | 所有账号同名密码 `123456` | 单点攻破 = 全部沦陷 |
| C-2 | `skill.manage` 权限代码在 DB 不存在 | 9 个技能管理路由全员 403，功能不可用 |
| C-3 | `performance.view` / `performance.manage` 在 DB 不存在 | 3 个绩效管理路由全员 403，功能不可用 |
| C-4 | `attendance.view` 在 DB 不存在 | 考勤记录查询路由全员 403，功能不可用 |
| C-5 | 约 30+ 个端点无认证即可访问 | 员工档案、技能、预测、审批、备份等数据完全公开 |

### 高（High）

| # | 风险 | 影响 |
|---|------|------|
| H-1 | 无 scope 数据过滤 | 有权限即可查看全部数据，`*.team`/`*.self` 权限代码形同虚设 |
| H-2 | EMPLOYEE 角色拥有 `leave.manage` | 普通员工可以审批/拒绝请假申请（`/api/leaves/{id}/approve`） |
| H-3 | MANAGER 角色无人绑定 | 部门经理的预设权限完全不可用 |
| H-4 | `/api/profile/contact` PUT 无认证 | 任何人可以修改任意员工联系方式 |
| H-5 | `/api/v2/org-people/employee/{id}/profile` 无认证 | 员工完整档案公开 |

### 中（Medium）

| # | 风险 | 影响 |
|---|------|------|
| M-1 | `ceo` 用户绑 ADMIN 角色非 CEO 角色 | 概念混淆，无法独立控制 CEO 权限 |
| M-2 | 所有 VP 用户绑定 HR 角色 | VP 权限与 HR 操作混同 |
| M-3 | `_require_permission_scope` 导入但未使用 | 20% 的代码是死代码 |

---

## 7. 修复建议

### 立即修复（破坏性）

1. **修复 DB 缺失的权限代码**
   - 在 `sys_permission` 中添加 `attendance.view`、`performance.view`、`performance.manage`、`skill.manage`
   - 或者在 `server.py` 中将 `_require_permission` 检查改为带后缀的代码（如检查 `attendance.view.self` + `.team` + `.all` 的并集）

2. **为所有敏感端点添加认证**
   - `/api/profile/self`、`/api/profile/contact` 必须走 `_require_auth`
   - 所有 `/api/approval-requests/*` 和 `/api/v2/approval-requests/*` 必须走 `_require_auth`
   - 所有 `/api/predict/*` 必须走 `_require_auth`
   - `/api/backups` 和 `/api/restores` 必须走 `_require_permission`

3. **实现 scope 数据过滤**
   - 在 server.py 的路由 handler 中调用 `_require_permission_scope` 获取 scope
   - 将 scope 传入 service 层，在 SQL 查询中加入 department/employee 过滤条件

### 短期修复

4. **权限最小化**
   - 移除 EMPLOYEE 角色的 `leave.manage` 权限，改为仅 `leave.create` 等细粒度权限
   - 为 MANAGER 角色绑定用户（如 eng_mgr 应绑定 MANAGER 而非 HR）
   - 区分 VP 角色和 HR 角色

5. **密码策略**
   - 为每个用户分配独立密码
   - 添加密码强度要求（测试环境可豁免，但生产环境必须）
   - 密码哈希应使用 bcrypt 或 argon2，而非纯 SHA256

6. **清理死代码和废弃角色**
   - 删除 `permission.py` 中未使用的 `_require_permission_scope`（或真正实现它）
   - 决定 MANAGER 角色的处置（启用或删除）
