# Core Entities And Module Freeze

这份文档就是第一步的正式产物。

目标只有一个：

> 在开始 migration、字段升级、前后端并行开发之前，先把 HR 的核心主体、模块边界和功能目标冻结下来。

## 1. 冻结原则

这次冻结不是把所有细节一次定死，而是先定住三层：

1. 核心主体
2. 模块边界
3. 模块功能目标

这样做的目的：

- 数据库同学知道下一次 migration 围绕什么做
- 后端同学知道接口资源怎么扩
- 前端同学知道页面模块怎么拆
- AI 在读仓库时能快速理解稳定边界

## 2. 冻结后的核心主体

这一轮先冻结下面这些主体。

### 权限与系统域

- `sys_user`
- `sys_role`
- `sys_permission`
- `sys_user_role`
- `sys_role_permission`
- `audit_log`

### 组织域

- `location`
- `department`
- `job`
- `position`

### 员工域

- `employee`
- `employee_profile`
- `employee_job_history`

### 假勤域

- `leave_type`
- `leave_request`

## 3. 本轮明确不纳入核心冻结的主体

这些不是不重要，而是本轮先不拉进主线：

- `attendance_record`
- `employee_contract`
- `salary_plan`
- `payroll_period`
- `candidate`
- `training_record`
- `performance_review`

原因：

- 课程核心评分不强依赖
- 当前阶段最重要的是先把正式 HR 基线做稳

## 4. 冻结后的模块边界

## 4.1 认证与权限模块

主体：

- `sys_user`
- `sys_role`
- `sys_permission`
- `sys_user_role`
- `sys_role_permission`

目标：

- 登录
- 当前用户信息
- 用户管理
- 角色分配
- 权限校验

## 4.2 组织目录模块

主体：

- `location`
- `department`
- `job`
- `position`

目标：

- 维护组织结构
- 维护职位类别
- 维护岗位实例
- 为员工模块提供字典和关系基础

## 4.3 员工主数据模块

主体：

- `employee`
- `employee_profile`

目标：

- 管理员工主身份信息
- 管理员工个人档案信息
- 提供员工列表、详情、增改删、筛选

## 4.4 员工任职历史模块

主体：

- `employee_job_history`

目标：

- 记录员工在部门、岗位、职位上的历史变化
- 为后续岗位调动、晋升、组织变更提供基础

## 4.5 请假模块

主体：

- `leave_type`
- `leave_request`

目标：

- 维护假种
- 员工提交请假
- 管理员审批请假
- 为审计和后续统计提供基础

## 4.6 审计模块

主体：

- `audit_log`

目标：

- 记录关键写操作
- 支撑系统可追踪性
- 为后续 AI 审计解释和备份恢复亮点保留基础

## 5. 冻结后的功能优先级

## P0：必须实现

- 认证与权限
- 组织目录
- 员工主数据
- 请假
- 审计日志基础展示

## P1：建议实现

- 员工任职历史展示
- 用户角色管理页
- 假种管理页

## P2：亮点扩展

- 备份恢复
- AI 查询助手
- AI 审计解释助手

## 6. 冻结后的接口资源方向

现有资源继续保留：

- `/api/auth/*`
- `/api/users`
- `/api/roles`
- `/api/departments`
- `/api/positions`
- `/api/employees`
- `/api/leaves`
- `/api/audits`

下一步新增资源方向：

- `/api/locations`
- `/api/jobs`
- `/api/leave-types`
- `/api/employees/{id}/profile`
- `/api/employees/{id}/job-history`

## 7. 冻结后的数据库升级方向

下一次 migration 按这个顺序推进：

1. `location`
2. `job`
3. `department` 升级
4. `position` 升级
5. `employee` 升级
6. `employee_profile`
7. `employee_job_history`
8. `leave_type`
9. `leave_request` 升级

## 8. 这份冻结文档的意义

它不是“最终数据库设计全文”，而是：

- 给 migration 提供稳定目标
- 给 OpenAPI 升级提供资源边界
- 给组员分工提供模块边界
- 给 AI 协作提供稳定语义入口

## 9. 一句话结论

从现在开始，这个项目的主线核心主体就按下面这组理解：

> 权限域 + 组织域 + 员工主数据域 + 员工任职历史域 + 假勤域 + 审计域

后续所有 migration、接口扩展和页面扩展，默认围绕这 6 个域推进。
