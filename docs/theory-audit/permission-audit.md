# 数据库理论视角：HRMS 权限系统审计报告

> 审计基准：`lrx_discover_v2` 分支
> 审计日期：2026-06-06
> 审计视角：数据库理论与 SQL 标准（DAC/RBAC/三层模式）

---

## 一、当前权限系统的数据库实现全景

### 1.1 物理表结构

```
sys_user         — 用户（账号）
sys_role         — 角色定义
sys_permission   — 权限定义
sys_user_role    — 用户-角色关联（多对多）
sys_role_permission — 角色-权限关联（多对多）
```

### 1.2 权限流动路径

```
用户登录 → auth_service.login() 发起 bootstrap_rbac()
         → 从 sys_user_role → sys_role_permission → sys_permission
         → 将所有 permission_code 聚合成 JSON 数组，写入 JWT token
         → server.py._require_permission() 在请求时从 token 的 permissions 集合做集合成员检查
```

### 1.3 数据范围意图（但未执行）

```
permission.py._require_permission_scope()  — 已实现代码，但 0 次调用
                                             — 导入该函数的 4 个 service 全部未调用
                                             — 数据层 SQL 无 WHERE 子句注入
```

---

## 二、问题 1：是否实现了正确的 DAC（SQL GRANT/REVOKE 模型）？

### 2.1 SQL:1999 GRANT/REVOKE 标准的核心要求

| 标准要素 | SQL 标准要求 | 本系统实现 | 结论 |
|----------|--------------|-----------|------|
| 对象级权限（SELECT/INSERT/UPDATE/DELETE） | GRANT 到表/视图/列 | 未使用 | **缺失** |
| WITH GRANT OPTION | 允许权限转授 | 未实现 | **缺失** |
| CASCADE / RESTRICT | 级联回收行为 | 未实现 | **缺失** |
| REVOKE | 收回权限的操作 | 未实现（仅 DELETE sys_role_permission） | **缺失** |
| PUBLIC 特殊角色 | 向所有用户授权 | 未定义 | **缺失** |
| 列级 GRANT | 限制特定列可视性 | 未实现 | **缺失** |
| REFERENCES 权限 | 外键约束授权 | 未实现 | **缺失** |

### 2.2 实际实现是"应用层字符串匹配 RBAC"

当前系统完全绕过了数据库的 DAC 机制。权限控制全部位于应用层：

1. **权限存储**：权限表现为 `sys_permission.permission_code` 表中的字符串（如 `"employee.manage"`）
2. **权限检查**：在 `server.py._require_permission()` 中做 Python 集合的 `in` 操作
3. **无数据库级控制**：所有数据库用户（如 `omm`）拥有全部表权限，应用层 SQL 不需要通过 `GRANT` 限制

### 2.3 DAC 模型缺失的直接后果

- **无对象级保护**：任何人只要能连接到数据库（即使绕过应用），就能全量访问所有表。`omm` 用户是一个超管账户——没有 `GRANT SELECT ON employee TO hr_role` 这样的隔离。
- **无列级保护**：`employee` 表包含 salary、phone、email 等敏感列，但没有任何 GRANT 限制列读。
- **无级联回收**：权限变更时，系统直接 DELETE/INSERT `sys_role_permission`，不处理依赖视图或触发器。

### 2.4 结论

**不满足 DAC。** 系统实际上是一个"应用层扁平权限名检查"机制，与 SQL 标准定义的 GRANT/REVOKE DAC 模型无关。DB 的 DAC 能力完全未启用。

---

## 三、问题 2：外模式（External Schema）是否正确分离了用户视图？

### 3.1 三层模式架构回顾

```
外模式 (External Schema)   — 不同用户看到的个性化数据视图
  ↓ 映射
概念模式 (Conceptual Schema) — 核心表结构（如 employee, department）
  ↓ 映射
内模式 (Internal Schema)   — 物理存储结构
```

### 3.2 本系统中"外模式"的实现现状

当前系统**完全没有使用数据库视图**来实现外模式。作为替代，系统采用：

- **API 路由作为隐式外模式**：不同的路由返回不同的 JSON 投影（如 `/api/profile/self` 只返回个人信息）
- **服务层 SQL 作为隐式视图映射**：service 函数直接发 SQL 到基表，没有中间的 VIEW 层

#### 3.2.1 正面的例子

```
/api/attendance/my       → 只返回当前用户的考勤记录 (employee_id from token)
/api/performance/my      → 只返回当前用户的绩效 (employee_id from token)
```

这些是"伪外模式"——API 层做了过滤，但底层直接查基表。

#### 3.2.2 严重缺失的例子

