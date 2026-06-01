# 审计报告：战略分析页 (StrategicAnalytics)

**审计日期**: 2026-06-01
**审计对象**: frontend-react/src/pages/StrategicAnalytics.tsx
**参考设计**: redesign-v2/designs/04-前端组件设计.md / workspace/designs/analytics-design.md
**后端对照**: skill_service.py / attrition_service.py

---

## 1. 当前页面功能总览

StrategicAnalytics.tsx 实现了三个数据区块：

| 区块 | 数据源 (前端 API 调用) | 视觉呈现 |
|------|------------------------|----------|
| Summary Cards (5张) | `/api/attrition/risk` | 纯数字统计卡: Total at Risk / Critical / High / Medium / Low |
| 离职风险表格 | `/api/attrition/risk` | 全员工表格: 姓名、部门、风险百分比、风险等级标签、风险因子分解堆叠条 + 风险标签 |
| 技能覆盖概览 | `/api/skills/analytics/overview` | 横向进度条列表: 每个技能类别的覆盖率百分比 + 平均熟练度 |

三个 API 调用通过 `Promise.all` 并行发起，使用内联 `get()` 函数（非共享 api/client.ts）。

---

## 2. 离职风险表格 — 分页 / 排序 / 筛选

| 功能 | 当前实现 | 结论 |
|------|----------|------|
| **分页** | 无。`attrition` 数组全量渲染，无分页组件。 | **缺失** |
| **排序** | 无。纯数组遍历展示，无表头点击排序逻辑。 | **缺失** |
| **部门筛选** | 无。所有数据一次性展示，无筛选控件。 | **缺失** |
| 搜索 | 无。 | **缺失** |
| 行数 | 后端 `/api/attrition/risk` 返回所有 active/probation 员工，无 LIMIT 限制。 | 随着人员增长，表格长度不可控。 |

> 后端 `compute_risk_all()` 和 `get_flagged_employees()` 均已在 SQL 层 `ORDER BY risk_score DESC`，但前端未利用此排序 — 表头缺少可点击的排序指示器，用户无法按部门、风险等级等动态排序。

---

## 3. 技能缺口 — 维度与下钻

### 当前前端展示
仅显示 `org_skills_overview()` 返回的数据：按技能类别展示 `coverage_pct` 和 `avg_proficiency`。

**展示维度**: 1 个层级 — 技能类别 (category)
- category_name
- coverage_pct (该类别员工覆盖率)
- avg_proficiency (平均熟练度)

### 当前能下钻吗？
**不能。** 页面无点击展开、无模态框、无路由跳转。

### 后端已具备但前端未使用的数据
- `gap_analysis()`: 组织级技能差距分析，含 target_level / current_avg / gap / staff_count
- `heatmap()`: 部门 x 技能类别热力图矩阵，含 avg_level / staff_count
- `department_comparison()`: 每(部门, 技能类别)组合的 avg_proficiency / coverage_pct / dept_size
- `skill_recommendations()`: 关联技能推荐（优化建议）
- `match_employee_to_positions()`: 员工-岗位匹配度分析

### 关键缺口
`org_skills_overview()` 仅展示"覆盖率"和"平均熟练度"，而设计要求的"差距分析"(gap vs target) 由 `gap_analysis()` 提供，`gap_analysis()` 的 target 目前硬编码（Python VALUES 子句中写死了 5 个技能），**未同步到前端**。

---

## 4. 部门对比

### 当前前端展示
**完全没有。** 前端代码中确实调用了 `/api/skills/analytics/department-comparison` 并将结果存入 `heatmap` state（第 68 行从 API 获取，第 72 行 `setHeatmap(h.data || [])`），但 `heatmap` 状态变量从未在 JSX 中被渲染使用。

对比设计文档要求，部门 x 技能类别热力图矩阵是完全缺失的。

