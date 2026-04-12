# Database Evolution And Deployment Truth

这份文档记录当前最关键的两个认识：

1. 现有数据库字段设计太弱，必须升级
2. 本地开发、云端迁移、多人协作时，数据库不能只靠一个 baseline SQL 和 git

## 1. 当前数据库设计为什么偏弱

当前数据库基线可以支撑最小演示，但离“正式企业 HR 系统”还有明显差距。

当前主要只有：

- 用户 / 角色 / 权限
- 部门
- 岗位
- 员工
- 请假
- 审计

这套设计适合做最小课设闭环，但不够像真实企业系统。

## 2. 正式企业 HR 系统更常见的主体

成熟 HR 系统通常不只管理“员工和请假”，还会拆出这些主体：

### 组织域

- `company`
- `department`
- `location`
- `job`
- `position`

### 人员主数据

- `employee`
- `employee_profile`
- `emergency_contact`
- `education_record`

### 任职与历史

- `employee_job_assignment`
- `employee_job_history`
- `contract`
- `transfer_record`

### 假勤域

- `leave_type`
- `leave_balance`
- `leave_request`
- `attendance_record`
- `shift_schedule`

### 薪酬与生命周期

- `salary_plan`
- `employee_compensation`
- `candidate`
- `onboarding_task`
- `termination_record`

### 安全与审计

- `sys_user`
- `sys_role`
- `sys_permission`
- `audit_log`

## 3. 当前最值得补的数据库升级方向

不建议一次做全，而是分阶段升级。

## P0：优先补

这些最能提升“像正式 HR 系统”的程度。

- `location`
- `job`
- `employee_profile`
- `employee_job_history`

## P1：第二阶段补

- `leave_type`
- `leave_balance`
- `attendance_record`
- `employee_contract`

## 4. 当前核心表建议怎么升级

## `department`

建议补：

- `department_code`
- `location_id`
- `manager_employee_id`
- `description`

## `position`

建议升级成更明确的“岗位编制/岗位实例”：

- `position_code`
- `job_id`
- `department_id`
- `headcount`
- `status`

## `job`

新表，表示岗位族或职位类别：

- `job_code`
- `job_title`
- `job_grade`
- `min_salary`
- `max_salary`

## `employee`

建议保留员工主身份信息：

- `employee_no`
- `full_name`
- `gender`
- `birth_date`
- `phone`
- `email`
- `id_card_no`
- `hire_date`
- `employment_status`

## `employee_profile`

新表，表示扩展档案：

- `employee_id`
- `address`
- `emergency_contact_name`
- `emergency_contact_phone`
- `education_level`
- `marital_status`

## `employee_job_history`

新表，表示任职历史：

- `employee_id`
- `department_id`
- `position_id`
- `job_id`
- `manager_employee_id`
- `start_date`
- `end_date`
- `change_reason`

## `leave_request`

建议至少补：

- `leave_type_id`
- `approver_user_id`
- `approved_at`
- `approval_comment`

## 5. 当前数据库数据到底存在哪里

当前风险判断要说清楚：

- 现在的数据**不是存在镜像里**
- 但当前也**没有挂载宿主机卷**
- 数据主要存在 **容器的可写层**

这意味着：

- `docker stop` / `docker start` 后，数据通常还在
- 但如果 `docker rm opengauss-hrms`，数据大概率会丢

所以当前状态不是“镜像持久化”，而是“容器层暂存”。

## 6. 当前 baseline SQL 会不会覆盖现有数据

当前 `sql/10_hrms_schema.sql` 主要使用的是：

- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `INSERT ... WHERE NOT EXISTS`

所以它**不会像重建脚本一样直接清空现有数据**。

但它仍然不是长期正确方案，因为：

- 它不是版本化迁移
- 结构升级会越来越难维护
- 多人同时改表结构时容易失控

## 7. 真正的数据库工程化不只靠 git

多人协作时，必须区分 4 件事：

### 1. git 管代码

管理：

- 后端代码
- 前端代码
- 脚本
- 文档

### 2. migration 管数据库结构

管理：

- 表新增
- 字段变更
- 索引变更
- 约束变更

### 3. dump / backup 管数据库数据

管理：

- 演示数据
- 业务数据
- 迁移前备份
- 云端导入导出

### 4. 部署脚本管运行环境

管理：

- 应用启动
- 容器启动
- 配置注入
- 云端更新

## 8. 本地到云端正确迁移的思路

不是“把容器整个复制过去”，而是分层迁移：

### 应用层

- 后端代码
- 前端代码
- 启动脚本

### 数据库结构层

- schema
- migration scripts

### 数据层

- 业务数据
- 种子数据
- 演示数据

## 9. 数据迁移应该怎么做

正确流程应该是：

1. 本地导出数据库结构和数据
2. 云端创建 openGauss 实例
3. 先准备基线结构
4. 再导入 dump
5. 应用改连云端数据库
6. 验证接口与前端

## 10. openGauss 官方工具链

官方推荐的导入导出工具是：

- `gs_dump`
- `gs_restore`

用途：

- `gs_dump`：导出数据库
- `gs_restore`：恢复归档格式导出

参考：

- https://docs.opengauss.org/en/docs/latest/tool_and_commandreference/gs_dump.html
- https://docs.opengauss.org/en/docs/latest/tool_and_commandreference/gs_restore.html

## 11. 云端更新不能只靠 git pull

多人协作时，云端更新需要分成两类：

### 代码更新

- git pull
- 重启应用

### 数据库更新

- 先备份
- 执行 migration
- 验证
- 再发布对应应用版本

所以云端数据库更新的核心不是“同步 sql 文件”，而是：

- 版本化迁移
- 迁移前备份
- 迁移后验证

## 12. 当前最应该做的三件事

1. 给 openGauss 容器加持久化卷
2. 把当前单一 baseline SQL 升级成版本化迁移脚本
3. 先完成数据库模型升级，再设计云端迁移流程

## 13. 一句话结论

当前真正的“真相”是：

> 代码协作用 git，数据库结构演进用 migration，数据库数据迁移用 dump/restore，云端稳定更新靠部署脚本和版本化流程，而不是只靠本地容器和一个 schema 文件。
