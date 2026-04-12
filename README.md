# DB Course Project

这是一个面向 **AI 协作开发** 的数据库课程项目工作区。

核心目标不是只存代码，而是让 AI 和人都能在这个仓库里快速搞清楚：

- 课程要求是什么
- 当前系统做到哪了
- 数据库、后端、前端怎么启动
- 下一步最值得做什么

## 项目定位

当前主线是：

- `基于 openGauss 的企业人力资源管理系统`

当前工程已经具备：

- openGauss 数据库基线
- Python 后端 API
- Vue 3 前端控制台
- 启动脚本和操作手册

## 工作方式

这个仓库强调两件事：

1. `AGENT.md` 优先  
   这是工作区的总规则文件，AI 与人工协作时都应优先参考。

2. `CLI First`  
   尽可能通过命令行完成：
   - 启动数据库
   - 启动后端
   - 启动前端
   - 运行验证脚本
   - 做日常开发与调试

## 目录说明

- `AGENT.md`
  - 工作区规则与执行边界

- `docs/`
  - 所有文档统一入口
  - 包括课程要求、项目输入材料、研究资料、操作手册、路线图

- `ops/`
  - 所有自动化脚本统一入口
  - 包括数据库、后端、前端和整套启动脚本

- `sql/`
  - 数据库 schema 与样例查询

- `backend/`
  - 后端服务实现

- `frontend/`
  - 前端界面实现

- `master/`
  - 规划、规范、阶段产物

## 最常用入口

### 操作手册

- [STARTUP_GUIDE.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/operations/STARTUP_GUIDE.md)

### 课程材料索引

- [MATERIALS_INDEX.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/course_materials/MATERIALS_INDEX.md)

### 下一阶段路线图

- [NEXT_PHASE_ROADMAP.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/roadmaps/NEXT_PHASE_ROADMAP.md)

## CLI 启动

按步骤启动：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\01_start_db.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\02_start_backend.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\03_start_frontend.ps1
```

一键启动：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\start_stack.ps1
```
