# HRMS 后续开发任务执行计划

> 基于需求文档差距分析，按优先级排列的完整实施方案

---

## 📋 任务总览

```
Phase 1 (核心功能)    T1 Dashboard 统计卡片  →  T2 审批待办列表  →  T3 员工模糊搜索
       ↓
Phase 2 (体验增强)    T4 员工状态生命周期    →  T5 编制管理提示    →  T6 个人请假历史
       ↓
Phase 3 (加分项)      T7 组织架构可视化      →  T8 Token 持久化    →  T9 组织通讯录
```

---

## Phase 1：核心功能（高优先级）

### T1. HR Dashboard 统计卡片

**目标**：在首页聚合关键数据指标，回应"需求缺口三：数据沉默"

#### 后端改动

| 文件 | 改动内容 |
|---|---|
| `backend/src/services/report_service.py` | 新增 `get_dashboard_stats()` 方法，返回：员工总数、部门总数、在职人数/离职人数分布、待审批请假数、今日请假人数 |
| `backend/src/server.py` | 新增路由 `GET /api/dashboard/stats`，调用 `report_service.get_dashboard_stats()` |

**关键 SQL 示例**：
```sql
-- 员工统计
SELECT COUNT(*) as total,
       SUM(CASE WHEN employment_status='active' THEN 1 ELSE 0 END) as active,
       SUM(CASE WHEN employment_status='inactive' THEN 1 ELSE 0 END) as inactive
FROM employee;

-- 待审批数
SELECT COUNT(*) FROM leave_request WHERE approval_status='pending';
```

#### 前端改动

| 文件 | 改动内容 |
|---|---|
| `frontend/src/api/http.js` | 新增 `fetchDashboardStats()` 函数 |
| `frontend/src/views/` | 新建 `DashboardView.vue`，展示 4-5 个统计卡片 + 可选饼图/柱状图 |
| `frontend/src/router/index.js` | 将首页路由从 `/employees` 重定向改为 `/dashboard` |

**卡片设计**：
- 🧑‍💼 员工总数（含在职/离职对比）
- 🏢 部门总数
- 📋 待审批数（可点击跳转）
- 📊 各部门人数分布（简单柱状图）

---

### T2. 审批待办列表

**目标**：回应"需求缺口二：流程不闭环"，让审批流程真正可用

#### 后端改动

| 文件 | 改动内容 |
|---|---|
| `backend/src/services/leave_service.py` | 新增 `list_pending_leaves()` 方法，按审批状态筛选 |
| `backend/src/services/leave_service.py` | 新增 `list_my_leaves(user_id)` 方法，返回当前用户的请假记录 |
| `backend/src/server.py` | 新增路由 `GET /api/leaves/pending`（仅 HR/ADMIN 可见） |
| `backend/src/server.py` | 新增路由 `GET /api/leaves/mine`（所有登录用户可见） |

#### 前端改动

| 文件 | 改动内容 |
|---|---|
| `frontend/src/api/http.js` | 新增 `fetchPendingLeaves()` 和 `fetchMyLeaves()` |
| `frontend/src/views/LeavesView.vue` | 拆分 Tabs：全部请假 / 待我审批 / 我的申请 |
| `frontend/src/layouts/AppLayout.vue` | 侧边栏添加"待办"角标显示待审批数量 |

---

### T3. 员工模糊搜索

**目标**：回应需求全景中"查询 10 分 ⚠️ 模糊查/统计待补"

#### 后端改动

| 文件 | 改动内容 |
|---|---|
| `backend/src/services/employee_service.py` | 修改 `list_employees()` 的 `keyword` 筛选逻辑，使用 `ILIKE` 模糊匹配 `full_name`、`employee_no`、`phone`、`email` |

**改动前**：精确匹配特定字段
**改动后**：单个 keyword 参数同时模糊搜索多个字段

#### 前端改动

| 文件 | 改动内容 |
|---|---|
| `frontend/src/views/EmployeesView.vue` | 已有搜索输入框，确认 keyword 参数正确传递即可，几乎无需改动 |

---

## Phase 2：体验增强（中优先级）

### T4. 员工状态生命周期

**目标**：完善 P1 流程，支持入职→试用→转正→调动→离职状态流转

#### 后端改动

| 文件 | 改动内容 |
|---|---|
| `backend/src/services/employee_service.py` | 新增 `update_employee_status(employee_id, new_status, actor)` 方法 |
| `backend/src/services/employee_service.py` | 状态变更时自动写入 `employee_job_history` 记录 |
| `backend/src/server.py` | 新增路由 `PUT /api/employees/{id}/status` |

