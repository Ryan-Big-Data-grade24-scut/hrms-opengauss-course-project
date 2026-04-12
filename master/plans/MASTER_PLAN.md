# Master Plan

这份文档是当前计划区的总入口。

它只回答一个问题：

> 现在这个项目最该怎么推进，才能既适合分工协作，又适合 AI 参与开发？

## 1. 计划区和文档区的分工

## `docs/`

只放正式文档资产：

- 课程要求
- 调研资产
- 操作手册

## `master/`

只放计划与草稿：

- 路线图
- 规范草案
- 模块职责
- 云部署评估
- 需求优先级

## 2. 当前计划的 3 个核心问题

### 问题 1

你作为“数据库基础设施 + 数据库架构设计 + 接口设计”负责人，到底承担什么职责？

对应文档：

- [INFRA_AND_API_OWNER_RESPONSIBILITIES.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/master/plans/INFRA_AND_API_OWNER_RESPONSIBILITIES.md)

### 问题 2

我们是否需要云服务器，以及应该如何评估“CLI 友好 + 低成本 + 稳定在线”的方案？

对应文档：

- [CLOUD_DEPLOYMENT_EVALUATION.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/master/plans/CLOUD_DEPLOYMENT_EVALUATION.md)

### 问题 3

我们的精力到底该集中在哪些需求、哪些模块、哪些功能目标上？

对应文档：

- [FOCUS_REQUIREMENTS_AND_MODULE_GOALS.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/master/plans/FOCUS_REQUIREMENTS_AND_MODULE_GOALS.md)

## 3. 当前执行顺序

1. 先稳住本地开发闭环
2. 冻结数据库和接口边界
3. 明确模块职责和功能目标
4. 先做评分核心项
5. 最后再决定是否上云和是否做亮点扩展

## 3.1 当前需要特别关注的数据库真相

- [DATABASE_EVOLUTION_AND_DEPLOYMENT_TRUTH.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/master/plans/DATABASE_EVOLUTION_AND_DEPLOYMENT_TRUTH.md)

## 3.2 当前需要特别关注的下一次结构升级

- [NEXT_MIGRATION_V2_SCHEMA.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/master/plans/NEXT_MIGRATION_V2_SCHEMA.md)

## 3.3 当前需要特别关注的企业 HR 建模参考

- [HR_DATABASE_MODEL_REFERENCES.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/research/HR_DATABASE_MODEL_REFERENCES.md)

## 4. 当前主推进顺序

结合当前项目状态，后续按下面 4 步推进：

1. 冻结主体和模块
2. 把 SQL 升级成 migration
3. 给数据库持久化和 dump/restore
4. 把接口契约升级成 OpenAPI

## 4.1 第一步：冻结主体和模块

目标：

- 先把 HR 的核心主体定住
- 先把模块边界和功能目标定住
- 避免后续数据库、前后端并行开发时反复改方向

输出物：

- `master/plans/CORE_ENTITIES_AND_MODULE_FREEZE.md`

## 4.2 第二步：把 SQL 升级成 migration

目标：

- 把当前单一 baseline SQL 升级成版本化迁移结构
- 为多人协作和后续云端更新做准备

输出物：

- `sql/migrations/`
- `V1 / V2 / V3 / V4` 迁移脚本

## 4.3 第三步：给数据库持久化和 dump/restore

目标：

- 解决数据如何活下来、如何迁云、如何恢复

输出物：

- 持久化卷方案
- dump/restore 脚本
- 云迁移手册

### 这一阶段附带补齐

- 轻量 deployment 基座

说明：

- 当前适合补一个“可打包、可迁移、可配置”的 deployment 基座
- 但还不适合上完整 CI/CD 或复杂云编排

## 4.4 第四步：把接口契约升级成 OpenAPI

目标：

- 让多人协作和 AI 协作都围绕统一契约进行

输出物：

- `openapi.yaml`

## 5. 当前最现实的第一批执行动作

1. 先完成主体与模块冻结
2. 再把 migration 目录结构和 V1/V2 草案落地
3. 再把数据库持久化卷和备份恢复流程固定
4. 同时补轻量 deployment 基座
5. 最后升级 OpenAPI 并驱动接口改造
