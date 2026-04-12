# Active Plan

## 当前阶段

阶段名：`Phase 4 - 工程基线收口与 OpenAPI 准备阶段`

这一阶段的重点是：

- 已完成主体冻结
- 已完成 migration 升级
- 已完成数据库持久化与 dump/restore
- 已补齐轻量 deployment 基座
- 当前进入 OpenAPI 契约阶段

## 当前已经完成

1. 课程正式要求已经重新核定
2. openGauss 本地 Docker 环境已可启动
3. 后端、前端、本地启动链路已建立
4. `docs/` 已统一为正式文档资产区
5. `master/` 已统一为计划、冻结稿和阶段回顾区
6. HR 核心主体与模块边界已冻结
7. 数据库已切换到版本化 migration
8. 数据库已完成命名卷持久化
9. backup / restore 已可执行
10. release bundle 已可构建
11. 启动、测试、部署手册已统一到 `docs/operations/`

## 本阶段 4 个核心动作状态

### 1. 冻结主体和模块

状态：`已完成`

对应文档：

- `master/plans/CORE_ENTITIES_AND_MODULE_FREEZE.md`

### 2. 把 SQL 升级成 migration

状态：`已完成`

对应文档：

- `master/plans/NEXT_MIGRATION_V2_SCHEMA.md`
- `sql/migrations/README.md`

### 3. 给数据库持久化和 dump/restore

状态：`已完成`

对应文档：

- `master/plans/DATABASE_EVOLUTION_AND_DEPLOYMENT_TRUTH.md`
- `docs/operations/STARTUP_GUIDE.md`
- `docs/operations/TESTING_GUIDE.md`

### 4. 把接口契约升级成 OpenAPI

状态：`当前主任务`

目标：

- 让后续多人和 AI 围绕统一接口契约开发
- 为新主体升级留出稳定接口边界

对应文档：

- `master/API_SPEC.md`

## 当前最优先任务

### A. 先做 OpenAPI 契约

1. 把 `API_SPEC.md` 升级成 `openapi.yaml`
2. 明确每个资源的 request/response schema
3. 固定错误码、分页、筛选和权限头

### B. 再做接口与新数据模型对齐

1. 按 V2+ 主体补资源接口
2. 把目录类资源从旧极简结构升级到新模型
3. 明确哪些旧接口保留兼容，哪些进入新版本

### C. 最后做前端跟进

1. 让前端按新资源边界调整页面
2. 把详细测试步骤继续补到统一手册

## 当前一句话目标

这一阶段结束时，应该达到：

> 项目已经从“能跑的样例系统”升级成“主体清晰、迁移可控、数据可迁移、部署可复用、接口可契约化”的协作型工程基线。
