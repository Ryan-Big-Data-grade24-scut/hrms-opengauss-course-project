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

### 当前推荐手册

- 启动与运行：`docs/operations/STARTUP_GUIDE.md`
- 详细测试：`docs/operations/TESTING_GUIDE.md`
- 部署基座：`docs/operations/DEPLOYMENT_BASE_GUIDE.md`
- 架构说明：`docs/operations/STACK_DETAILED_EXPLANATION.md`

## 2. 推荐启动顺序

### 方式 A：按步骤启动

#### 第零步：确保 Docker Desktop 可用

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\00_start_docker.ps1
```

这一步会：

- 检查 Docker Engine 是否已经可用
- 如果没有可用，就尝试启动 Docker Desktop
- 等待到 Docker Engine 真正 ready

#### 第一步：启动数据库并初始化

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\01_start_db.ps1
```

这一步会依次做：

- 启动 openGauss 容器
- 初始化 `hrms` 数据库
- 执行 `sql/migrations/` 下的版本化迁移脚本
- 执行验证 SQL

#### 第二步：启动后端

新开一个 PowerShell 窗口执行：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\02_start_backend.ps1
```

默认后端地址：

```text
http://127.0.0.1:18080
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

- `ops/startup/00_start_docker.ps1`
  - 启动 Docker Desktop
  - 等待 Docker Engine 可用

- `ops/db/start_opengauss.ps1`
  - 启动 openGauss 容器

- `ops/db/init_hrms.ps1`
  - 创建 `hrms` 数据库
  - 执行 `sql/migrations/` 下的版本化迁移脚本

- `ops/db/apply_migrations.ps1`
  - 按顺序执行 `V1__*.sql`、`V2__*.sql` 等迁移脚本
  - 维护 `schema_migration_history`

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

如果要做完整回归，而不是只看最小联调，继续读：

- [TESTING_GUIDE.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/operations/TESTING_GUIDE.md)

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
powershell -ExecutionPolicy Bypass -File .\ops\startup\00_start_docker.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\01_start_db.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\02_start_backend.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\03_start_frontend.ps1
```

## 7. 数据库持久化升级

新环境首次创建 openGauss 容器时，`ops/db/start_opengauss.ps1` 会默认使用命名卷：

- `opengauss-hrms-data`

如果你已经有一个历史容器，而且它没有挂载卷，可以用下面的迁移脚本把当前数据库迁移到持久化容器：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\db\upgrade_to_persistent_container.ps1
```

这个脚本会：

1. 先逻辑导出当前 `hrms`
2. 把导出文件保存到仓库 `backups/`
3. 停掉并删除旧容器
4. 用命名卷重建新容器
5. 把逻辑备份恢复进去

## 8. 当前 migration 结构

当前数据库初始化不再只依赖单一 baseline 文件，而是按下面结构执行：

- `sql/migrations/V1__baseline.sql`
- `sql/migrations/V2__org_and_job.sql`
- `sql/migrations/V3__employee_profile_and_history.sql`
- `sql/migrations/V4__leave_type_and_leave_upgrade.sql`

这意味着：

- 后续表结构升级应继续新增 migration 文件
- 不建议再把所有变化重新塞回 `sql/10_hrms_schema.sql`
