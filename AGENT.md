# DB Course Project AGENT

这是当前工作区的总规则文件。仓库目标不是只写出一套能跑的课设代码，而是把它整理成：

- 对课程交付友好
- 对多人协作友好
- 对 AI 接手友好
- 对 CLI 操作友好

的工程工作区。

## 当前边界

- 所有正式约束优先以课程要求为准  
  入口：`docs/course_requirements/Database Course Design Requirements.docx`

- `docs/` 只放正式文档资产：
  - 课程要求
  - 调研资产
  - 操作手册

- `master/` 只放计划与冻结稿：
  - 当前计划
  - 路线图
  - 职责定义
  - 模块冻结稿
  - 阶段回顾

- `master/drafts/` 是本地草稿区，默认被 `.gitignore` 忽略

- `ops/` 只放 CLI 脚本：
  - 启动
  - 验证
  - 备份恢复
  - 打包

## 当前原则

1. 先确认课程硬约束，再决定技术方案。
2. `openGauss` 是当前项目数据库底座。
3. 优先建设“可演示闭环”，再考虑 AI、备份增强、云端增强。
4. 默认优先使用 CLI 完成开发、启动、验证和打包。
5. 所有正式操作说明都沉淀到 `docs/operations/`。
6. 所有共享计划和冻结内容都沉淀到 `master/plans/`。
7. 所有共享接口契约都沉淀到 `master/contracts/`。

## 当前工程状态

当前仓库已经具备：

- openGauss 容器化数据库
- migration 版本化结构
- 命名卷持久化
- backup / restore
- Python 后端 API
- Vue 3 前端控制台
- release bundle 构建基座

当前还缺：

- 更细的 `OpenAPI` schema 约束和示例
- 新主体模型对应的后端/前端升级

## 目录口径

- `docs/course_requirements/`
  - 课程要求与配套材料

- `docs/course_materials/`
  - 组内已有原始材料

- `docs/research/`
  - 调研沉淀与参考仓库

- `docs/operations/`
  - 启动、测试、部署、架构说明

- `master/plans/`
  - 总计划、当前计划、冻结稿、回顾

- `master/contracts/`
  - 共享契约
  - 当前主要用于 `openapi.yaml`

- `sql/migrations/`
  - 版本化数据库迁移

- `backend/`
  - 后端实现

- `frontend/`
  - 前端实现

- `deploy/`
  - 轻量 deployment 基座

## 重要入口

- 总 README：`README.md`
- 总计划：`master/plans/MASTER_PLAN.md`
- 当前阶段：`master/ACTIVE_PLAN.md`
- 工作回顾：`master/plans/WORK_REVIEW.md`
- OpenAPI 契约：`master/contracts/openapi.yaml`
- 启动手册：`docs/operations/STARTUP_GUIDE.md`
- 详细测试手册：`docs/operations/TESTING_GUIDE.md`

## 安全与环境约束

- 不得为了修 Docker 随意执行全局 `wsl --shutdown`
- 默认把 `WSL` 视为高敏运行面
- 只有在用户明确允许，或已确认不会影响重要任务时，才可以关闭或重置 WSL

## 工作方式

- 能脚本化的动作尽量脚本化
- 能 CLI 完成的动作，不优先依赖手工点界面
- 新的流程说明优先补到已有手册体系，而不是散落在新文件里
- 旧阶段文档如果已被新结构覆盖，应合并回顾后及时清理
