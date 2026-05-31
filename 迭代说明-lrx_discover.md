# lrx_discover 分支迭代说明

> 给队友：这周在 lrx_discover 分支上做了一系列重构和功能更新，以下是核心变化。

---

## 一、设计哲学：从"人事管理"到"技能驱动"

**原来（master）：** 传统的人事管理系统，围绕"部门→岗位→员工"的层级结构组织数据。员工是"占位符"，核心操作是增删改查。

**现在（lrx_discover）：** 以**技能**为中心的人智平台。核心逻辑：
- 员工是**技能的载体**
- 岗位是**技能需求的集合**  
- 匹配度 = 员工技能 × 岗位需求的加权点积（ProPer 算法）
- 离职风险 = 多因子评分（敬业度、考勤、绩效、晋升延迟、加班、换经理）

```
原来：  部门 → 岗位 → 员工（谁在这个位置上）
现在：  技能 ← 员工 → 岗位匹配度（谁最能干这个活）
```

---

## 二、架构变更：四层设计

### 数据层（SQL + openGauss 特性）

| 新增表 | 用途 |
|--------|------|
| `attendance_record` | 考勤打卡（clock_in/clock_out 分离） |
| `performance_review` | 绩效评价（单维度评分） |
| `attrition_history` | 离职风险快照（ML 训练数据） |

利用 openGauss 特性：
- **DB4AI**: `CREATE MODEL attrition_model ...` 直接在数据库内训练离职预测模型
- **Apache AGE**: 递归 CTE 实现组织树查询
- **DataVec**: 技能匹配的向量索引

### 后端层（Service 模式）

```
backend/src/services/
  ├── org_service.py         组织树 + 员工 Bundle（7 域合一）
  ├── skill_service.py       技能 CRUD + 匹配度 + 缺口分析
  ├── directory_service.py   通讯录（跨字段 ILIKE 搜索）
  ├── attrition_service.py   离职风险（规则评分 + ML 信号）
  ├── attendance_service.py  考勤记录（新增）
  ├── performance_service.py 绩效评价（新增）
  ├── analytics_service.py   聚合分析（新增）
  ├── auth_service.py        登录 + 权限 scope
  └── predict_service.py     DB4AI 模型训练/预测
```

### API 层（RESTful）

- 统一响应格式：`{code, message, data}`
- 分页参数：`page` + `page_size`
- Bundle 接口：`GET /api/org/employee/{id}`（单次请求返回员工 + 技能 + 匹配 + 风险 + 汇报关系 + 履历）
- 权限 scope：`{resource}.{action}.{scope}`（self/team/all）

### 前端层（React + Tailwind CSS）

| 路由 | 页面 | 功能 |
|------|------|------|
| `/profile` | 个人中心 | 员工选择器 + 技能条 + 最佳匹配岗位 |
| `/directory` | 通讯录 | 三栏布局：部门树 \| 搜索+卡片 \| Profile 面板 |
| `/org` | 组织架构 | 部门→岗位→员工层级 |
| `/skills` | 技能管理 | 技能 CRUD + 工作履历 + AI 推理 |
| `/analytics` | 数据分析 | 离职预警 + 技能覆盖率 |

---

## 三、关键性能优化

### 1. psycopg2 直连（最大的性能提升）

**原来：** 每次 SQL 查询都执行 `docker exec opengauss-hrms gsql ...`，每次额外开销 **0.4 秒**。

**现在：** `psycopg2.ThreadedConnectionPool` 直连 openGauss（兼容 PostgreSQL 协议）。

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 平均 API 响应 | 0.69s | **0.25s** | **2.8x** |
| 最慢端点 | 1.08s | **0.28s** | **3.9x** |

**注意：** openGauss 禁止初始用户 `omm` 远程 TCP/IP 连接，所以新建了 `hrms_app` 用户。密码在 `config.py` 里。

### 2. Bundle 批量 SQL

**原来：** `get_employee_bundle()` 先后调 7 个 service 方法 → 7 次独立 SQL → 3.3 秒

