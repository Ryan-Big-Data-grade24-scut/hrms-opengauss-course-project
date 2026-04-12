# SQL Migrations

这个目录用于保存数据库结构的版本化迁移脚本。

## 目标

逐步把当前“单一 baseline SQL”升级成“可追踪、可重复执行、适合多人协作”的迁移体系。

## 推荐命名

- `V1__baseline.sql`
- `V2__org_and_job.sql`
- `V3__employee_profile_and_history.sql`
- `V4__leave_type_and_leave_upgrade.sql`

## 当前状态

当前仓库仍主要依赖：

- `sql/10_hrms_schema.sql`

它是现有 baseline。

后续计划是：

1. 先冻结迁移方案
2. 再把 baseline 拆到 `sql/migrations/`
3. 再让初始化脚本逐步切换到 migration 入口

## 注意

- 迁移脚本负责“结构变更”
- 演示数据和业务数据不应依赖重复跑 baseline 粗暴覆盖
- 迁移前应先备份数据库
