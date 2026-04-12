# 后端说明

## 这部分是干什么的

这是项目的后端。

它的作用可以直接理解成一句话：

- 接前端请求
- 查数据库
- 把结果按统一格式返回

所以后端本质上就是“前端和数据库之间的桥”。

## 当前后端是怎么工作的

这版后端故意做得比较轻，主要为了：

- 容易跑
- 容易读
- 队友和 AI 容易接手

当前做法是：

- 用 Python 标准库起 HTTP 服务
- 通过 `docker exec + gsql` 直接访问 `openGauss`
- 用简单的 Bearer Token 做登录态

## 后端目录怎么分

### `app.py`

后端启动入口。

### `src/server.py`

这里是后端总入口里最重要的文件。

它负责：

- 接收 HTTP 请求
- 把不同路径分发给不同模块
- 把结果统一返回

### `src/common/`

这里放公共工具。

比如：

- 统一响应格式
- 鉴权
- 数据库命令执行

### `src/services/`

这里放具体业务模块。

目前主要有：

- `auth_service.py`
- `user_service.py`
- `directory_service.py`
- `employee_service.py`
- `leave_service.py`
- `audit_service.py`

你可以把这些文件理解成：

- 每个文件负责一块业务

## 现在已经实现的模块

### 认证

- 登录
- 查看当前用户信息
- 登出

### 用户和角色

- 用户增删改查的一部分
- 角色列表
- 给用户分配角色

### 组织目录

- 部门
- 岗位

### 员工

- 员工列表
- 员工详情
- 员工新增
- 员工修改
- 员工删除

### 请假

- 请假列表
- 提交请假
- 审批通过
- 审批拒绝

### 审计

- 审计日志查询

## 已经先定义、后面再实现的模块

这些已经写进接口总说明里了，但代码还没完全做出来：

- 地点 `locations`
- 职位类型 `jobs`
- 请假类型 `leave-types`
- 员工扩展资料 `employee profile`
- 员工任职历史 `employee job history`

统一看这里：

- [master/contracts/openapi.yaml](../master/contracts/openapi.yaml)

## 接口开发时最重要的三件事

1. 先看 `openapi.yaml`
   - 先确认接口路径、请求体、返回体
2. 再看 `server.py`
   - 看路由有没有接进去
3. 最后写 `services/`
   - 在具体业务模块里写逻辑

## 怎么启动后端

在仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\backend\start_backend.ps1
```

默认地址：

- `http://127.0.0.1:18080`

## 怎么快速验证后端

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
```

这个脚本会自动验证：

- 能不能登录
- 能不能查员工
- 能不能查部门
- 能不能查请假

## 队友继续做后端时建议顺序

建议优先补这些资源：

1. `locations`
2. `jobs`
3. `leave-types`
4. `employee profile`
5. `employee job history`

原因是：

- 它们已经在接口总说明里冻结了
- 也和升级后的企业 HR 数据结构一致

