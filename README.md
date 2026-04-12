# 数据库课程项目

这是一个基于 `openGauss + Python API + Vue 3` 的企业人事管理系统仓库。

这个仓库的目标不是堆很多文档，而是让两类人都能快速接手：

- 你的队友
- 队友手里的 AI 助手

## 第一次进仓库先看什么

按这个顺序看就够了：

1. [docs/HANDBOOK.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/docs/HANDBOOK.md)
2. [master/PROJECT_BRIEF.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/PROJECT_BRIEF.md)
3. [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)
4. [AGENT.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/AGENT.md)

看完这四个，基本就能知道：

- 现在已经做到了哪一步
- 怎么把整套东西跑起来
- 后面应该继续做什么
- 接口和模块是怎么分的

## 现在仓库里已经有了什么

- 一个能跑的 `openGauss` 数据库
- 一套按顺序升级数据库的 SQL 脚本
- 数据备份和恢复脚本
- 一个能跑的 Python 后端
- 一个能跑的 Vue 前端
- 一份接口总说明 `openapi.yaml`
- 一套命令行启动、测试、打包脚本

## 目录是怎么分工的

- `docs/`
  - 放人看的文档和原始材料归档
- `master/`
  - 放项目现状说明和共享接口契约
- `ops/`
  - 放命令行脚本
- `sql/`
  - 放数据库脚本，尤其是迁移脚本
- `backend/`
  - 放后端代码
- `frontend/`
  - 放前端代码
- `deploy/`
  - 放部署模板和发布相关东西

## 最常用命令

一键启动整套环境：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\start_stack.ps1
```

检查数据库是不是正常：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\db\verify_hrms.ps1
```

检查后端是不是正常：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
```

构建发布包：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\deploy\build_release_bundle.ps1
```
