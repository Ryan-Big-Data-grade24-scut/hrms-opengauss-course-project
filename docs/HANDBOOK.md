# 项目总手册

## 这是什么

这是本仓库最重要的说明文档。

如果队友只看一份文档，就看这份。

这份文档的目标不是炫术语，而是用人话讲清楚：

1. 这个项目现在做成什么样了
2. 整个仓库分成哪几层
3. 每一层分别负责什么
4. 怎么启动、测试、备份、恢复
5. 队友接下来应该从哪里继续做

## 现在已经有什么

### 数据库

- 数据库名字：`hrms`
- 数据库软件：`openGauss`
- 运行方式：放在 Docker 容器里
- 数据不会因为简单重启就消失
- 数据库结构不是靠一个大 SQL 文件反复乱跑，而是按顺序一步步升级

当前已经有这些数据库升级脚本：

- `V1__baseline.sql`
- `V2__org_and_job.sql`
- `V3__employee_profile_and_history.sql`
- `V4__leave_type_and_leave_upgrade.sql`

### 后端

后端入口在：

- [backend/app.py](../backend/app.py)
- [backend/src/server.py](../backend/src/server.py)

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

- [frontend/src/main.js](../frontend/src/main.js)
- [frontend/src/router/index.js](../frontend/src/router/index.js)

当前已经有页面：

- 登录页
- 员工页
- 部门页
- 请假页
- 个人信息页

### 接口总说明

统一看：

- [master/contracts/openapi.yaml](../master/contracts/openapi.yaml)

它的作用就是：

- 告诉大家现在有哪些接口
- 哪些接口已经做了
- 哪些接口只是先定好，后面再实现

## 仓库一共分哪几层

这部分很重要。你可以把整个项目理解成 6 层。

### 第 1 层：文档层 `docs/`

这是“资料区”。

主要放：

- 总手册
- 调研总结
- 课程原始要求
- 小组已有原始材料
- 下载下来的参考资料

这一层是给人看的。

### 第 2 层：AI 工作区 / 项目状态层 `master/`

这是“当前状态区”。

主要放：

- 一份项目简报
- 一份共享接口契约

这一层的作用是让：

- 队友快速知道现在做到哪
- AI 快速知道系统边界和接口边界

### 第 3 层：前端层 `frontend/`

这是“页面层”。

它的任务很简单：

- 把后端接口展示成能点、能看、能演示的页面

前端开发时最重要的两件事：

1. 看清楚 `openapi.yaml` 里的请求和返回
2. 明确现在已经有的模块、还没做的模块

### 第 4 层：后端层 `backend/`

这是“接口层”。

你可以把它理解成：

- 前端发请求过来
- 后端接住
- 后端去查数据库
- 再把结果整理后返回给前端

所以后端本质上就是：

- 接收前端请求
- 组织 SQL 或调用数据库逻辑
- 返回 JSON

### 第 5 层：数据库设计层 `sql/`

这是“数据结构层”。

这里主要有两件事：

1. 数据库表结构本身
2. 数据库结构怎么一步一步升级

你可以把它理解成：

- 表和字段长什么样
- 哪些主体属于哪个业务域
- 以后加字段、加表时怎么安全升级

### 第 6 层：基础服务层 `ops/ + deploy/ + Docker`

这是“运行环境层”。

它主要负责：

- Docker 怎么起
- 数据库怎么起
- 后端怎么起
- 前端怎么起
- 怎么备份恢复
- 怎么打成发布包

这一层不直接实现业务，但没有它，整套系统跑不起来。

## 目录怎么理解

### `docs/`

放人看的资料。

### `master/`

放项目现状和共享接口说明。

### `frontend/`

放前端页面代码。

### `backend/`

放后端接口代码。

### `sql/`

放数据库结构和迁移脚本。

### `ops/`

放命令行脚本。

### `deploy/`

放部署模板和发布相关内容。

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

如果这台机器还没装 Docker，一键启动会直接停下来，并明确告诉你：

- 这个项目依赖 Docker Desktop
- 推荐安装地址
- 如果机器支持 `winget`，也会告诉你安装命令

也就是说，新队友即使第一次接触这个仓库，也不会一上来就只看到一堆看不懂的报错。

### 分步启动

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\00_start_docker.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\01_start_db.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\02_start_backend.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\03_start_frontend.ps1
```

每一步的意思：

- `00_start_docker.ps1`
  - 先把 Docker 这个运行环境拉起来
- `01_start_db.ps1`
  - 把 `openGauss` 数据库跑起来，并把数据库结构补到最新
- `02_start_backend.ps1`
  - 启动 Python 后端接口服务
- `03_start_frontend.ps1`
  - 启动前端页面

## 怎么测试项目

### 第一步：测数据库

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\db\verify_hrms.ps1
```

这一步是在确认：

- 数据库连得上
- 关键表还在
- 基础演示数据还在

### 第二步：测后端

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
```

这个脚本会自动做：

1. 用演示账号登录
2. 拿到 token
3. 查员工列表
4. 查部门列表
5. 查请假列表

如果通过，就说明：

- 后端正常
- 后端和数据库是通的

### 第三步：手动看数据库

```powershell
docker exec -e LD_LIBRARY_PATH=/usr/local/opengauss/lib -it opengauss-hrms /usr/local/opengauss/bin/gsql -h 127.0.0.1 -p 5432 -d hrms -U omm -W OpenGauss123!
```

进去后先执行：

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

意思就是：

- 把当前数据库导出来
- 存到 `backups/` 目录里

### 恢复

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\db\restore_hrms.ps1 -BackupFile .\backups\你的备份.sql
```

恢复时脚本会先做一件关键的事：

- 先把数据库里旧的业务表清掉
- 再把备份重新导进去

这样做是为了避免：

- 表已经存在
- 恢复到一半报错

## 怎么打包成发布包

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\deploy\build_release_bundle.ps1
```

它会生成：

- `dist/release_bundle`

你可以把它理解成：

- 这不是开发区
- 这是拿去部署、迁移、拷走的发布包

## 默认地址和账号

- 后端：`http://127.0.0.1:18080`
- 前端：`http://127.0.0.1:5173`
- 演示账号：`admin / 123456`
- 数据库账号：`omm / OpenGauss123!`

## 不同角色下一步看什么

### 想继续看项目现状和下一步

- [master/PROJECT_BRIEF.md](../master/PROJECT_BRIEF.md)

### 想看接口

- [master/contracts/openapi.yaml](../master/contracts/openapi.yaml)

### 想做后端

- [backend/README.md](../backend/README.md)

### 想做前端

- [frontend/README.md](../frontend/README.md)

### 想改数据库

- [sql/README.md](../sql/README.md)

### 想看基础服务和脚本

- [ops/README.md](../ops/README.md)
- [deploy/README.md](../deploy/README.md)

