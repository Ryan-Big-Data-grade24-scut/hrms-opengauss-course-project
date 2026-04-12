# 项目总手册

## 这是什么

这是本仓库最重要的说明文档。

如果队友只想看一份文档，那就看这份。

这份手册主要回答 4 个问题：

1. 这个项目现在做成什么样了
2. 怎么把它跑起来
3. 怎么检查它有没有跑通
4. 后面应该从哪里接着做

## 现在已经有什么

### 数据库

- 数据库名字：`hrms`
- 用的是：Docker 里的 `openGauss`
- 数据不会随着简单重启就消失
- 数据库结构不是靠一个大 SQL 文件乱跑，而是按顺序升级

这里的“按顺序升级”你可以简单理解成：

- 第一版先建最基础的表
- 后面需要新表、新字段时，再补第二版、第三版
- 这样大家不会互相覆盖数据库结构

当前已经有这些升级脚本：

- `V1__baseline.sql`
- `V2__org_and_job.sql`
- `V3__employee_profile_and_history.sql`
- `V4__leave_type_and_leave_upgrade.sql`

### 后端

后端入口在：

- [backend/app.py](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/app.py)
- [backend/src/server.py](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/server.py)

已经能跑的模块有：

- 登录与身份认证
- 用户和角色
- 部门
- 岗位
- 员工
- 请假
- 审计日志

### 前端

前端入口在：

- [frontend/src/main.js](/e:/Ufolder/Current/ActionSys/Hgclass/DB/frontend/src/main.js)
- [frontend/src/router/index.js](/e:/Ufolder/Current/ActionSys/Hgclass/DB/frontend/src/router/index.js)

现在已经有页面：

- 登录页
- 员工页
- 部门页
- 请假页
- 个人信息页

### 接口说明

接口总说明在：

- [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)

它的作用很简单：

- 告诉大家现在有哪些接口
- 哪些接口已经做了
- 哪些接口只是先定好，后面再做

## 目录怎么理解

### `docs/`

这是资料区。

里面放：

- 总手册
- 调研总结
- 老师给的要求
- 你们组自己原来的文档
- 下载下来的参考材料

### `master/`

这是项目当前状态区。

里面只放：

- 一份项目简报
- 一份共享接口契约

### `sql/`

这是数据库脚本区。

最重要的是：

- `sql/migrations/`

这里放的是数据库一步一步升级的脚本。

### `ops/`

这是命令行脚本区。

里面分成：

- `startup/`：启动相关
- `db/`：数据库相关
- `backend/`：后端启动和测试
- `deploy/`：打包发布

## 怎么启动项目

所有命令都从仓库根目录执行。

### 一键启动

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\start_stack.ps1
```

这个命令会依次做这些事：

1. 检查并拉起 Docker
2. 启动数据库容器
3. 确保数据库存在，并补上该执行的数据库升级脚本
4. 启动后端
5. 启动前端

### 分步启动

如果你想看每一步在干什么，就按下面来：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\00_start_docker.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\01_start_db.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\02_start_backend.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\03_start_frontend.ps1
```

每一步的意思是：

- `00_start_docker.ps1`
  - 先把 Docker 这个容器运行环境拉起来
- `01_start_db.ps1`
  - 把 `openGauss` 数据库跑起来，并把数据库结构补到最新
- `02_start_backend.ps1`
  - 启动 Python 后端接口服务
- `03_start_frontend.ps1`
  - 启动前端页面

## 怎么测试项目

### 1. 先测数据库

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\db\verify_hrms.ps1
```

这个动作是在确认：

- 数据库连得上
- 关键表还在
- 基础演示数据还在

### 2. 再测后端

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
```

这个脚本会自动做这些事：

1. 用演示账号登录
2. 拿到 token
3. 查员工列表
4. 查部门列表
5. 查请假列表

如果这个脚本通过，就说明：

- 后端正常
- 后端和数据库是通的

### 3. 手动看数据库

```powershell
docker exec -e LD_LIBRARY_PATH=/usr/local/opengauss/lib -it opengauss-hrms /usr/local/opengauss/bin/gsql -h 127.0.0.1 -p 5432 -d hrms -U omm -W OpenGauss123!
```

进去之后可以先执行：

```sql
\dt
select version, filename, applied_at from schema_migration_history order by applied_at;
select employee_no, full_name, employment_status from employee;
\q
```

这些命令分别在看：

- `\dt`
  - 当前数据库里有哪些表
- `schema_migration_history`
  - 数据库结构已经升级到了哪几步
- 员工查询
  - 当前业务数据是不是正常

## 怎么备份和恢复数据

### 备份

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\db\backup_hrms.ps1
```

意思是：

- 把当前数据库导出来
- 存到 `backups/` 目录里

### 恢复

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\db\restore_hrms.ps1 -BackupFile .\backups\你的备份.sql
```

恢复时脚本会先做一件重要的事：

- 先把数据库里旧的业务表清掉
- 再把备份重新导进去

这样做的目的就是避免：

- “表已经存在”
- “恢复到一半报错”

## 怎么打包成发布包

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\deploy\build_release_bundle.ps1
```

这个命令会生成：

- `dist/release_bundle`

你可以把它理解成：

- 这不是开发区
- 这是拿去部署、迁移、拷走的发布包

## 现在默认地址和账号

- 后端地址：`http://127.0.0.1:18080`
- 前端地址：`http://127.0.0.1:5173`
- 演示账号：`admin / 123456`
- 数据库账号：`omm / OpenGauss123!`

## 下一步看什么

- 想知道项目当前做到了哪一步、接下来干什么：
  - [master/PROJECT_BRIEF.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/PROJECT_BRIEF.md)
- 想知道接口有哪些：
  - [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)
- 想看后端模块说明：
  - [backend/README.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/README.md)
- 想看前端模块说明：
  - [frontend/README.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/frontend/README.md)
