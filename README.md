# DB Course Project

这是一个 `openGauss + Python API + Vue 3` 的课程项目仓库，目标是把它做成一个：

- 队友看得懂
- AI 接得上
- CLI 能完整驱动
- 可以继续扩展成正式 HR 系统

的工作区。

## 先看哪几个文件

如果你是第一次进入这个仓库，按这个顺序看：

1. [docs/HANDBOOK.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/docs/HANDBOOK.md)
2. [master/PROJECT_BRIEF.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/PROJECT_BRIEF.md)
3. [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)
4. [AGENT.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/AGENT.md)

这四个文件已经足够让人和 AI 快速知道：

- 现在有什么
- 怎么启动和测试
- 当前架构长什么样
- 后面该往哪扩

## 现在已经有了什么

- 持久化的 `openGauss` 数据库
- 版本化 schema migration
- backup / restore 脚本
- 可运行的 Python 后端
- 可运行的 Vue 前端
- 初版 OpenAPI 契约
- release bundle 构建脚本

## 目录口径

- `docs/`
  - 只放人看的正式文档和原始材料归档
- `master/`
  - 只放当前项目简报和共享契约
- `ops/`
  - 只放 CLI 脚本
- `sql/`
  - 只放数据库相关脚本，特别是 migrations
- `backend/`
  - 后端实现
- `frontend/`
  - 前端实现
- `deploy/`
  - 部署模板和发布基座

## 常用命令

一键启动：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\start_stack.ps1
```

数据库验证：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\db\verify_hrms.ps1
```

后端 smoke test：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
```

构建发布包：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\deploy\build_release_bundle.ps1
```
