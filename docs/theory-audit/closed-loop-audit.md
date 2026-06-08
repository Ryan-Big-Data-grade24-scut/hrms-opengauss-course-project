# Closed-Loop Process Audit

> 审计日期：2026-06-06
> 审计范围：审批流引擎、离职风险分析管线、跨模块分析服务、前端战略分析页
> 参考理论：`research-three-schema.md` 三级模式结构
> 审计人：Claude Code

---

## 目录

1. [审批流闭环审计](#1-审批流闭环审计)
2. [离职风险数据管线审计](#2-离职风险数据管线审计)
3. [三级模式结构合规审计](#3-三级模式结构合规审计)
4. [跨模块分析审计](#4-跨模块分析审计)
5. [间隙汇总与修复优先级](#5-间隙汇总与修复优先级)

---

## 1. 审批流闭环审计

### 1.1 理想闭环

```
Submit (提交) -> Approve (审批) -> Execute (执行) -> Verify (验证/关闭)
                                                                  |
                                                                  v
                                                             闭环完成
```

### 1.2 实际状态

| 阶段 | 实现函数 | 状态 | 说明 |
|------|---------|------|------|
| Submit | `submit_approval()` | **完成** | 创建审批单，快照审批链，审计日志写入 |
| Approve | `approve()` / `reject()` / `recall()` | **完成** | 审批人身份校验、乐观锁并发控制、节点推进 |
| Execute | `_execute_payload()` | **有缺陷** | 在状态更新 `AFTER` 执行，失败时无法回滚 |
| Verify | — | **缺失** | 无验证/关闭节点，流程在 approved 后终止 |

### 1.3 关键缺陷

#### 缺陷 A1：执行顺序导致状态与数据不一致

文件：`E:\Ufolder\Current\ActionSys\Hgclass\DB\backend\src\services\approval_service.py`

在 `approve()` 函数中，第 185-195 行将状态更新为 `approved`，然后第 204-206 行才调用 `_execute_payload()`：

```python
# 第 4 步：乐观锁更新 → status 已改为 'approved'
updated = int(query_scalar(f"""
    UPDATE approval_request
    SET status = {sql_literal(new_status)},   ← 此时已 approved
    ...
"""))

# 第 6 步：末节点审批通过后执行业务逻辑
if is_last:
    _execute_payload(...)   ← 如果这里抛出异常，状态已 approved
```

**后果**：`_execute_payload()` 抛出异常（如数据库约束违反、外键缺失）时，`approval_request` 的状态已经是 `approved`，但业务数据（employee_skill / leave_request / attendance_record）并未实际变更。系统进入"已审批但未执行"的不一致状态。

**建议修复**：
1. 将 `_execute_payload()` 放在 status UPDATE 之前，或者放在同一个事务中
2. 引入 `executing` 中间状态，执行完成后才进入 `approved`
3. 执行失败时状态回退至 `execution_failed`

#### 缺陷 A2：无 Verify（验证/关闭）节点

状态机仅支持：

```
pending → approved (终态)
pending → rejected (终态)
pending → recalled (终态)
```

缺少验证环节。在审批流实际业务中（如考勤补卡），HR 审批通过后，考勤专员需要确认补卡记录已正确写入员工考勤表——这个确认环节在系统中不存在。

**建议修复**：
1. 引入 `verified` / `closed` 终态
2. 审批链配置支持 `verifier_role` 字段
3. 执行完成后自动通知验证人，验证人确认后流程关闭

#### 缺陷 A3：无执行结果审计

`_execute_payload()` 执行后不写入审计日志。审批通过方能看到"节点 N 审批通过"的审计记录，但看不到"请假记录已创建/技能已添加"等执行结果。

**建议修复**：在 `_execute_payload()` 中为每个操作类型写入对应的执行审计日志。

#### 缺陷 A4：无执行失败通知

`_execute_payload()` 没有 try/except 包裹。一旦执行失败，`approve()` 向上抛异常，调用方收到 HTTP 500，但无法自动通知申请人或管理员。

### 1.4 状态机 vs 实际状态流转

```
当前状态机：
  submit
    └→ pending ─→ approved (终态，执行完成)
               └→ rejected (终态)
               └→ recalled (终态)

建议状态机：
  submit
    └→ pending ─→ approved ─→ verified (终态)
               |          └→ execution_failed ─→ pending (重试)
               └→ rejected (终态)
               └→ recalled (终态)
  verify 角色在 approved 后触发，执行审计后自动或手动关闭。
```

---

## 2. 离职风险数据管线审计

### 2.1 理想管线

```
Raw Data → Aggregation → ML → Presentation
    |            |          |        |
  employee   _COMPOSITE  PREDICT   REST + React
  attendance  公式      BY model   UI
  performance
```

### 2.2 实际管线

| 层级 | 实现位置 | 状态 | 说明 |
|------|---------|------|------|
| Raw Data | `attrition_service.py` L26-28 (子查询) | **完成** | `_ABSENT_SQ`、`_LATE_SQ`、`_AVG_PERF_SQ` 子查询聚合原始考勤/绩效数据 |
| Aggregation | `attrition_service.py` L33-42 (`_COMPOSITE`) | **完成** | 8 因子加权复合评分 |
| ML | `attrition_service.py` L104-115 (LEFT JOIN ML) + `predict_service.py` L9-30 (训练) | **有缺陷** | 见缺陷 B1 |
| Presentation | `StrategicAnalytics.tsx` + REST 路由 `server.py` L515-545 | **完成** | 分页、排序、过滤、下钻、因子分解图 |

### 2.3 关键缺陷

#### 缺陷 B1：ML 特征列在 employee 表上不存在

`attrition_service.py` 第 107-112 行的 ML 子查询：

```sql
SELECT employee_id,
       ROUND((PREDICT BY attrition_model (FEATURES
           tenure, engagement_score,
           last_promotion_months, manager_changes,
           overtime_count, attendance_absent_count,   ← 不存在
           attendance_late_count,                     ← 不存在
           avg_performance_score                      ← 不存在
       ) * 100)::decimal, 1) AS ml_risk_score
FROM employee
```

这三个字段（`attendance_absent_count`, `attendance_late_count`, `avg_performance_score`）在 `employee` 表中**没有对应的物理列**。规则评分通过子查询 `_ABSENT_SQ`/`_LATE_SQ`/`_AVG_PERF_SQ` 计算，但 ML 子查询直接从 `employee` 表读取。

同样的特征引用也出现在 `predict_service.py` 第 39-43 行和 `org_service.py` 第 514 行。

**影响**：`PREDICT BY attrition_model` 在 openGauss 中执行时会尝试读取不存在的列 → **SQL 运行时错误**。即使 DB4AI 引擎将其解释为变量名，其结果也无法保证与规则评分使用的子查询一致。

**建议修复**：
1. 在 `employee` 表中增加物化列，通过触发器或定时任务维护
2. 或者让 ML 子查询使用同样的子查询表达式（如 `attrition_service.py` 的 `_ABSENT_SQ`）
3. 或者将 V8 特征降级回 V7（去掉 attendance 和 performance 特征）

#### 缺陷 B2：风险公式重复（跨文件耦合）

`_COMPOSITE` 公式同时存在于：

| 文件 | 位置 | 代码行数 | 是否一致？ |
|------|------|---------|-----------|
| `attrition_service.py` | L33-42 | 10 行 | 基准定义 |
| `analytics_service.py` | L23-33 (`critical_persons_enhanced`) | ~10 行 | **重复但同构** |
| `analytics_service.py` | L101-112 (`department_health_score`/`attrition_risk` CTE) | ~12 行 | **重复但同构** |
| `org_service.py` | — | — | 引用 `_risk_sql()` 间接使用 |

当公式权重或因子发生变化时（如从 V8 改到 V9），三个位置需要同步修改。

**建议修复**：将 `_COMPOSITE` 定义为存储过程或数据库函数，所有查询调用函数。或构建 `risk_score` 物化视图。

#### 缺陷 B3：`attrition_history` 表在 DDL 中缺失

已知问题（已记录在 `docs/100-全新系统设计.md` 第 53 行）：

> `attrition_history` 表在 DDL 中不存在 — `snapshot_risk_history()` 代码已调用 `INSERT INTO attrition_history`，但数据库无此表，运行时崩溃。

`snapshot_risk_history()` 函数（`attrition_service.py` L266-304）和 `get_risk_history()` 函数（L307-323）功能完整（含 6 个月保留策略），但**底层表不存在**。

#### 缺陷 B4：ML 训练接口无权限校验

`StrategicAnalytics.tsx` L254-265 的 `retrain()` 函数调用 `/predict/attrition/train`，在 `server.py` 中对应的路由处理未显示 `_require_permission` 校验，存在越权风险。

---

## 3. 三级模式结构合规审计

### 3.1 理论要求 vs 实现现状

参考 `research-three-schema.md`：

| 模式层级 | 理论要求 | 实现现状 | 符合？ |
|---------|---------|---------|-------|
| **外模式** | 视图（View）实现用户级数据隔离，不同角色不同视图 | 无视图层。服务层直接通过 SQL 访问基表。代码级过滤而非数据库级隔离 | **不符合** |
| **概念模式** | 全局逻辑结构描述，唯一 | 在 DDL 中定义（但 `attrition_history` 缺失） | **部分符合** |
| **内模式** | 索引、分区、存储引擎优化 | 未在代码库中见到明确的 DDL 索引/分区定义 | **未覆盖** |

### 3.2 具体差距

#### 缺陷 C1：无外模式（View）层

当前代码中所有数据访问都是绕过视图的：

- `approval_service.py`：直接 `SELECT ... FROM approval_request`
- `attrition_service.py`：直接 `SELECT ... FROM employee`
- `analytics_service.py`：直接跨表 JOIN

**风险**：
- 无法在数据库层面实施行级安全策略
- 无法实现字段级脱敏（如 HR 看全量，经理只看下属）
- 基表重构时（如拆分 `employee` 表）需要修改所有服务层代码

#### 缺陷 C2：物理存储优化无文档

未在代码库中找到：
- 主键策略文档（当前所有表使用自增 INT PK，合规 ✓，但无明确说明）
- 分区策略（考勤表/审批表按时间分区？）
- 索引定义（高频查询的覆盖索引？）
- 存储引擎配置

#### 缺陷 C3：逻辑独立性未验证

当概念模式变更时（如 `employee` 表拆分），无视图层兜底，所有服务层 SQL 必须同步修改——违反了逻辑独立性的承诺。

### 3.3 改进建议

1. 为关键查询创建数据库视图（外模式），服务层通过视图访问而非基表
2. 为 `employee` 表的风险分析字段创建物化视图，ML 和规则评分都查询同一视图
3. 输出 DDL 和物理设计文档到 `docs/physical-schema.md`
4. 为审批流创建审批历史归档分区规划

---

## 4. 跨模块分析审计

### 4.1 综合健康评分（`department_health_score`）

`analytics_service.py` `department_health_score()` 函数综合四个维度：

| 维度 | 数据来源 | 权重 | 实现方式 |
|------|---------|------|---------|
| 技能覆盖率 | `employee_skill` | 25% | CTE: `skill_coverage` |
| 出勤率 | `attendance_record` | 25% | CTE: `attendance_rate` |
| 绩效均分 | `performance_review` | 25% | CTE: `perf_avg` |
| 离职风险 | `employee` (公式) | 25% | CTE: `attrition_risk` |

**缺陷 D1**：`attrition_risk` CTE 再次重复了 `_COMPOSITE` 公式（见缺陷 B2）。

**缺陷 D2**：`skill_coverage` CTE 中 `LEFT JOIN employee_skill` 会导致覆盖率计算可能偏差——分母是所有员工，分子是有技能记录的员工，但没有区分"该部门需要哪些技能"。建议增加 `position_required_skill` 维度。

### 4.2 关键人物风险（`critical_persons_enhanced`）

```sql
HAVING COUNT(DISTINCT sub.employee_id) > 0
```

**缺陷 D3**：仅统计有直接下属的管理者，但一个人可能是"关键人物"不仅因为管辖人数多，还可能因为：
- 掌握核心技能（skill 维度缺失）
- 项目关键角色（project 维度缺失）

### 4.3 前端数据加载

`StrategicAnalytics.tsx` 的加载模式：

- **主数据**（attrition, gaps, heatmap）：进入页面立即 `Promise.allSettled` 加载
- **延迟加载**（attPerf, health）：切换到对应 Tab 才触发
- **下钻**：点击行时单独请求 `/attendance/records` 和 `/performance/reviews`

数据流完整性合理，但缺乏以下状态处理：
- 无重试机制（网络抖动时请求失败没有自动重试）
- 无缓存（切换 Tab 后再切回来重新请求）
- 无数据时效性标记（当前数据的快照时间未展示）

---

## 5. 间隙汇总与修复优先级

| 编号 | 缺陷 | 文件 | 严重程度 | 修复优先级 |
|------|------|------|---------|-----------|
| A1 | `_execute_payload` 在状态更新后执行 | `approval_service.py:185-206` | **Critical** | P0 |
| A2 | 缺少 Verify 节点 | `approval_service.py` (全局) | High | P1 |
| B1 | ML 特征列在 employee 表不存在 | `attrition_service.py:107-112` | **Critical** | P0 |
| B3 | `attrition_history` 表 DDL 缺失 | `attrition_service.py:273` | **Critical** | P0 |
| B2 | 风险公式跨文件重复 | `analytics_service.py:23-33,101-112` | Medium | P2 |
| A3 | 执行结果无审计 | `approval_service.py:501-621` | Medium | P2 |
| A4 | 执行失败无通知/异常处理 | `approval_service.py:204-206` | Medium | P2 |
| B4 | ML 训练接口权限校验缺失 | `server.py` / `predict_service.py` | High | P1 |
| C1 | 无外模式/视图层 | 全局 | High | P1 |
| C2 | 物理存储优化无文档 | 全局 | Low | P3 |
| D1 | 风险公式在 analytics_service 重复 | `analytics_service.py` | Medium | P2 |
| D3 | 关键人物判定维度不全 | `analytics_service.py:15-59` | Low | P3 |

### 5.1 P0 (立即修复)

1. **A1 + B1**：修复 execute 顺序，ML 特征列对齐 —— 系统运行时的硬崩溃风险
2. **B3**：补充 `attrition_history` 表 DDL —— 快照功能不可用

### 5.2 P1 (短中期)

1. **A2**：引入 Verify 节点关闭审批闭环
2. **B4**：ML 训练接口增加权限守卫
3. **C1**：建立视图层实现外模式，服务层迁移至视图访问

### 5.3 P2-P3 (持续改进)

1. **B2/D1**：抽取 `_COMPOSITE` 为公共函数或存储过程
2. **A3/A4**：增加执行审计、异常处理和通知
3. **D3**：扩展关键人物风险的多维度判定

---

## 附录：受审文件清单

| 文件 | 绝对路径 | 行数 | 用途 |
|------|---------|------|------|
| 审批流引擎 | `E:\Ufolder\Current\ActionSys\Hgclass\DB\backend\src\services\approval_service.py` | 837 | 审批单生命周期管理 |
| 离职风险服务 | `E:\Ufolder\Current\ActionSys\Hgclass\DB\backend\src\services\attrition_service.py` | 347 | 规则评分 + ML 双引擎 |
| 预测服务 | `E:\Ufolder\Current\ActionSys\Hgclass\DB\backend\src\services\predict_service.py` | 64 | DB4AI 模型训练与预测 |
| 跨模块分析 | `E:\Ufolder\Current\ActionSys\Hgclass\DB\backend\src\services\analytics_service.py` | 244 | 综合健康、关键人物、技能缺口 |
| 前端战略分析 | `E:\Ufolder\Current\ActionSys\Hgclass\DB\frontend-react\src\pages\StrategicAnalytics.tsx` | 995 | 5 Tab 战略分析仪表盘 |
| 三级模式理论 | `E:\Ufolder\Current\ActionSys\Hgclass\hrms-design\theory\research-three-schema.md` | 512 | 数据库三级模式设计参考 |

---

*审计结束。*
