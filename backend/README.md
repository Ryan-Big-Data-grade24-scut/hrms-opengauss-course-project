# Backend

当前后端已经落成一版“最小可跑”的 API 服务，目标是先把课程项目的数据库闭环跑通。

## 技术选型

- 运行时：`Python 3.12+`
- HTTP：标准库 `http.server`
- 数据访问：通过 `docker exec + gsql` 直接访问 openGauss
- 鉴权：进程内 Bearer Token

这版优先保证零额外依赖、能直接启动、能对接当前 `hrms` 数据库。

## 已实现接口

- `POST /api/auth/login`
- `GET /api/auth/profile`
- `POST /api/auth/logout`
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/{user_id}`
- `DELETE /api/users/{user_id}`
- `GET /api/roles`
- `PUT /api/users/{user_id}/roles`
- `GET /api/departments`
- `POST /api/departments`
- `PUT /api/departments/{department_id}`
- `DELETE /api/departments/{department_id}`
- `GET /api/positions`
- `POST /api/positions`
- `PUT /api/positions/{position_id}`
- `DELETE /api/positions/{position_id}`
- `GET /api/employees`
- `GET /api/employees/{employee_id}`
- `POST /api/employees`
- `PUT /api/employees/{employee_id}`
- `DELETE /api/employees/{employee_id}`
- `GET /api/leaves`
- `POST /api/leaves`
- `PUT /api/leaves/{leave_id}/approve`
- `PUT /api/leaves/{leave_id}/reject`
- `GET /api/audits`
- `GET /api/backups`
- `POST /api/backups`
- `POST /api/restores`

## 目录说明

- `app.py`：启动入口
- `src/server.py`：路由和 HTTP 处理
- `src/common/`：响应、鉴权、数据库命令执行
- `src/services/`：各模块业务逻辑
- `scripts/start_backend.ps1`：启动脚本
- `scripts/smoke_test.ps1`：最小联调脚本

## 启动方式

先确保：

- Docker 正常
- `opengauss-hrms` 容器正在运行
- `hrms` 数据库已经初始化

然后在仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\scripts\start_backend.ps1
```

默认监听：

- `http://127.0.0.1:8080`

## 演示账号

- 用户名：`admin`
- 密码：`123456`

说明：

- 现有种子用户的密码字段是演示占位值，所以后端做了兼容。
- 新创建用户会改用 `sha256` 存储。

## 联调自检

服务启动后可执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\scripts\smoke_test.ps1
```

它会依次验证：

- 登录
- 员工列表
- 部门列表
- 请假列表
