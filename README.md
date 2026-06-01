# HRMS — 企业智能人事管理系统

> openGauss 7.0.0 + Python + React 19
> 技能驱动的人智平台 · 审批工作流 · 数据驱动决策

---

## 快速启动

```bash
# 1. 后端（port 18080）
cd backend
pip install psycopg2-binary  # 首次
python app.py

# 2. 前端（port 5173）
cd frontend-react
npm install      # 首次
npx vite --host 0.0.0.0 --port 5173
```

打开 `http://localhost:5173`，密码 `123456`。

---

## 架构总览

```
frontend-react/     React 19 + Tailwind CSS（4 个页面）
backend/
  src/
    server.py       路由分发（~90 条路由）
    services/       业务逻辑（8 个 service + 审批引擎）
    common/         psycopg2 直连、权限、HTTP 工具
sql/migrations/     迁移脚本（V1-V10）
docs/               关键设计文档（见下方索引）
```

### 四层

| 层 | 技术 | 核心 |
|---|------|------|
| 数据层 | openGauss 7.0.0 | 19 张表，DB4AI 离职预测，递归 CTE 组织树 |
| 业务层 | Python Service | 技能匹配（ProPer 加权点积）、离职风险评分、审批流 |
| API 层 | RESTful | 统一 `{code, message, data}`，`/api/org-people/*` |
| 前端层 | React 19 + Tailwind | 4 个路由，无 UI 库，受控组件 |

### 当前页面

| 路由 | 功能 |
|------|------|
| `/service-hall` | 办事大厅：发起申请（技能/请假/考勤/信息修改）+ 待审批 + 我的申请 |
| `/org-people` | 组织人员：部门树 → 岗位 → 员工卡片 → Profile 面板 |
| `/skills` | 技能管理：部门→岗位→技能需求添加、AI 推理 |
| `/analytics` | 数据分析：离职风险 + 技能缺口 + 考勤 + 绩效 |

---

## 关键设计决策

- **技能中心**：员工是技能载体，岗位是技能需求集合，匹配度 = 加权点积
- **Bundle API**：`GET /api/org/employee/{id}` 一次返回 7 域数据
- **审批工作流**：所有变更操作走审批（技能/请假/考勤/信息修改）
- **离职风险**：5 因子规则评分（敬业度/考勤/绩效/晋升/加班）+ DB4AI
- **psycopg2 直连**：取代 docker exec + gsql，API 响应从 0.69s 降至 0.25s

---

## 设计文档索引

所有关键文档在 `docs/` 目录下：

| 文件 | 说明 |
|------|------|
| `docs/000-总需求索引与缺失清单.md` | **43 项需求全索引**，模块 A-E 分类，42% 完成率，TOP 10 缺失 |
| `docs/100-全新系统设计.md` | **47KB 完整系统设计**——架构、数据、办事大厅、分析页、权限 |
| `docs/999-操作手册.md` | **34KB 操作手册**——后端 curl 指令、前端操作步骤、30+ 项验证清单 |
| `docs/audit-04-账号权限.md` | **18KB 账号权限报告**——所有账号、角色、权限矩阵 |

---

## 账号清单（密码统一 123456）

| 账号 | 角色 | 权限数 | 说明 |
|------|------|--------|------|
| `admin` / `ceo` | ADMIN | 27 | 所有权限 |
| `vp_eng` / `vp_product` / `vp_sales` / `vp_ops` / `eng_mgr` / `hr_mgr` | HR | 15 | 管理类操作 |
| `employee` | EMPLOYEE | 7 | 仅个人 |

---

## 当前项目状态

```
总体完成度：43 项需求中 18 项完成（42%）
```

### ✅ 已实现
- 组织人员（部门树、岗位过滤、员工卡片、Profile 面板）
- 办事大厅（4 种申请入口 + 待审批列表 + 我的申请）
- 技能管理（部门→岗位→技能添加、AI 推理）
- 数据分析（离职风险 + 技能缺口 + 因子分解 + 分页）
- 数据层（1144 条考勤、104 条绩效、20 条履历、263 条技能）
- 全局 401 拦截（token 过期自动跳登录）

### ❌ TOP 5 缺失
1. **审批回调空实现**——点了批准，什么都没发生（`_execute_payload` 为空）
2. **技能没真正接入审批**——POST/DELETE 改成了创建审批，但 GET 没跟审批状态联动
3. **权限 UI 缺失**——employee 登录跟 admin 看到完全一样的界面
4. **分析页不能下钻**——说了"敬业度低"但看不到原始考勤/绩效数据
5. **联系方式大面积 NULL**——Profile 面板没有数据可展示

详细缺失清单见 `docs/000-总需求索引与缺失清单.md`。

---

## 维护提示

```bash
# 端口清理（Windows zombie 进程）
netstat -ano | grep 18080 | grep LISTEN
taskkill /F /PID <PID>

# V10 审批表（重启后需重新应用）
docker cp sql/migrations/V10__approval_workflow.sql opengauss-hrms:/tmp/V10.sql
docker exec opengauss-hrms gsql -d hrms -U omm -W OpenGauss123! -f /tmp/V10.sql

# 操作手册
cat docs/999-操作手册.md | head -100
```
