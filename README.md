# DB Course Project

这是一个 `openGauss + Python API + Vue 3` 的课程项目工作区，当前目标是把它整理成一套：

- 对课程交付友好
- 对多人协作友好
- 对 AI 接手友好
- 对 CLI 操作友好

的企业人力资源管理系统仓库。

## 仓库定位

当前主线是：

- `基于 openGauss 的企业人力资源管理系统`

当前已经具备的底座：

- openGauss 容器化数据库
- 版本化 migration
- 数据库持久化卷
- backup / restore
- Python 后端 API
- Vue 3 前端控制台
- 一键启动与发布打包脚本

## 协作原则

先看这两个入口：

1. [AGENT.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/AGENT.md)  
   仓库规则、目录边界、CLI-first 原则都在这里。

2. [master/plans/MASTER_PLAN.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/master/plans/MASTER_PLAN.md)  
   当前的总计划、阶段顺序和下一步都从这里进入。

## 目录结构

- `docs/`
  - 正式文档资产
  - 包括课程要求、调研资料、操作手册

- `master/`
  - 计划、冻结稿、阶段回顾
  - `master/drafts/` 默认忽略，不进版本控制

- `ops/`
  - CLI 脚本
  - 包括启动、验证、备份恢复、打包

- `sql/`
  - migration 与数据库脚本

- `backend/`
  - 后端服务实现

- `frontend/`
  - 前端控制台实现

- `deploy/`
  - 轻量 deployment 基座和环境模板

## 推荐入口

### 操作手册

- [STARTUP_GUIDE.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/operations/STARTUP_GUIDE.md)
- [TESTING_GUIDE.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/operations/TESTING_GUIDE.md)
- [DEPLOYMENT_BASE_GUIDE.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/operations/DEPLOYMENT_BASE_GUIDE.md)
- [STACK_DETAILED_EXPLANATION.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/operations/STACK_DETAILED_EXPLANATION.md)

### 课程材料

- [MATERIALS_INDEX.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/course_materials/MATERIALS_INDEX.md)

### 当前计划

- [MASTER_PLAN.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/master/plans/MASTER_PLAN.md)
- [ACTIVE_PLAN.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/master/ACTIVE_PLAN.md)
- [CORE_ENTITIES_AND_MODULE_FREEZE.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/master/plans/CORE_ENTITIES_AND_MODULE_FREEZE.md)
- [WORK_REVIEW.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/master/plans/WORK_REVIEW.md)

## CLI 常用命令

### 一键拉起整套环境

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\start_stack.ps1
```

### 分步启动

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\00_start_docker.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\01_start_db.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\02_start_backend.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\03_start_frontend.ps1
```

### 关键验证

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\db\verify_hrms.ps1
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
powershell -ExecutionPolicy Bypass -File .\ops\deploy\build_release_bundle.ps1
```
