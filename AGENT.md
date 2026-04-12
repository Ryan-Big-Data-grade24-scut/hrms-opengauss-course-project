# 仓库协作规则

## 这个文件是干什么的

这是这个仓库的总规则文件。

它主要解决 3 件事：

1. 文档应该放哪里
2. 计划应该放哪里
3. 新人和 AI 应该从哪里开始看

## 文档结构规则

### `docs/`

这里只放下面几类东西：

- 总手册
- 调研总结
- 课程原始要求
- 小组已有原始材料
- 下载下来的参考资料和参考仓库

也就是说，`docs/` 是“正式资料区”。

主入口是：

- [docs/HANDBOOK.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/docs/HANDBOOK.md)

### `master/`

这里只放下面两类东西：

- 一份项目简报
- 一份共享接口契约

也就是说，`master/` 是“当前项目状态区”，不是“到处堆计划草稿的地方”。

主入口是：

- [master/PROJECT_BRIEF.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/PROJECT_BRIEF.md)
- [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)

以后不要再恢复一堆分散的计划文档，除非真的有非常强的必要。

## 工程规则

1. 课程要求优先，聊天记录和猜测不算数。
2. 当前数据库底座是 `openGauss`。
3. 数据库结构的正式升级路径在 `sql/migrations/`。
4. 启动、验证、备份、恢复、打包这些动作，正式入口都在 `ops/`。
5. 接口的正式共享说明以 `master/contracts/openapi.yaml` 为准。
6. 如果某个接口只是“先定下来，后面再做”，可以保留定义，但不能影响当前运行。
7. 新说明优先写进现有总手册或项目简报，不要一有新内容就新建文档。

## 仓库目录口径

- `docs/`
  - 人看的正式文档和原始材料
- `master/`
  - 项目简报和共享契约
- `ops/`
  - 启动、数据库、后端、部署脚本
- `sql/`
  - 数据库脚本和迁移脚本
- `backend/`
  - 后端实现
- `frontend/`
  - 前端实现
- `deploy/`
  - 部署模板和发布基座

## 安全规则

- 不要为了修 Docker 随手执行全局 `wsl --shutdown`
- 默认把 `WSL` 当成可能在跑重要东西的环境
- 只有明确确认安全时，才可以关掉或重置 WSL

## 工作方式

- 能用脚本做的就尽量用脚本做
- 能用命令行做的就尽量别靠手工点界面
- 文档如果过时了，就把有用内容合并回主文档，再删掉旧文档
- 一切以“队友能看懂、AI 能接手”为优先目标
