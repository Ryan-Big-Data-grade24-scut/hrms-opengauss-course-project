# 数据库说明

## 这部分是干什么的

这里放的是数据库相关内容。

主要分两类：

1. 当前数据库结构
2. 数据库结构以后怎么升级

## 为什么这里很重要

因为这个项目不是“写几个页面”那么简单。

所有前端和后端功能，最后都要落到数据库里：

- 表怎么设计
- 字段怎么设计
- 表和表怎么关联
- 后面怎么加新表和新字段

这些都在这一层决定。

## 当前目录里有什么

### `migrations/`

这里最重要。

你可以把它理解成：

- 数据库不是一次建完就永远不变
- 以后需要新表、新字段、新索引时，就按顺序补新的迁移脚本

当前已经有：

- `V1__baseline.sql`
- `V2__org_and_job.sql`
- `V3__employee_profile_and_history.sql`
- `V4__leave_type_and_leave_upgrade.sql`

### `10_hrms_schema.sql`

这是之前的整体建表 SQL，更适合当参考，不再是后续升级的正式主入口。

### `20_sample_queries.sql`

这里放一些示例查询，方便理解当前数据库能怎么查。

## 数据库结构现在大概分哪些业务域

### 权限域

负责：

- 用户
- 角色
- 权限

### 组织域

负责：

- 地点
- 部门
- 岗位
- 职位类型

### 员工主数据域

负责：

- 员工主表
- 员工扩展资料

### 员工任职历史域

负责：

- 员工过去在哪个部门、什么岗位、什么时候变动

### 请假域

负责：

- 请假类型
- 请假申请
- 审批状态

### 审计域

负责：

- 谁做了什么操作
- 操作发生在什么时候

## 队友如果要改数据库，正确顺序是什么

1. 先确认业务上要增加什么主体或字段
2. 再看当前 `openapi.yaml` 和后端是否会用到它
3. 新增一个 migration，而不是直接乱改老 SQL
4. 跑迁移
5. 验证数据库

## 相关脚本

最常用的是：

- [ops/db/apply_migrations.ps1](../ops/db/apply_migrations.ps1)
- [ops/db/init_hrms.ps1](../ops/db/init_hrms.ps1)
- [ops/db/verify_hrms.ps1](../ops/db/verify_hrms.ps1)
- [ops/db/backup_hrms.ps1](../ops/db/backup_hrms.ps1)
- [ops/db/restore_hrms.ps1](../ops/db/restore_hrms.ps1)

