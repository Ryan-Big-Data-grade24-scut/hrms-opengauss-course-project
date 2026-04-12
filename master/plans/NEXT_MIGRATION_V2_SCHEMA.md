# Next Migration V2 Schema

这份文档定义下一次 migration 的新数据结构。

目标不是一次做完所有企业 HR 能力，而是把数据库从“极简样例”升级成“正式 HR 基线”。

## 1. 下一次 migration 的范围

建议把下一次 migration 定义为：

> `V2 - HR core model upgrade`

包括 5 个重点：

1. 组织结构升级
2. 职位体系升级
3. 员工主数据升级
4. 任职历史建模
5. 请假模型升级

## 2. 结构升级总览

## 2.1 新增表

- `location`
- `job`
- `employee_profile`
- `employee_job_history`
- `leave_type`

## 2.2 升级表

- `department`
- `position`
- `employee`
- `leave_request`

## 3. 详细结构

## 3.1 `location`

用途：

- 存放办公地点/组织地点

建议字段：

- `location_id BIGSERIAL PRIMARY KEY`
- `location_code VARCHAR(30) NOT NULL UNIQUE`
- `location_name VARCHAR(100) NOT NULL`
- `country_code VARCHAR(10)`
- `city VARCHAR(50)`
- `address_line VARCHAR(255)`
- `status SMALLINT NOT NULL DEFAULT 1`
- `created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`

## 3.2 `department`

用途：

- 组织单元

新增字段建议：

- `department_code VARCHAR(30) UNIQUE`
- `location_id BIGINT REFERENCES location(location_id)`
- `manager_employee_id BIGINT`
- `description VARCHAR(255)`

保留：

- `department_name`
- `parent_department_id`
- `status`
- `created_at`

## 3.3 `job`

用途：

- 职位类别 / 职级族

建议字段：

- `job_id BIGSERIAL PRIMARY KEY`
- `job_code VARCHAR(30) NOT NULL UNIQUE`
- `job_title VARCHAR(100) NOT NULL`
- `job_grade VARCHAR(30)`
- `min_salary NUMERIC(12,2)`
- `max_salary NUMERIC(12,2)`
- `description VARCHAR(255)`

## 3.4 `position`

用途：

- 岗位实例 / 编制位

新增字段建议：

- `position_code VARCHAR(30) UNIQUE`
- `job_id BIGINT REFERENCES job(job_id)`
- `department_id BIGINT REFERENCES department(department_id)`
- `headcount INTEGER DEFAULT 1`
- `status SMALLINT NOT NULL DEFAULT 1`

保留：

- `position_name`
- `description`

说明：

- `job` 是职位类别
- `position` 是某部门下的具体岗位位点

## 3.5 `employee`

用途：

- 员工主身份

新增字段建议：

- `birth_date DATE`
- `id_card_no VARCHAR(30)`
- `employment_type VARCHAR(30)`
- `manager_employee_id BIGINT`

保留：

- `employee_no`
- `full_name`
- `gender`
- `phone`
- `email`
- `hire_date`
- `employment_status`

调整建议：

- `department_id` 和 `position_id` 暂时保留，便于兼容现有接口
- 长期可以通过 `employee_job_history` 承担更正式的任职关系

## 3.6 `employee_profile`

用途：

- 员工扩展档案

建议字段：

- `employee_id BIGINT PRIMARY KEY REFERENCES employee(employee_id) ON DELETE CASCADE`
- `address VARCHAR(255)`
- `emergency_contact_name VARCHAR(100)`
- `emergency_contact_phone VARCHAR(30)`
- `education_level VARCHAR(50)`
- `marital_status VARCHAR(30)`
- `personal_email VARCHAR(100)`
- `notes VARCHAR(255)`
- `updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`

## 3.7 `employee_job_history`

用途：

- 员工任职历史

建议字段：

- `history_id BIGSERIAL PRIMARY KEY`
- `employee_id BIGINT NOT NULL REFERENCES employee(employee_id) ON DELETE CASCADE`
- `department_id BIGINT REFERENCES department(department_id)`
- `position_id BIGINT REFERENCES position(position_id)`
- `job_id BIGINT REFERENCES job(job_id)`
- `manager_employee_id BIGINT`
- `start_date DATE NOT NULL`
- `end_date DATE`
- `change_reason VARCHAR(100)`
- `created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`

## 3.8 `leave_type`

用途：

- 假种定义

建议字段：

- `leave_type_id BIGSERIAL PRIMARY KEY`
- `leave_code VARCHAR(30) NOT NULL UNIQUE`
- `leave_name VARCHAR(50) NOT NULL`
- `requires_approval SMALLINT NOT NULL DEFAULT 1`
- `status SMALLINT NOT NULL DEFAULT 1`

## 3.9 `leave_request`

新增字段建议：

- `leave_type_id BIGINT REFERENCES leave_type(leave_type_id)`
- `approver_user_id BIGINT REFERENCES sys_user(user_id)`
- `approved_at TIMESTAMP`
- `approval_comment VARCHAR(255)`

保留兼容字段：

- `leave_type`

说明：

- `leave_type` 可以暂时保留一版，便于兼容现有接口
- 后续接口逐步切到 `leave_type_id`

## 4. 兼容性原则

这次 migration 不建议做“破坏式重写”，而应该做：

- 新增优先
- 保留兼容列
- 现有接口尽量还能跑

所以：

- 现有 `/api/employees` 不必立刻重写
- 现有 `/api/leaves` 也不必立刻重写
- 先让数据库变强，再逐步升级接口层

## 5. 对接口层的影响

### 现有接口基本可以保留

- `employees`
- `departments`
- `positions`
- `leaves`

### 下一步适合新增的接口

- `GET /api/jobs`
- `GET /api/locations`
- `GET /api/leave-types`
- `GET /api/employees/{id}/profile`
- `GET /api/employees/{id}/job-history`

## 6. 建议的 migration 拆分

不要把所有变化塞进一个超大 SQL，建议拆成：

- `V1__baseline.sql`
- `V2__org_and_job.sql`
- `V3__employee_profile_and_history.sql`
- `V4__leave_type_and_leave_upgrade.sql`

## 7. 当前结论

这次升级不是为了“看起来复杂”，而是为了做到：

- 数据结构像正式 HR 系统
- 现有接口还能过渡使用
- 后续前后端都能继续扩主体
