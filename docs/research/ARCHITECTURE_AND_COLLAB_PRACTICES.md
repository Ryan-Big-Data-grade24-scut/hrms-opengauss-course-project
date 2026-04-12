# Architecture And Collaboration Practices

这份文档基于官方文档和社区通用实践，回答两个问题：

1. 当前仓库的架构是否合适
2. 这类小团队项目最稳的协作范式是什么

## 1. 结论先行

### 1.1 当前架构适不适合继续做

适合继续做，但不适合大重构。

原因：

- 课程目标是“做出完整可演示系统”，不是做长期生产系统
- 当前仓库已经具备：
  - openGauss 数据库
  - 可运行后端
  - 可运行前端
  - CLI 启动链路
  - 最小验证脚本

所以，当前最优策略不是推翻，而是：

- 冻结接口边界
- 补完模块设计
- 提升协作效率
- 最后再做有限升级

### 1.2 当前架构是不是“最佳实践”

不是长期最佳实践，但对课程交付是合理基线。

需要明确区分：

- **交付最优**：尽快形成完整闭环，可演示、可联调、可测试
- **工程最优**：完善框架、驱动层、迁移机制、自动化测试、正式 API 契约

你们现在更需要前者。

## 2. 对当前架构的判断

## 2.1 前端选型

当前前端使用 `Vue 3 + Vite`，这是合理选择。

原因：

- Vite 官方说明，它的目标就是提供更快、更轻的现代前端开发体验，并通过浏览器原生 ESM 提高开发期速度  
  来源：Vite 官方 Why Vite  
  https://vite.dev/guide/why.html

- Vue 官方 Style Guide 也明确把“避免错误”和“提升可读性”作为规则分类重点，说明它很适合团队协作中的一致性约束  
  来源：Vue Style Guide  
  https://vuejs.org/style-guide/

结论：

- 你们不需要换 React、Svelte、Solid
- 继续把页面做完整，比重新选型更值

## 2.2 后端架构

当前后端是：

- Python
- 标准库 HTTP 服务
- `docker exec + gsql` 访问数据库

判断：

- 对课程 MVP 合理
- 对长期维护不理想

为什么不理想：

- 没有正式 API 契约文件
- 没有数据库驱动层抽象
- 没有连接池
- 没有迁移机制

特别是数据库访问层，openGauss 官方已经明确支持基于 `psycopg2` 的 Python 访问方式，并指出 `psycopg2` 封装了 `libpq`，具备效率和安全性  
来源：openGauss Python 文档  
https://docs.opengauss.org/en/docs/latest-lite/docs/GettingStarted/python.html

结论：

- 现在不要为了“更优雅”马上重写
- 但应把“从 `gsql` 升级到驱动直连”列为下一阶段后端升级项

## 2.3 API 契约

这一块是你最应该补的。

OpenAPI 官方把 OAS 定义为一种语言无关的 HTTP API 接口描述标准，让人和程序都能在不看源代码的情况下理解服务能力  
来源：OpenAPI Specification  
https://spec.openapis.org/oas/latest

Zalando 的 RESTful API Guidelines 也明确强调两件事：

- 要走 API first
- 要提供 OpenAPI 规范

来源：Zalando RESTful API Guidelines  
https://opensource.zalando.com/restful-api-guidelines/

结论：

- 你现在最该补的不是换框架
- 而是把当前 `API_SPEC.md` 升级成正式的 OpenAPI YAML 或 JSON

## 2.4 数据库协作

当前数据库主要靠一个大 schema 文件初始化，这对第一阶段可以，但对多人协作不够稳。

Flyway 官方文档把迁移机制的核心解释得很直接：

- 数据库变更应当版本化
- 系统会记录哪些迁移执行过
- 这样可以可靠重建数据库状态

来源：
- Getting started with Flyway  
  https://documentation.red-gate.com/fd/getting-started-with-flyway-184127223.html
- Flyway schema history table  
  https://documentation.red-gate.com/flyway/flyway-concepts/migrations/flyway-schema-history-table

结论：

- 课程项目不一定非得引入 Flyway
- 但你们至少应该把 SQL 拆成编号迁移脚本
- 例如：
  - `V1__baseline.sql`
  - `V2__employee_fields.sql`
  - `V3__leave_approval_fields.sql`

## 3. 小团队协作范式建议

## 3.1 Git 协作方式

GitHub 官方把 GitHub flow 定义为一种轻量、基于分支的工作流，适合协作开发  
来源：GitHub flow  
https://docs.github.com/en/get-started/using-github/github-flow

对于你们这种课程小组，最适合的做法是：

- `main` 保持可运行
- 每个人按模块开短分支
- 完成后再合并

建议分支：

- `feat/api-auth-users`
- `feat/api-employees`
- `feat/frontend-leaves`
- `feat/db-migrations`

## 3.2 任务拆分方式

GitHub Issues 官方文档说明，Issue 可以用来规划、讨论和跟踪工作，并且可以通过 sub-issues 把大任务拆成层级化小任务  
来源：
- About issues  
  https://docs.github.com/en/issues/tracking-your-work-with-issues/about-issues
- Adding sub-issues  
  https://docs.github.com/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues

所以你们最稳的拆分方式是：

- 父任务：员工模块
- 子任务：
  - 数据表字段确认
  - 员工列表接口
  - 员工新增修改删除接口
  - 员工页面联调

## 3.3 项目看板

GitHub Projects 官方文档说明，Projects 可以把 issue 和 PR 组织成表格、看板、路线图等视图  
来源：Planning and tracking with Projects  
https://docs.github.com/en/issues/planning-and-tracking-with-projects

如果你们不用 GitHub Projects，也建议照着它的思路做最小看板字段：

- `Todo`
- `Doing`
- `Blocked`
- `Review`
- `Done`

## 3.4 代码评审

GitHub Docs 也强调了 Pull Request review 的价值，尤其是在大改动和多人协作时  
来源：Reviewing changes in pull requests  
https://docs.github.com/articles/reviewing-changes-in-pull-requests

对你们来说，不需要复杂审批流，但建议至少做到：

- 改接口时让前端同学看字段是否够用
- 改数据库时让接口同学看是否影响查询
- 合并前确认脚本还能启动

## 4. 你现在的最优动作

如果只选最关键的 4 件事，我建议顺序是：

1. 冻结终极目标和模块边界
2. 把 `API_SPEC.md` 升级成 OpenAPI 文件
3. 把数据库 schema 拆成编号迁移脚本
4. 按模块分支协作，不再混着改

## 5. 对“当前架构是否最优”的最终判断

一句话版：

> 对课程交付来说，当前架构已经足够好，不值得推翻；真正缺的不是更重的技术栈，而是更清晰的接口契约、数据库变更规范和协作流程。

这也是你现在最该推动的方向。
