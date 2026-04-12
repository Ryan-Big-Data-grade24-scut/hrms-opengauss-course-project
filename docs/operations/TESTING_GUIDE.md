# Testing Guide

这份手册面向当前仓库的整套运行面，目标不是只测某一个接口，而是按顺序确认：

1. Docker 和 openGauss 正常
2. 数据库结构、迁移、样例数据正常
3. 备份恢复能力正常
4. 后端 API 正常
5. 前端联调正常
6. 发布包可构建

建议从仓库根目录执行所有命令：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
```

## 1. 启动 Docker

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\startup\00_start_docker.ps1
```

这一步在干什么：

- 检查 Docker Engine 是否已经可用
- 如果还没可用，就尝试启动 Docker Desktop
- 持续轮询直到 `docker version` 能返回 `Client + Server`

这一步通过意味着什么：

- 后面的容器命令终于有执行对象了
- 你后面跑 openGauss、备份恢复、构建发布时不会卡在 Docker 层

## 2. 启动数据库并初始化

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\startup\01_start_db.ps1
```

这一步在干什么：

- 检查并启动 openGauss 容器 `opengauss-hrms`
- 如果数据库还没初始化，就创建 `hrms`
- 自动执行 `sql/migrations/` 下的迁移脚本
- 最后再跑一次数据库验证

这一步通过意味着什么：

- 数据库不只是“开机了”
- 还已经带着当前最新版本的数据结构运行起来了

## 3. 验证数据库基线

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\db\verify_hrms.ps1
```

这一步在干什么：

- 检查 `hrms` 是否存在
- 检查核心表是否存在
- 检查样例数据是否存在

你在验证什么：

- 当前 migration 是否已经落库
- 当前数据库不是空壳
- 后端后面拿到的是一个可联调的库

## 4. 检查 migration 历史

```powershell
docker exec -e LD_LIBRARY_PATH=/usr/local/opengauss/lib -it opengauss-hrms /usr/local/opengauss/bin/gsql -h 127.0.0.1 -p 5432 -d hrms -U omm -W OpenGauss123!
```

进去后执行：

```sql
select version, description, status from schema_migration_history order by applied_at;
```

这一步在干什么：

- 直接确认 `V1 / V2 / V3 / V4` 是否真的执行过

退出：

```sql
\q
```

## 5. 测备份能力

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\db\backup_hrms.ps1
```

这一步在干什么：

- 导出当前 `hrms`
- 把备份文件保存到 `backups/`

这一步通过意味着什么：

- 你们已经具备“当前数据可带走”的最小能力

## 6. 测恢复能力

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\db\restore_hrms.ps1 -BackupFile .\backups\你的备份文件.sql
```

这一步在干什么：

- 删除并重建 `hrms`
- 把指定的备份文件重新导入

注意：

- 这是恢复动作，会覆盖当前 `hrms`
- 跑完后建议立刻再执行一次 `verify_hrms.ps1`

## 7. 启动后端

新开一个 PowerShell 窗口执行：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\backend\start_backend.ps1
```

这一步在干什么：

- 启动 Python 后端
- 让前端和测试脚本能通过 HTTP 调接口

默认地址：

```text
http://127.0.0.1:18080
```

## 8. 跑后端最小联调

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
```

这一步在干什么：

- 登录
- 拿 token
- 查员工
- 查部门
- 查请假

这一步通过意味着什么：

- 数据库到后端这条链路是通的
- 鉴权、基础查询、JSON 返回结构都正常

## 9. 手动测关键 API

### 9.1 登录拿 token

```powershell
$login = Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:18080/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"123456"}'

$token = $login.data.token
$headers = @{ Authorization = "Bearer $token" }
```

这一步在干什么：

- 手动验证认证接口
- 后续所有受保护接口都复用 `$headers`

### 9.2 查员工列表