| 缺失 | 说明 | 危害 |
|------|------|------|
| 无员工敏感列脱敏视图 | salary、phone、email 在基表中明文存储，无 VIEW 屏蔽 | 一旦绕过 API，敏感列全量暴露 |
| 无部门隔离视图 | 没有 `VIEW dept_employees AS SELECT ... WHERE dept_id = current_user_dept()` | 所有 SQL 查询直接访问基表 |
| 无角色基视图 | 没有 `VIEW hr_employee_view` / `VIEW emp_self_view` 等 | 每个 service 手写不同的 SELECT 子句 |
| 无审计视图 | 没有 `VIEW audit_employee_changes` 这类封装 | 审计查询直接访问 `audit_log` 基表 |

### 3.3 三个关键视图的缺失与修复建议

按 SQL 标准，应当为每种用户角色创建数据库视图作为外模式：

```sql
-- 缺失视图 1：HR 角色的外模式（含 salary，可控脱敏）
CREATE VIEW hr_employee_view AS
SELECT employee_id, employee_no, full_name, gender,
       phone, email, hire_date, employment_status,
       department_id, position_id,
       salary  -- HR 可见
FROM employee;

-- 缺失视图 2：普通员工的外模式（无 salary，无他人 phone/email）
CREATE VIEW emp_self_view AS
SELECT employee_id, employee_no, full_name, gender,
       hire_date, employment_status, department_id, position_id
FROM employee
WHERE employee_id = current_setting('app.emp_id')::int;

-- 缺失视图 3：部门经理的外模式（可见本部门员工基本信息，salary 脱敏）
CREATE VIEW mgr_dept_view AS
SELECT e.employee_id, e.employee_no, e.full_name, e.gender,
       e.hire_date, e.employment_status, e.department_id, e.position_id,
       CASE WHEN current_setting('app.role') = 'hr_admin' THEN e.salary
            ELSE NULL END AS salary
FROM employee e
WHERE e.department_id = (
    SELECT department_id FROM employee WHERE employee_id = current_setting('app.emp_id')::int
);
```

### 3.4 结论

**外模式缺席。** 当前代码没有`CREATE VIEW`定义，完全靠应用层 SQL 拼接实现"数据投影"。这在数据库理论层面属于"概念模式直接暴露给应用层"的反模式。后果是：
- 无法独立于应用层做安全策略修改
- 无法利用数据库的视图封装实现列级脱敏
- APP 层的 SQL 直通所有基表，绕过 API 即绕过所有保护

---

## 四、问题 3：是否有正确的角色层次结构？

### 4.1 SQL:1999 定义的角色层次

SQL:1999 标准要求角色层次通过 `GRANT role TO another_role` 实现：

```sql
CREATE ROLE employee;
CREATE ROLE manager;
CREATE ROLE hr_admin;

GRANT employee TO manager;     -- manager 继承 employee 的所有权限
GRANT manager TO hr_admin;     -- hr_admin 继承 manager 的所有权限
```

### 4.2 本系统的角色实现

#### 4.2.1 扁平角色——无层次

```
sys_role 表:
  role_id=1, role_code='ADMIN'      — 27 permissions
  role_id=2, role_code='HR'         — 16 permissions
  role_id=3, role_code='EMPLOYEE'   — 7 permissions
  role_id=4, role_code='MANAGER'    — 2 permissions（废弃，无用户绑定）
  role_id=5, role_code='CEO'        — 27 permissions（与 ADMIN 完全相同）
```

每个角色的权限集是**独立的**、**硬编码的**。不存在继承关系：
```sql
-- 实际行为（非继承）：
-- ADMIN 有 27 个权限：employee.manage + department.manage + ...
-- HR 有 16 个权限：employee.manage + department.manage + ...
-- 两者的 employee.manage 是同一个 permission_id 上的两条独立记录
```

#### 4.2.2 实际数据——手动重复

```sql
-- sys_role_permission 中的数据：
-- ADMIN: (1, 1), (1, 2), (1, 3), ..., (1, 27)
-- HR:    (2, 1), (2, 2), (2, 3), ...（仅前16个）
-- 不是通过 GRANT role TO role 实现继承，而是逐条重复 INSERT
```

#### 4.2.3 严重问题

| 问题 | 说明 |
|------|------|
| 无继承 | 理论上 `EMPLOYEE -> MANAGER -> HR -> ADMIN` 是一对多包含链，但代码没有实现 |
| CEO 冗余 | `CEO` 和 `ADMIN` 角色完全相同，由同一段 SQL 赋予 `ALL PERMISSIONS` |
| MANAGER 僵尸 | `MANAGER` 角色已定义但无用户绑定，无实际用途 |
| 无 SET ROLE 机制 | 用户不能动态切换角色（如 "以员工身份登录，临时切换到经理角色审批"） |

