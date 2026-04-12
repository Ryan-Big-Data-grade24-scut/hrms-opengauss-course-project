# Active Plan

## 当前阶段

阶段名：`Phase 4 - 结构冻结与工程化升级阶段`

这一阶段的重点是：

- 先冻结主体和模块
- 再把 SQL 升级成 migration
- 再补数据库持久化与 dump/restore
- 最后把接口契约升级成 OpenAPI

## 当前已经完成

1. 课程正式要求已经重新核定
2. openGauss 本地 Docker 环境已可启动
3. 后端、前端、本地启动链路已建立
4. `docs/` 已统一为正式文档资产区
5. `master/` 已开始作为计划与草稿区使用
6. 启动脚本、验证脚本和操作手册已基本可用

## 当前阶段要解决的 4 个核心动作

### 1. 冻结主体和模块

目标：

- 把 HR 的核心主体冻结
- 把模块边界冻结
- 把功能目标冻结

对应文档：

- `master/plans/CORE_ENTITIES_AND_MODULE_FREEZE.md`

### 2. 把 SQL 升级成 migration

目标：

- 从单一 baseline SQL 过渡到版本化迁移

对应文档：

- `master/plans/NEXT_MIGRATION_V2_SCHEMA.md`
- `sql/migrations/README.md`

### 3. 给数据库持久化和 dump/restore

目标：

- 解决数据存活、迁移和恢复问题

对应文档：

- `master/plans/DATABASE_EVOLUTION_AND_DEPLOYMENT_TRUTH.md`
- `docs/operations/STARTUP_GUIDE.md`

### 4. 把接口契约升级成 OpenAPI

目标：

- 让后续多人和 AI 围绕统一接口契约开发

对应文档：

- `master/API_SPEC.md`

## 当前最优先任务

### A. 第一步先完成

1. 冻结主体
2. 冻结模块边界
3. 冻结模块功能目标

### B. 第二步准备

1. 准备 `V1__baseline.sql`
2. 准备 `V2__org_and_job.sql`
3. 准备 `V3__employee_profile_and_history.sql`
4. 准备 `V4__leave_type_and_leave_upgrade.sql`

### C. 第三步准备

1. 固定持久化卷方案
2. 固定 dump/restore 方案
3. 固定本地到云端的数据迁移流程

### D. 第四步准备

1. 把 `API_SPEC.md` 升级成 `openapi.yaml`
2. 明确每个资源的 schema
3. 明确错误码、分页、筛选和权限

## 当前一句话目标

这一阶段结束时，应该达到：

> 项目已经从“能跑的样例系统”升级成“主体清晰、迁移可控、数据可迁移、接口可契约化”的协作型工程基线。