```powershell
Invoke-RestMethod -Method Get `
  -Uri "http://127.0.0.1:18080/api/employees?page=1&page_size=10" `
  -Headers $headers | ConvertTo-Json -Depth 6
```

这一步在干什么：

- 验证员工资源接口
- 验证分页结构
- 验证员工与部门、岗位的 join 结果

### 9.3 查部门、岗位、请假、审计

```powershell
Invoke-RestMethod -Method Get `
  -Uri "http://127.0.0.1:18080/api/departments" `
  -Headers $headers | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Get `
  -Uri "http://127.0.0.1:18080/api/positions" `
  -Headers $headers | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Get `
  -Uri "http://127.0.0.1:18080/api/leaves?page=1&page_size=10" `
  -Headers $headers | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Get `
  -Uri "http://127.0.0.1:18080/api/audits?page=1&page_size=10" `
  -Headers $headers | ConvertTo-Json -Depth 6
```

这一步在干什么：

- 验证组织目录资源
- 验证请假数据和审计日志

## 10. 测员工 CRUD

### 10.1 新增员工

```powershell
$createBody = @{
  employee_no = "E2026999"
  full_name = "cli_test_user"
  gender = "M"
  hire_date = "2026-04-12"
  employment_status = "active"
  department_id = 1
  position_id = 1
} | ConvertTo-Json

$created = Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:18080/api/employees" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $createBody

$employeeId = $created.data.employee_id
```

这一步在干什么：

- 验证创建接口
- 同时验证数据库写入

### 10.2 修改员工

```powershell
$updateBody = @{
  full_name = "cli_test_user_updated"
  phone = "13900000001"
} | ConvertTo-Json

Invoke-RestMethod -Method Put `
  -Uri "http://127.0.0.1:18080/api/employees/$employeeId" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $updateBody | ConvertTo-Json -Depth 6
```

### 10.3 删除员工

```powershell
Invoke-RestMethod -Method Delete `
  -Uri "http://127.0.0.1:18080/api/employees/$employeeId" `
  -Headers $headers | ConvertTo-Json -Depth 6
```

这一步在干什么：

- 验证更新和删除接口
- 同时清理测试数据

## 11. 启动前端

新开一个 PowerShell 窗口执行：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\frontend\start_frontend.ps1
```

默认地址：

```text
http://127.0.0.1:5173
```

推荐验证动作：

1. 登录 `admin / 123456`
2. 打开员工页，看是否能出列表
3. 打开部门/岗位页，看目录数据是否正常
4. 打开请假页，看列表是否正常

## 12. 构建发布包

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\deploy\build_release_bundle.ps1
```

这一步在干什么：

- 打包后端代码
- 打包前端构建产物
- 打包部署模板和运维脚本

输出目录：

- `dist/release_bundle`

## 13. 推荐完整验证顺序

1. `00_start_docker.ps1`
2. `01_start_db.ps1`
3. `verify_hrms.ps1`
4. `backup_hrms.ps1`
5. `start_backend.ps1`
6. `smoke_test.ps1`
7. 手动 API 测试
8. `start_frontend.ps1`
9. 浏览器联调
10. `build_release_bundle.ps1`

## 14. 你到底在验证什么

如果你跑完上面的流程，其实验证的是 6 件事：

1. 容器能跑起来
2. 数据库结构能被自动初始化并演进
3. 数据能被导出和恢复
4. 后端 API 能真实访问数据库
5. 前端能真实联到后端
6. 当前仓库能被整理成一个可交付发布包

## 15. 相关文档

- [STARTUP_GUIDE.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/operations/STARTUP_GUIDE.md)
- [DEPLOYMENT_BASE_GUIDE.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/operations/DEPLOYMENT_BASE_GUIDE.md)
- [STACK_DETAILED_EXPLANATION.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/docs/operations/STACK_DETAILED_EXPLANATION.md)
- [MASTER_PLAN.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/master/plans/MASTER_PLAN.md)