### 4.3 标准的角色层次应如何设计

```
CEO (role_id=5)
  ↑ 继承
ADMIN (role_id=1)        — system operations
  ↑ 继承
HR_MANAGER (role_id=?)   — HR department management
  ↑ 继承
HR_EMPLOYEE (role_id=?)  — HR base operations
  ↑ 继承
MANAGER (role_id=4)      — department-level management
  ↑ 继承
EMPLOYEE (role_id=3)     — self-service only
```

每一层只定义**增量权限**，通过 `GRANT lower_role TO higher_role` 实现传递。

### 4.4 结论

**角色层次缺失。** 当前系统是"扁平权限集合"而非"层级角色继承"。这导致：
- 权限管理中，如果 EMPLOYEE 新增一个权限，必须手动加到 HR 和 ADMIN 的种子 SQL 中
- 权限膨胀不可避免（每个新功能，N 个角色的种子文件都需要同步更新）
- 无法利用 `SET ROLE` 实现安全降权操作

---

## 五、问题 4：三层模式（Three-Schema Architecture）的完整合规性

### 5.1 三层模式架构检查清单

```
┌──────────────────────────────────────────────────────────┐
│  外模式 (External Schema)                                 │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ emp_self_view    │  │ mgr_view     │  │ hr_view      │ │
│  │ (自己的基本信息)  │  │ (团队信息)    │  │ (全部+salary) │ │
│  └────────┬────────┘  └──────┬───────┘  └──────┬───────┘ │
└───────────┼──────────────────┼──────────────────┼─────────┘
            │                  │                  │
            ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────┐
│  概念模式 (Conceptual Schema)                              │
│  employee, department, position, leave_request, ...       │
│  sys_user, sys_role, sys_permission, sys_user_role,       │
│  sys_role_permission                                      │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  内模式 (Internal Schema)                                  │
│  openGauss 物理存储，索引，分区，主键约束                   │
└──────────────────────────────────────────────────────────┘
```

### 5.2 评估结果

| 层级 | 状态 | 评分 | 说明 |
|------|------|------|------|
| **概念模式** | 已定义 | **8/10** | 表结构清晰，但有冗余（role_code: ADMIN vs CEO 重复） |
| **外模式** | 缺失 | **0/10** | 未定义任何数据库 VIEW，靠 API 层拼接 |
| **内模式** | 基本 | **5/10** | 有索引，但缺少分区、物化视图等高级特性 |

### 5.3 具体缺失项

#### 5.3.1 外模式缺失细节

按数据库理论，HRMS 至少需要以下视图作为外模式：

| 视图名 | 目标用户 | 基础表 | 行过滤 | 列屏蔽 |
|--------|----------|--------|--------|--------|
| `emp_self_info` | EMPLOYEE | employee | `WHERE employee_id = session_user` | 无 salary/phone |
| `emp_team_info` | MANAGER | employee | `WHERE department_id = session_dept` | 无 salary |
| `emp_full_info` | HR/ADMIN | employee | 全部 | 全部可见 |
| `leave_self_view` | EMPLOYEE | leave_request | `WHERE employee_id = session_user` | - |
| `leave_dept_view` | MANAGER | leave_request | `WHERE department_id = session_dept` | - |
| `skill_self_view` | EMPLOYEE | employee_skill | `WHERE employee_id = session_user` | - |
| `audit_self_view` | EMPLOYEE | audit_log | `WHERE username = session_user` | 无敏感字段 |
| `salary_conf_view` | HR/ADMIN | employee_salary | 全部 | salary 列可见 |

#### 5.3.2 概念模式问题

- **CEO vs ADMIN 角色重复**：role_id = 1 和 5 指向同样的 27 个权限代码，但 role_code 不同，违反唯一语义
- **缺少角色层次表**：概念模式没有 `sys_role_hierarchy(role_id, parent_role_id)` 这样的关系
- **缺少权限分类表**：权限名使用点号分隔（如 `attendance.view.self`），但数据库层面没有 schema 约束这些命名规则

#### 5.3.3 内模式问题

- **索引完整，但缺少 RLS 支持**：openGauss（基于 PostgreSQL）支持行级安全策略（CREATE POLICY），但未被使用
- **无分区策略**：audit_log 和 leave_request 随业务增长会快速膨胀，但未定义分区

### 5.4 三层模式修复路径

