# HRMS — 企业人事管理系统

> openGauss + Python + React 全栈课程项目
> 技能驱动的人智平台，非传统人事 CRUD

---

## 快速启动

### 前置条件

- Docker（运行 openGauss 7.0.0）
- Python 3.12+（`pip install psycopg2-binary`）
- Node.js 20+（前端）

### 启动

```bash
# 1. 确保 openGauss 容器在运行
docker ps | grep opengauss-hrms

# 2. 起后端（port 18080）
cd backend
python app.py

# 3. 起前端（port 5173）
cd frontend-react
npx vite --host 0.0.0.0 --port 5173
```

打开 `http://localhost:5173`，登录密码 `123456`。

---

## 架构

```
frontend-react/     React 19 + Tailwind CSS（当前前端）
backend/            Python HTTP server（无框架）
  src/
    server.py       路由分发（~85 条路由）
    services/       业务逻辑层（8 个 service）
    common/         db 连接、权限、HTTP 工具
sql/migrations/     SQL 迁移脚本（V1-V9）
hrms-design/        设计文档（独立仓库）
```

### 四层设计

| 层 | 技术 | 说明 |
|---|------|------|
| 数据层 | openGauss 7.0.0 | 19 张表，DB4AI 机器学习，递归 CTE 组织树 |
| 业务层 | Python Service | 技能匹配（ProPer 算法）、离职风险评分、Bundle 接口 |
| API 层 | RESTful | 统一 `{code, message, data}` 格式，scope 权限 |
| 前端层 | React 19 + Tailwind | 6 个页面，无 UI 库，无状态管理 |

### 页面

| 路由 | 功能 |
|------|------|
| `/profile` | 个人中心：技能条 + 最佳匹配岗位 |
| `/directory` | 通讯录：三栏布局 + 跨字段搜索 |
| `/org` | 组织架构：部门 → 岗位 → 员工 |
| `/skills` | 技能管理：CRUD + 工作履历 + AI 推理 |
| `/analytics` | 数据分析：离职预警 + 技能覆盖率 |

---

## 关键设计决策

- **技能中心**：员工是技能载体，岗位是技能需求集合，匹配度 = 加权点积
- **Bundle API**：`GET /api/org/employee/{id}` 一次返回 7 域数据（员工 + 技能 + 匹配 + 风险 + 汇报 + 履历）
- **离职风险**：5 因子规则评分 + DB4AI ML 信号
- **psycopg2 直连**：取代 `docker exec + gsql`，API 响应从 0.69s 降至 0.25s
- **权限 scope**：`{resource}.{action}.{scope}` 格式（self/team/all）

---

## 项目状态

✅ 可运行的核心功能
⚠️ 考勤/绩效前端未实现
⚠️ 员工 Profile 缺少联系方式显示
⚠️ DB4AI 模型特征有限

详细 gap 分析见 `hrms-design/gap-analysis-20260531/`。

---

## 给 AI 接管者的提示

- `CLAUDE.md` — 本项目的 Claude Code 配置
- `AGENT.md` — 旧版 AI 指南（部分过时）
- 全局 skill `/workflow-guidance` 已安装到 `~/.claude/skills/`
- hrms-design 是独立仓库，有单独的 git 历史
