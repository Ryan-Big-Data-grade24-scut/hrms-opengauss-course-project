# API Spec

## 统一约定

### Base

- 建议前缀：`/api`

### 响应格式

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

### 分页格式

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [],
    "total": 0,
    "page": 1,
    "page_size": 10
  }
}
```

### 错误码建议

- `0`：成功
- `4001`：参数错误
- `4003`：权限不足
- `4004`：资源不存在
- `4009`：数据冲突
- `5000`：系统错误

## 模块 1：认证

### `POST /api/auth/login`

用途：

- 用户登录

请求体：

```json
{
  "username": "admin",
  "password": "123456"
}
```

返回：

- token
- 当前用户基本信息
- 角色列表

### `GET /api/auth/profile`

用途：

- 获取当前登录用户信息

### `POST /api/auth/logout`

用途：

- 退出登录

## 模块 2：用户与权限

### `GET /api/users`

用途：

- 用户列表

查询参数：

- `page`
- `page_size`
- `username`
- `status`

### `POST /api/users`

用途：

- 新增用户

### `PUT /api/users/{user_id}`

用途：

- 修改用户

### `DELETE /api/users/{user_id}`

用途：

- 删除用户

### `GET /api/roles`

用途：

- 角色列表

### `PUT /api/users/{user_id}/roles`

用途：

- 给用户分配角色

## 模块 3：部门管理

### `GET /api/departments`

用途：

- 查询部门列表

### `POST /api/departments`

用途：

- 新增部门

### `PUT /api/departments/{department_id}`

用途：

- 修改部门

### `DELETE /api/departments/{department_id}`

用途：

- 删除部门

## 模块 4：岗位管理

### `GET /api/positions`

用途：

- 查询岗位列表

### `POST /api/positions`

用途：

- 新增岗位

### `PUT /api/positions/{position_id}`

用途：

- 修改岗位

### `DELETE /api/positions/{position_id}`

用途：

- 删除岗位

## 模块 5：员工管理

### `GET /api/employees`

用途：

- 员工分页查询

查询参数：

- `page`
- `page_size`
- `keyword`
- `department_id`
- `position_id`
- `employment_status`
- `hire_date_start`
- `hire_date_end`

### `GET /api/employees/{employee_id}`

用途：

- 员工详情

### `POST /api/employees`

用途：

- 新增员工

### `PUT /api/employees/{employee_id}`

用途：

- 修改员工

### `DELETE /api/employees/{employee_id}`

用途：

- 删除员工

## 模块 6：请假管理

### `GET /api/leaves`

用途：

- 请假记录分页查询

查询参数：

- `page`
- `page_size`
- `employee_id`
- `approval_status`
- `start_date`
- `end_date`

### `POST /api/leaves`

用途：

- 提交请假申请

### `PUT /api/leaves/{leave_id}/approve`

用途：

- 审批通过

### `PUT /api/leaves/{leave_id}/reject`

用途：

- 审批拒绝

## 模块 7：审计日志

### `GET /api/audits`

用途：

- 查询审计日志

查询参数：

- `page`
- `page_size`
- `username`
- `action_type`
- `target_type`
- `start_time`
- `end_time`

## 模块 8：备份恢复亮点接口（预留）

### `GET /api/backups`

- 查询备份记录

### `POST /api/backups`

- 触发备份

### `POST /api/restores`

- 触发恢复

## 当前接口优先级

### P0 必做

- `POST /api/auth/login`
- `GET /api/employees`
- `POST /api/employees`
- `PUT /api/employees/{employee_id}`
- `DELETE /api/employees/{employee_id}`
- `GET /api/departments`
- `GET /api/positions`
- `GET /api/leaves`

### P1 次优先

- 用户角色管理
- 审计日志查询

### P2 亮点

- 备份恢复接口
- AI 查询助手接口