```
Phase 1: 定义外模式视图
  - CREATE VIEW emp_self AS SELECT ... FROM employee WHERE employee_id = SESSION_EMP_ID
  - 授权适用角色

Phase 2: 修复概念模式
  - 删除冗余 role_code = 'CEO'
  - 新增 sys_role_hierarchy 表
  - 新增权限分类元数据

Phase 3: 启用内模式 RLS
  - ALTER TABLE employee ENABLE ROW LEVEL SECURITY;
  - CREATE POLICY dept_isolation ON employee USING (department_id = SESSION_DEPT_ID)
```

---

## 六、综合数据库理论评价

### 6.1 评分矩阵

| 维度 | 权重 | 分数 | 加权得分 |
|------|------|------|----------|
| DAC (GRANT/REVOKE) 合规 | 30% | 1/10 | 0.3 |
| 外模式（视图分离） | 20% | 0/10 | 0.0 |
| 角色层次结构 | 20% | 2/10 | 0.4 |
| 三层模式完整性 | 15% | 3/10 | 0.45 |
| 行级安全 (RLS) | 15% | 0/10 | 0.0 |
| **综合评分** | **100%** | | **1.15/10** |

### 6.2 核心发现总结

**(1) DAC 完全未使用。** 系统将所有权限检查放在应用层，数据库层面没有 GRANT/REVOKE 隔离。任何直连数据库的用户都能绕过所有保护。这是最严重的问题——在数据库理论中，这意味着"数据库没有自己的安全边界"。

**(2) 外模式等于零。** 系统没有创建任何数据库视图。应用层通过不同 API 路由返回不同的 JSON 投影，但这不等同于外模式——APP 层的 SQL 语句直接访问基表，没有中间视图做安全屏障。

**(3) 角色层次是扁平映射，而非继承树。** 角色之间的权限关系通过重复的种子 SQL 维护，无法利用 SQL:1999 的 GRANT role TO role 实现自动继承。

**(4) 行级安全未启用。** openGauss 支持 PostgreSQL 兼容的 CREATE POLICY / ALTER TABLE ENABLE ROW LEVEL SECURITY 机制，但代码中没有任何策略定义。`permission.py._require_permission_scope` 函数虽然有实现意图，但从未被调用。

**(5) 三层模式架构不完整。** 只有概念模式和内模式得到部分实现，外模式完全缺失。

### 6.3 与理论研究的差距

对比 `research-access-control.md` 中的"HRMS 系统推荐的三层叠加安全架构"：

```
理论推荐架构：                         实际实现：
┌─────────────────────┐              ┌─────────────────────┐
│ Layer 1: 认证+会话   │ ✅ 有        │ JWT token + auth    │
├─────────────────────┤              ├─────────────────────┤
│ Layer 2: RBAC       │ ⚠️ 部分     │ 扁平 permissions     │
│   GRANT + 列级权限   │ ❌ 无        │ 无 GRANT            │
│   角色层次           │ ❌ 无        │ 无继承              │
├─────────────────────┤              ├─────────────────────┤
│ Layer 3: RLS        │ ❌ 无        │ 无 POLICY           │
│   多租户隔离         │ N/A         │ (非多租户)           │
│   组织层级隔离       │ ❌ 无        │ scope 函数未启用     │
└─────────────────────┘              └─────────────────────┘
```

### 6.4 附录：关键文件路径

| 文件 | 作用 |
|------|------|
| `E:\Ufolder\Current\ActionSys\Hgclass\DB\backend\src\server.py` | 应用层路由和权限检查（_require_permission, 858行） |
| `E:\Ufolder\Current\ActionSys\Hgclass\DB\backend\src\common\permission.py` | 未启用的 scope 检查函数（18-83行） |
| `E:\Ufolder\Current\ActionSys\Hgclass\DB\backend\src\services\auth_service.py` | 认证+RBAC 组装（login, 42行） |
| `E:\Ufolder\Current\ActionSys\Hgclass\DB\sql\10_hrms_schema.sql` | 概念模式定义（角色/权限表） |
| `E:\Ufolder\Current\ActionSys\Hgclass\DB\sql\migrations\V6__company_seed.sql` | RBAC 种子数据 |
| `E:\Ufolder\Current\ActionSys\Hgclass\DB\sql\migrations\V9__permissions_seed.sql` | 18 个新 scope 权限 + 4 个路由权限补丁 |
| `E:\Ufolder\Current\ActionSys\Hgclass\DB\docs\audit-04-账号权限.md` | 前次安全审计（代码层面） |
| `E:\Ufolder\Current\ActionSys\Hgclass\hrms-design\theory\research-access-control.md` | 理论研究报告 |