### 后端已具备的数据
`department_comparison()` 返回每个 (department_id, department_name, category_id, category_name) 组合的：
- avg_proficiency: 平均熟练度
- employee_count: 拥有该类别技能的员工数
- dept_size: 部门总人数
- coverage_pct: 覆盖率百分比（零填充，CROSS JOIN 保证空集也有行）

`heatmap()` 返回简化的部门 x 类别矩阵（无零填充，仅活跃员工）。

---

## 5. 与设计文档对比 — 差距清单

依据 **redesign-v2/designs/04-前端组件设计.md** 和 **analytics-design.md** 进行对比。

### 5.1 页面路由与入口

| 设计要求 | 实际状态 |
|----------|----------|
| 路由 `/analytics` → `<StrategicAnalyticsPage />` | 已匹配前端路由 |
| 权限控制：HR_ADMIN/MANAGER 可访问 | 前端无 ProtectedRoute / 权限守卫 |
| 侧边栏导航 "战略分析" | 需检查侧边栏实现 |

### 5.2 分析页完整组件树 (analytics-design.md)

| 组件 | 设计要求 | 实际实现 | 状态 |
|------|----------|----------|------|
| DashboardOverview / MetricCard | 4 张指标卡：health、attrition rate、attendance rate、skill coverage | 5 张风险计数卡（无健康分、出勤率、技能覆盖率指标） | **部分不符** |
| **TabBar** | [Skills \| Attendance \| Performance \| Attrition \| Health] 5 个标签页 | **无 TabBar**，所有内容平铺 | **缺失** |
| SkillsGapPanel | Org 级差距图 + Dept 选择器 + Dept 雷达图 + 热力图矩阵 | 仅有技能覆盖进度列表 | **大量缺失** |
| AttendancePanel | 出勤摘要卡 + 趋势折线图 + 部门出勤表 | **无** | **缺失** |
| PerformancePanel | 绩效摘要卡 + 评级分布图 + 趋势图 + 最近评审表 | **无** | **缺失** |
| AttritionPanel | 风险分布直方图 + 部门风险表 + 风险驱动因素 + 员工风险表格(可排序/可筛选) + 风险趋势历史 | 仅有员工风险表格(不可排序/筛选/分页) + 无风险分布图、无部门风险表、无驱动因素、无趋势 | **严重缺失** |
| HealthPanel | 部门健康分排名 + 关键人员风险列表 | **无** | **缺失** |
| 风险分布直方图 | `/api/attrition/distribution` (10 buckets, 0-9% ... 90-100%) | 后端已实现，前端未调用 | **缺失** |
| 部门风险表 | `/api/attrition/summary` (按部门的风险等级计数+均值) | 后端已实现，前端未调用 | **缺失** |
| 风险驱动因素 | `/api/attrition/drivers` (高风险因子标志) | 后端已实现，前端未调用 | **缺失** |
| 风险趋势历史 | `/api/attrition/history/:id` (个体风险趋势折线图) | 后端已实现，前端未调用 | **缺失** |

### 5.3 共享组件使用

| 设计要求 (04-前端组件设计.md §7) | 实际状态 |
|----------------------------------|----------|
| 统一 `api/client.ts` 和 `useFetch` hook | 内联 `get()` 函数，使用原生 fetch，无 AbortController / 竞态防护 |
| `ErrorBanner` 共享组件 | 内联 `<div className="bg-red-50 ...">` 实现 |
| `Spinner` 共享组件 | 内联 spinner CSS 实现 |
| `EmptyState` 共享组件 | 内联空态 div 实现 |
| `Pagination` 共享组件 | **未实现，且表格未使用** |
| `Skeleton` 骨架屏 | Loading 态仅显示 spinner，无骨架屏 |
| TypeScript DTO 类型 | **无** — 全页使用 `any` 类型 |

### 5.4 状态覆盖矩阵