#### 前端改动

| 文件 | 改动内容 |
|---|---|
| `frontend/src/api/http.js` | 新增 `updateEmployeeStatus()` |
| `frontend/src/views/EmployeesView.vue` | 员工列表操作列新增"状态变更"按钮，弹窗选择新状态 |

---

### T5. 编制管理提示

**目标**：在部门/岗位列表显示 headcount vs 实际人数

#### 后端改动

| 文件 | 改动内容 |
|---|---|
| `backend/src/services/directory_service.py` | 修改 `list_departments()` 和 `list_positions()`，增加 `actual_headcount` 字段（通过子查询 COUNT 员工数） |

#### 前端改动

| 文件 | 改动内容 |
|---|---|
| `frontend/src/views/DepartmentsView.vue` | 新增列显示"编制/实际"，超编时红色高亮 |
| `frontend/src/views/JobsView.vue` | 新增列显示职位薪资区间 |

---

### T6. 个人请假历史

**目标**：员工自助查看自己的请假记录

#### 后端改动

| 文件 | 改动内容 |
|---|---|
| `backend/src/services/leave_service.py` | 已有 `list_leaves()` 支持 filters，确保按 `employee_id` 筛选可用 |

#### 前端改动

| 文件 | 改动内容 |
|---|---|
| `frontend/src/views/LeavesView.vue` | 在"我的申请" Tab 中已实现部分功能，需补充：状态筛选、时间范围筛选 |
| `frontend/src/views/ProfileView.vue` | 可选：在个人资料页嵌入"我的请假记录"快捷入口 |

---

## Phase 3：加分项（低优先级）

### T7. 组织架构可视化

**目标**：部门树形图展示，视觉效果好的加分项

#### 前端改动

| 文件 | 改动内容 |
|---|---|
| `frontend/src/views/` | 新建 `OrgChartView.vue`，使用递归组件或 Element Plus Tree 组件展示部门层级 |
| `frontend/src/router/index.js` | 新增路由 `/org-chart` |
| `frontend/src/api/http.js` | 已有 `fetchDepartments()` 可用，需确保返回数据包含 `parent_department_id` |

---

### T8. Token 持久化

**目标**：将内存级 TokenStore 改为数据库存储，提升系统可靠性

#### 后端改动

| 文件 | 改动内容 |
|---|---|
| `backend/src/common/security.py` | 将 `TokenStore` 改为基于数据库表的实现，新增 `auth_token` 表 |
| `backend/src/services/auth_service.py` | 修改 `login()` 写入 token 到数据库，`logout()` 删除，`get_profile()` 从数据库查询 |
| `sql/migrations/V5__auth_token_table.sql` | 新增迁移脚本创建 `auth_token` 表 |

---

### T9. 组织通讯录

**目标**：找同事功能，锦上添花

#### 前端改动

| 文件 | 改动内容 |
|---|---|
| `frontend/src/views/` | 新建 `DirectoryView.vue`，按部门分组展示员工姓名/岗位/联系方式 |
| `frontend/src/router/index.js` | 新增路由 `/directory` |
| `frontend/src/api/http.js` | 新增 `fetchDirectory()` |

#### 后端改动

| 文件 | 改动内容 |
|---|---|
| `backend/src/services/employee_service.py` | 新增 `list_directory()` 方法，按部门分组返回员工基本信息（脱敏） |
| `backend/src/server.py` | 新增路由 `GET /api/directory` |

---

## 🛠️ 技术约束与注意事项

1. **不改现有架构** — 保持 Python 标准库 `http.server`，不引入 Flask/FastAPI
2. **不改数据库驱动** — 继续使用 `gsql` + `json_agg` 模式，不引入 ORM
3. **不改前端依赖** — 继续使用 Vue 3 + Vite + Element Plus，不引入额外图表库（除非 T1 需要）
4. **审计全覆盖** — 所有新增的增删改操作必须调用 `audit_service.write_audit()`
5. **权限校验** — 所有新增端点必须在 `server.py` 中配置 `_require_permission()`

---

## 📈 预期产出

| Phase | 交付物 | 对应需求缺口 |
|---|---|---|
| Phase 1 | Dashboard 卡片 + 审批待办 + 模糊搜索 | 缺口一（信息碎片化）、缺口二（流程不闭环）、评分查询补全 |
| Phase 2 | 员工状态流转 + 编制提示 + 请假历史 | 完善 P1 流程、提升日常使用体验 |
| Phase 3 | 组织树 + Token 持久化 + 通讯录 | 视觉加分、系统可靠性提升 |
