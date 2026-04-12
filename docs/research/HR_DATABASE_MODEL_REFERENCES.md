# HR Database Model References

这份文档沉淀“企业人事数据库建模”最值得参考的正式资料和成熟系统线索。

目标不是照抄某一个产品，而是提炼：

- 正式 HR 系统常见有哪些主体
- 哪些字段和关系是高频出现的
- 我们下一轮 migration 最值得先补哪些结构

## 1. Oracle HR Sample Schema

Oracle 的 HR sample schema 很适合拿来当“关系建模最小正式样板”。

官方表说明里直接给出：

- `EMPLOYEES`
- `DEPARTMENTS`
- `JOBS`
- `JOB_HISTORY`
- `LOCATIONS`
- `COUNTRIES`
- `REGIONS`

来源：
- https://docs.oracle.com/en/database/oracle/oracle-database/19/comsc/HR-sample-schema-table-descriptions.html
- https://docs.oracle.com/en/database/oracle/oracle-database/19/comsc/introduction-to-sample-schemas.html

对我们的启发：

- `department` 不应只是一个名字，还应能关联 `location`
- `employee` 不应只挂 `department`，还应挂 `job`
- `job_history` 这类历史表非常重要，它让系统具备“任职变更”的正式感

## 2. Odoo Employees

Odoo 官方文档明确把 Employees 定义为一个集中化的人事主数据入口，涵盖：

- personnel files
- employment contracts
- departmental hierarchies
- attendance and work location
- certifications
- equipment
- offboarding

来源：
- https://www.odoo.com/documentation/19.0/applications/hr/employees.html

对我们的启发：

- 员工主数据不只是姓名和电话
- 组织结构、合同、地点、离职等都属于正式 HR 范畴
- `employee_profile` 和 `employee_contract` 这类扩展表很自然

## 3. Frappe HR Employee

Frappe HR 官方文档对 `Employee` 描述得更细，明确提到可管理：

- demographic details
- personal details
- professional details
- joining details
- leave details
- salary details
- contact details
- educational qualification
- previous work experience
- exit details
- emergency contact
- history in the company

来源：
- https://docs.frappe.io/hr/employee

对我们的启发：

- `employee` 主表不该无限塞字段
- 更合理的做法是：
  - 主表放身份主数据
  - `employee_profile` 放个人档案
  - `employee_job_history` 放任职历史
  - `education_record` / `work_experience` 后续再考虑

## 4. 对当前仓库最有价值的主体集合

结合上面几套参考和你们课程规模，当前最值得沉淀成下一轮 migration 的主体是：

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

### 权限与审计域

- `sys_user`
- `sys_role`
- `sys_permission`
- `audit_log`

## 5. 当前不建议立即重投入的主体

这些以后可以做，但不建议抢在当前前面：

- `salary_plan`
- `payroll_period`
- `attendance_record`
- `recruitment_candidate`
- `performance_review`
- `training_record`

原因不是它们不重要，而是：

- 评分核心并不强依赖
- 当前阶段更应该先把主数据模型和接口契约做稳

## 6. 对当前仓库的直接结论

我们下一轮 migration 最好不要继续围着当前 5 张业务表小修小补，而是直接补出：

1. `location`
2. `job`
3. `employee_profile`
4. `employee_job_history`
5. `leave_type`

这样数据库会立刻从“课设样例库”升级成“像正式 HR 系统的基线库”。
