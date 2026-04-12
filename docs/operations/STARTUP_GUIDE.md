# Startup Guide

这份手册把当前课程项目的启动方式、脚本位置和推荐操作顺序统一下来。

## 1. 目录总览

### 课程材料

- [企业人力管理系统.docx](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/course_materials/project_inputs/企业人力管理系统.docx)
- [人力管理系统设计文档.pdf](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/course_materials/project_inputs/人力管理系统设计文档.pdf)
- [Backup_Recovery_System_Architecture.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/course_materials/project_inputs/Backup_Recovery_System_Architecture.md)
- [memory.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/course_materials/project_inputs/memory.md)

### 自动化脚本

- 数据库脚本：`ops/db`
- 后端脚本：`ops/backend`
- 前端脚本：`ops/frontend`
- 总启动入口：`ops/startup`

## 2. 推荐启动顺序

### 方式 A：按步骤启动

#### 第一步：启动数据库并初始化

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\01_start_db.ps1
```

这一步会依次做：

- 启动 openGauss 容器
- 初始化 `hrms` 数据库
- 执行验证 SQL

#### 第二步：启动后端

新开一个 PowerShell 窗口执行：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\02_start_backend.ps1
```

默认后端地址：

```text
http://127.0.0.1:8080
```

#### 第三步：启动前端

再开一个 PowerShell 窗口执行：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\03_start_frontend.ps1
```

默认前端地址：

```text
http://127.0.0.1:5173
```

### 方式 B：一键拉起整套环境

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\start_stack.ps1
```

这条命令会：

- 先处理数据库
- 再分别打开后端和前端窗口

## 3. 单独脚本说明

### 数据库

- `ops/db/start_opengauss.ps1`
  - 启动 openGauss 容器

- `ops/db/init_hrms.ps1`
  - 创建 `hrms` 数据库
  - 导入 `sql/10_hrms_schema.sql`

- `ops/db/verify_hrms.ps1`
  - 验证核心表和样例数据

### 后端

- `ops/backend/start_backend.ps1`
  - 启动 Python 后端

- `ops/backend/smoke_test.ps1`
  - 对后端做最小联调测试

### 前端

- `ops/frontend/start_frontend.ps1`
  - 启动 Vite 开发服务器

## 4. 启动后建议验证

### 验证数据库

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\db\verify_hrms.ps1
```

### 验证后端

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
```

### 验证前端

浏览器打开：

```text
http://127.0.0.1:5173
```

登录账号：

```text
admin / 123456
```

## 5. 停止方式

### 停止前端/后端

如果是前台运行，直接关闭对应 PowerShell 窗口。

如果需要强制结束：

```powershell
Get-Process python | Stop-Process -Force
Get-Process node | Stop-Process -Force
```

### 停止数据库

```powershell
docker stop opengauss-hrms
```

## 6. 最常用命令速查

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\01_start_db.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\02_start_backend.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\03_start_frontend.ps1
```
