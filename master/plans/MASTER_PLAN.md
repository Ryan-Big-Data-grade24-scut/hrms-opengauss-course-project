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

## 4. 当前最现实的下一步

如果只选最值当的动作，顺序应该是：

1. 把 `API_SPEC.md` 升级成正式 OpenAPI
2. 把数据库 schema 拆成版本化迁移脚本
3. 把员工、请假、审计三块接口做成真正稳定的协作底座
4. 再决定是否上云、是否做 AI 查询亮点
