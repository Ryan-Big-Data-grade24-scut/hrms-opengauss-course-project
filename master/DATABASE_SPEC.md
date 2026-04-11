# Database Spec

## 当前数据库

- 数据库名：`hrms`
- 数据库平台：`openGauss`
- 当前目标：先支撑最小可验证的人力资源管理系统

## 核心实体

### 1. `sys_user`

用途：

- 系统登录账号
- 和业务员工信息解耦

关键字段：

- `user_id`
- `username`
- `password_hash`
- `full_name`
- `status`

### 2. `sys_role`

用途：

- 定义角色类型

当前预置角色：

- `ADMIN`
- `HR`
- `EMPLOYEE`

### 3. `sys_permission`

用途：

- 定义细粒度权限点

当前预置权限：

- `user.manage`
- `employee.manage`
- `department.manage`
- `leave.manage`
- `audit.view`

### 4. `sys_user_role`

用途：

- 用户和角色的多对多关联

### 5. `sys_role_permission`

用途：

- 角色和权限的多对多关联

### 6. `department`

用途：

- 部门管理

当前示例：

- 研发部
- 人事部
- 市场部

### 7. `position`

用途：

- 岗位管理

当前示例：

- 后端开发工程师
- HR专员
- 市场专员

### 8. `employee`

用途：

- 业务核心表
- 员工信息主表

关键字段：

- `employee_id`
- `employee_no`
- `full_name`
- `hire_date`
- `employment_status`
- `department_id`
- `position_id`

### 9. `leave_request`

用途：

- 请假申请与审批

关键字段：

- `leave_id`
- `employee_id`
- `leave_type`
- `start_date`
- `end_date`
- `approval_status`

### 10. `audit_log`

用途：

- 审计日志
- 后续可用于接口日志、操作日志、备份恢复日志

## 关系说明

### 权限域关系

- `sys_user` <- `sys_user_role` -> `sys_role`
- `sys_role` <- `sys_role_permission` -> `sys_permission`

这部分解决：

- 谁能登录
- 登录后是什么角色
- 角色能做什么

### 组织域关系

- `department` 1 -> N `employee`
- `position` 1 -> N `employee`

这部分解决：

- 员工属于哪个部门
- 员工担任什么岗位

### 请假域关系

- `employee` 1 -> N `leave_request`

这部分解决：

- 哪个员工发起了哪些请假
- 当前请假状态是什么

### 审计域关系

- `audit_log` 当前先独立存储
- 后续由接口层负责写入 `username / action_type / target_type / target_id`

## 第一阶段必须支持的查询

### 用户权限相关

- 登录用户信息查询
- 用户角色查询
- 角色权限查询

### 员工管理相关

- 员工列表分页查询
- 按姓名模糊查询
- 按部门筛选
- 按岗位筛选
- 按入职时间范围查询

### 请假管理相关

- 员工请假列表
- 待审批请假查询
- 按状态筛选请假记录

### 审计相关

- 按用户查询审计日志
- 按时间范围查询审计日志

## 索引说明

当前已建索引：

- `idx_employee_department`
- `idx_employee_position`
- `idx_employee_hire_date`
- `idx_employee_status`
- `idx_leave_employee`
- `idx_leave_status`
- `idx_audit_created_at`
- `idx_audit_username`

这些索引优先服务于：

- 后台列表筛选
- 组合查询
- 审计检索

## 当前数据库结论

当前这套表已经足够支撑：

- 登录与 RBAC
- 员工管理
- 部门岗位管理
- 请假管理
- 审计日志展示

后面如果要扩展，可以继续加：

- 招聘模块
- 调岗/晋升模块
- 培训模块
- 绩效模块
- 备份恢复元数据表