**现在：** 1 条 SQL（7 个标量子查询一次取出）→ 0.25 秒

### 3. 按需加载

- positions 接口支持 `department_id` 过滤（原来前端要全量加载再客户端过滤）
- 搜索 300ms 防抖
- bundle API 替代多次独立调用

---

## 四、权限系统

18 个新权限码，格式统一：`{resource}.{action}.{scope}`

| 角色 | 权限数 | 说明 |
|------|--------|------|
| ADMIN | 27 | 全部权限 |
| HR | 15 | 人事管理 |
| EMPLOYEE | 7 | 仅个人 |

---

## 五、Seed 数据

- **60 个员工**：CEO → VP → Mgr → Senior → Junior 层级
- **35 个技能**：8 大分类
- **20 个岗位**：每个岗位关联到 department_id
- **440 条考勤**：20 人 × 22 工作日，高风险员工故意设更多迟到/缺勤
- **52 条绩效**：每人 2026-Q1 一条
- **7 个项目履历**：供 Skills 页面的 AI 推理功能使用

---

## 六、前端页面功能清单

### Profile & Talent Hub（`/profile`）
- [x] 员工选择器
- [x] 个人信息卡片（姓名、岗位、部门、状态）
- [x] 技能条形图（1-5 级）
- [x] 最佳匹配岗位排名（match_pct 降序）
- [x] bundle API 单次加载

### Directory（`/directory`）
- [x] 三栏布局：部门树 | 搜索+员工卡片 | 滑出 Profile 面板
- [x] 跨字段搜索（姓名、岗位、部门、技能）
- [x] 部门筛选 + 岗位筛选标签
- [x] 滑出面板含电话、邮箱、Manager、离职风险

### Organization（`/org`）
- [x] 部门选择 → 岗位列表 → 员工列表
- [x] 岗位按 department_id 过滤
- [x] Profile 面板用 bundle API

### Skills（`/skills`，全新）
- [x] 技能列表 + 添加（下拉选 + 等级滑条 1-5）
- [x] 删除技能（悬停出现 ✕）
- [x] 工作履历 CRUD
- [x] AI Infer Skills：从履历技术栈自动推断并添加技能

### Analytics（`/analytics`）
- [x] 离职预警统计卡片（Total/Critical/High/Medium/Low）
- [x] 离职风险表格（按风险等级排序）
- [x] 技能覆盖率图表
- [x] Retrain model 按钮

---

## 七、当前局限

1. **DB4AI 模型**：attrition_model 用 5 个特征训练（tenure、engagement_score、last_promotion_months、manager_changes、overtime_count），PREDICT BY 不支持子查询作为 FEATURES
2. **考勤数据**：种子数据只插了少量记录，不足以让 ML 模型学到有效模式
3. **工作履历**：只用 `employee_project` 表（有 description 字段），`employee_job_history` 表是旧 schema
4. **无 psycopg2 依赖声明**：`psycopg2-binary` 已在本地装好，但 `requirements.txt` 里没加

---

## 八、维护提示

### 启动
```bash
# 后端（确保 openGauss 容器在运行）
cd backend && python app.py

# 前端
cd frontend-react && npx vite --host 0.0.0.0 --port 5173
```

### 首次运行
`bootstrap_rbac()` 在每次登录时自动执行（幂等，只插入缺失的角色-权限关联）。

### 端口清洁
```bash
# Windows 上经常有僵尸进程占着端口
netstat -ano | grep 18080 | grep LISTEN | awk '{print $5}' | xargs -I{} taskkill /F /PID {}
netstat -ano | grep 5173 | grep LISTEN | awk '{print $5}' | xargs -I{} taskkill /F /PID {}
```

### 全局 Skill
`/workflow-guidance` 是一个全局 Claude Code skill，安装路径 `~/.claude/skills/workflow-guidance/SKILL.md`。内容是我们总结的激活式金字塔工作流模式。