| 状态 | 设计要求的覆盖策略 | 实际覆盖 |
|------|-------------------|----------|
| Loading | 骨架屏 (各区块逐块出现) | 全页加载 spinner，缺少骨架屏 |
| Empty | 插画 + 分级提示文字（如"No predictions yet"） | 表格和技能区有基本空态提示，但风格不统一 |
| Error | ErrorBanner + 重试按钮 | 有错误提示但无重试按钮 |
| Partial Data | 部分数据缺失仍可显示 | `Promise.all` 整体失败时全部不显示 — **all-or-nothing 问题** |

---

## 6. 后端 API 已就绪但前端未接入的清单

| 后端 Endpoint / 方法 | 用途 | 前端状态 |
|----------------------|------|----------|
| `GET /api/skills/gap/enhanced` | 组织级技能差距（含 target/gap/severity） | 未调用 |
| `GET /api/skills/gap/department/:id` | 部门级技能差距下钻 | 未调用 |
| `GET /api/skills/analytics/department-comparison` | 部门 x 类别覆盖热力图 | 已调但**未渲染** |
| `GET /api/skills/heatmap` | 简化版热力图 | 未调用 |
| `GET /api/attrition/summary` | 部门风险汇总（按风险等级计数） | 未调用 |
| `GET /api/attrition/drivers` | 高风险驱动因素员工列表 | 未调用 |
| `GET /api/attrition/distribution` | 风险分数分布直方图 (10 buckets) | 未调用 |
| `GET /api/attrition/history/:id` | 员工风险趋势历史 | 未调用 |
| `GET /api/attendance/summary` | 部门出勤汇总 | 未调用 |
| `GET /api/performance/summary` | 部门绩效汇总 | 未调用 |
| `GET /api/analytics/department-health` | 部门健康综合评分 | 未调用 |
| `GET /api/analytics/critical-persons` | 关键人员风险排名 | 未调用 |

---

## 7. 代码质量问题 (代码审查层面)

1. **类型安全**: 整个组件使用 `<any>`，无 TypeScript DTO 接口，违反 F-33 要求。
2. **API 客户端**: 内联 `get()` 函数（第 7-15 行）无 AbortController、无竞态防护，违反 F-05/F-06/F-17 要求。
3. **未使用的状态**: `heatmap` 数据被获取但从未渲染（第 55 行声明 `heatmap` state，第 68/72 行赋值，JSX 中从未使用）。
4. **`setTitle` 依赖**: 通过 `useOutletContext` 获取，但未声明在意数组中（第 50/59 行），可能导致 lint 警告。
5. **空态可选方案**: 表格空态提示依赖用户点击"Retrain model"来首次训练模型，但首次使用时用户可能不知道需要先触发训练。
6. **裸 `catch`**: 第 91 行 `catch { /* ignore */ }` 静默吞异常，不利于调试。

---

## 8. 总结

**战略分析页处于早期开发阶段**，当前仅实现了设计文档要求的约 15-20% 的功能。后端 attrition_service 和 skill_service 已提供丰富的 API 数据（技能差距、风险分布直方图、部门风险汇总、风险驱动因素、历史趋势、部门对比热力图），但前端基本没有消费这些数据。

**核心缺项（按优先级排序）**:
1. 引入 5 标签页 TabBar（Skills / Attendance / Performance / Attrition / Health）替代当前平铺布局
2. 接入 `/api/attrition/distribution` 实现风险分布直方图
3. 接入 `/api/attrition/summary` 实现部门风险表格
4. 接入 `/api/attrition/drivers` 实现风险驱动因素分析
5. 渲染已获取的 `department_comparison` 数据为热力图矩阵
6. 离职风险表格增加分页、排序、部门筛选、搜索功能
7. 统一使用共享 api/client.ts、ErrorBanner、Spinner 等组件
8. 增加 TypeScript DTO 类型定义
9. 风险趋势历史折线图（员工选择器 + 折线图）
10. 引入骨架屏替代 spinner
