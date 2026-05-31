# HRMS 重做工作流设计

> 协作范式：Author → Reviewer → Meta-Reviewer 三层流水线
> 参考：MARS (2025), IDVSCI (2025), AI-CoScientist (2025)

---

## 总体结构

```
Phase 1: 用户需求调研（纵向）
  ├── Agent A: 从已有设计文档提取需求
  ├── Agent B: 搜索 HR 系统的真实用户痛点
  ├── Agent C: 竞品用户评价分析（钉钉/飞书/Workday）
  └── Reviewer: 合并、去重、优先级排序

Phase 2: 后端 API 重新设计
  ├── Agent A: 基于需求设计 API 端点
  ├── Agent B: 设计数据库字段变更
  ├── Agent C: 设计权限 RBAC 映射
  └── Reviewer: API 一致性和完整性审查

Phase 3: 前端架构设计
  ├── Agent A: 设计页面布局和组件树
  ├── Agent B: 设计路由和状态管理
  ├── Agent C: 设计用户交互流程
  └── Reviewer: UX 流程审查

Phase 4: 实现
  ├── Agent A: 实现后端 API
  ├── Agent B: 实现前端页面
  ├── Agent C: 实现数据填充和测试
  └── Reviewer: 代码审查 + 功能验证
```

---

## 每个 Agent 的任务

### 用户需求调研 Agent
**输入**：prior/v6/为什么需要一个人事部门.md 的四个力量框架
**任务**：
1. 从四个力量推导出用户（HR、经理、员工）的 3-5 个核心需求
2. 每个需求必须是具体的场景（如"HR 想知道谁会离职"）
3. 输出：需求列表（每个需求包含场景、角色、优先级）

### API 设计 Agent
**输入**：需求列表
**任务**：
1. 每个需求对应 1-2 个 API 端点
2. 设计 RESTful 接口，包括输入输出
3. 考虑已有 API 的复用
4. 输出：API 设计文档

### 前端设计 Agent
**输入**：API 设计文档
**任务**：
1. 设计 3-5 个页面
2. 每个页面不超过 3 个交互区
3. 使用 React + shadcn/ui 或 Vue + Naive UI
4. 输出：页面原型描述

### Reviewer Agent
**输入**：其他 Agent 的输出
**任务**：
1. 一致性检查：API 是否覆盖所有需求
2. 完整性检查：没有遗漏的功能
3. 可理解性检查：用户能否理解
4. 输出：审查意见 + 修改建议

---

## 执行顺序

```
Round 1: 调研
  ├── 需求 Agent（单独工作）
  ├── 搜索 Agent（单独工作）
  └── Reviewer（合并审查）

Round 2: 设计（并行）
  ├── API Agent + 前端 Agent（可并行）
  └── Reviewer（统一审查 API+前端设计的一致性）

Round 3: 实现（并行 + 交叉审查）
  ├── 后端 Agent + 前端 Agent（并行）
  ├── Reviewer（审查后端代码）
  ├── Reviewer（审查前端代码）
  └── 集成测试 Agent
```
