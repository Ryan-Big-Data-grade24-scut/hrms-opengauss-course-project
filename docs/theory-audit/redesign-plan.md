# HRMS Database Redesign Plan

> 生成日期：2026-06-06
> 数据源：schema-audit.md, permission-audit.md, closed-loop-audit.md + 4 篇理论研究报告 + 总需求清单
> 目标：从"应用层权限 + 无视图 + 无 RLS + 扁平角色"升级为"三级模式完整 + 数据库级 DAC + 行/列级安全 + 闭环流程"

---

## Part 1: Current Problems (DB Theory Perspective)

### 1.1 映射框架：每个缺口对应一个数据库理论概念

| # | 审计发现 | 违反的数据库理论概念 | 影响 |
|---|---------|-------------------|------|
| 1 | 无数据库视图（CREATE VIEW） | **三级模式结构 —— 外模式缺失** | 概念模式直接暴露给应用层，无逻辑独立性 |
| 2 | 无 GRANT/REVOKE | **DAC —— SQL 标准授权模型完全未使用** | 数据库自身无安全边界；直连 DB 即可绕过所有权限 |
| 3 | 角色无继承层次（扁平权限集） | **SQL:1999 角色层次结构 —— GRANT role TO role** | 权限管理手工程度极高；新增权限需同步 N 个角色 |
| 4 | 数据范围校验函数已实现但 0 次调用 | **行级安全（RLS）—— 未启用** | 无部门/组织层级数据隔离 |
| 5 | `employee.manager_employee_id` 等 3 处无 FK | **参照完整性 —— FOREIGN KEY 缺失** | 可引用不存在的员工或部门经理 |
| 6 | `leave_request.leave_type` 冗余列未删除 | **3NF 传递依赖 —— 冗余数据同步风险** | 两列可能不一致 |
| 7 | `approval_request.status` 等 6 处无 CHECK | **用户定义完整性 —— CHECK 缺失** | 数据库不校验状态值合法性 |
| 8 | `id_card_no` 明文存储 | **MAC/加密 —— 无列级保护** | PII 泄露风险；违反 GDPR/PIPL |
| 9 | `audit_log.target_id` 为 VARCHAR(50) | **参照完整性 —— 多态外键不可追踪** | 无法建立 FK；数据质量不可保证 |
| 10 | `_execute_payload` 在状态更新后执行 | **事务 ACID —— 原子性违反** | 状态已 approved 但业务数据未变更 |
| 11 | `attrition_history` 表 DDL 不存在 | **概念模式 —— 缺失实体定义** | 快照功能运行即崩溃 |
| 12 | ML 特征列在 employee 表上不存在 | **内模式/物化列 —— 特征无存储** | 模型预测 SQL 运行时错误 |
| 13 | 风险评分公式 3 处代码重复 | **DRY 原则 + 存储过程缺失** | 公式修改需同步 N 个文件 |
| 14 | 无表分区策略 | **内模式 —— 物理存储优化缺失** | 时间序列表膨胀后查询性能下降 |
| 15 | CEO 角色与 ADMIN 完全相同 | **概念模式 —— 语义重复** | 违反唯一语义；维护混乱 |

### 1.2 核心矛盾总结

```
理论要求的完整架构：
  ┌─────────────────────────────┐
  │  外模式 (Views)             │  ← 每个角色一组视图
  ├─────────────────────────────┤
  │  概念模式 (Tables + FDs)    │  ← 3NF + BCNF
  ├─────────────────────────────┤
  │  内模式 (Indexes + Partitions) │  ← 物理优化
  └─────────────────────────────┘
  DAC (GRANT/REVOKE) + RLS (Row-Level Security)

实际实现：
  ┌─────────────────────────────┐
  │  应用层 JWT permission 数组  │  ← 字符串集合成员检查
  ├─────────────────────────────┤
  │  概念模式 (Tables)          │  ← 较完整，但有 3 个 FK 缺失
  ├─────────────────────────────┤
  │  (无内模式优化)              │
  └─────────────────────────────┘
  数据库的 DAC 和 RLS 能力完全未启用
```

### 1.3 审计评分回顾

| 维度 | schema-audit | permission-audit | 综合 |
|------|-------------|-----------------|------|
| 概念模式 | B+ (8/10) | 8/10 | 8/10 |
| 外模式 | 缺失 | **0/10** | **0/10** |
| 内模式 | 5/10 | 5/10 | 5/10 |
| DAC (GRANT/REVOKE) | 未审计 | **1/10** | **1/10** |
| 角色层次 | 未审计 | **2/10** | **2/10** |
| RLS | 未审计 | **0/10** | **0/10** |
| **综合** | **~6/10** | **~1.15/10** | **严重不足** |

---

## Part 2: Redesigned Database Schema

### 2.1 三级模式架构总图

```
                        ┌──────────────────────────────────────────────┐
                        │  外模式（External Schema）= 数据库视图层       │
                        │                                              │
                        │  emp_self_view          (EMPLOYEE 角色)      │
                        │  emp_dept_view          (MANAGER 角色)       │
                        │  emp_hr_view            (HR 角色)            │
                        │  emp_admin_view         (ADMIN/CEO 角色)     │
                        │                                              │
                        │  leave_self_view        (EMPLOYEE)           │
                        │  leave_dept_view        (MANAGER)            │
                        │  leave_hr_view          (HR)                 │
                        │                                              │
                        │  attendance_self_view   (EMPLOYEE)           │
                        │  attendance_dept_view   (MANAGER)            │
                        │  attendance_hr_view     (HR)                 │
                        │                                              │
                        │  skill_self_view        (EMPLOYEE)           │
                        │  skill_dept_view        (MANAGER)            │
                        │  skill_hr_view          (HR)                 │
                        │                                              │
                        │  analytics_mv           (物化视图, 所有角色) │
                        │  attrition_history_mv   (物化视图, 快照)     │
                        └──────────┬───────────────────────────────────┘
                                   │ 外模式/概念模式映像（视图定义）
                                   ▼
                        ┌──────────────────────────────────────────────┐
                        │  概念模式（Conceptual Schema）                │
                        │                                              │
                        │  组织实体：department, position, job, location│
                        │  人员实体：employee, employee_profile,        │
                        │            employee_skill, employee_project, │
                        │            employee_job_history              │
                        │  业务实体：attendance_record,                │
                        │            performance_review, leave_request │
                        │  审批实体：approval_request, approval_step,  │
                        │            approval_config,                  │
                        │            approval_action_type              │
                        │  分析实体：attrition_history                 │
                        │  权限实体：sys_user, sys_role, sys_permission│
                        │            sys_user_role, sys_role_permission│
                        │            sys_role_hierarchy (新增)         │
                        │  审计实体：audit_log                         │
                        └──────────┬───────────────────────────────────┘
                                   │ 概念模式/内模式映像
                                   ▼
                        ┌──────────────────────────────────────────────┐
                        │  内模式（Internal Schema）                    │
                        │                                              │
                        │  索引：现有 30+ 索引 + 补充 action_code 索引  │
                        │  分区：attendance_record 按 work_date 范围分区│
                        │       attrition_history 按 snapshot_date 分区│
                        │       audit_log 按 created_at 分区           │
                        │  RLS：employee 表启用行级安全策略             │
                        └──────────────────────────────────────────────┘
```

### 2.2 概念模式修正（基于审计发现）

#### 2.2.1 添加缺失的外键约束

```sql
-- 缺失 FK #1: employee.manager_employee_id
ALTER TABLE employee ADD CONSTRAINT fk_employee_manager
    FOREIGN KEY (manager_employee_id) REFERENCES employee(employee_id)
    ON DELETE SET NULL;

-- 缺失 FK #2: department.manager_employee_id
ALTER TABLE department ADD CONSTRAINT fk_department_manager
    FOREIGN KEY (manager_employee_id) REFERENCES employee(employee_id)
    ON DELETE SET NULL;

-- 缺失 FK #3: employee_job_history.manager_employee_id
ALTER TABLE employee_job_history ADD CONSTRAINT fk_job_history_manager
    FOREIGN KEY (manager_employee_id) REFERENCES employee(employee_id)
    ON DELETE SET NULL;
```

#### 2.2.2 添加缺失的 CHECK 约束

```sql
-- CHK #1: leave_request.approval_status
ALTER TABLE leave_request ADD CONSTRAINT chk_leave_approval_status
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'cancelled'));

-- CHK #2: attrition_history.risk_level
ALTER TABLE attrition_history ADD CONSTRAINT chk_risk_level
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical'));

-- CHK #3: employee.employment_status
ALTER TABLE employee ADD CONSTRAINT chk_employment_status
    CHECK (employment_status IN ('active', 'resigned', 'terminated', 'on_leave'));

-- CHK #4: employee.gender
ALTER TABLE employee ADD CONSTRAINT chk_gender
    CHECK (gender IN ('M', 'F'));

-- CHK #5: leave_type.requires_approval / leave_type.status
ALTER TABLE leave_type ADD CONSTRAINT chk_requires_approval
    CHECK (requires_approval IN (0, 1));
ALTER TABLE leave_type ADD CONSTRAINT chk_leave_type_status
    CHECK (status IN (0, 1));

-- CHK #6: attendance_record.clock_type / source
ALTER TABLE attendance_record ADD CONSTRAINT chk_clock_type
    CHECK (clock_type IN ('clock_in', 'clock_out'));
ALTER TABLE attendance_record ADD CONSTRAINT chk_attendance_source
    CHECK (source IN ('device', 'manual', 'correction'));
```

#### 2.2.3 删除冗余列

```sql
-- 移除 leave_request.leave_type (冗余于 leave_type_id)
ALTER TABLE leave_request DROP COLUMN leave_type;
```

#### 2.2.4 新增角色层次表

```sql
-- 角色层次继承表
CREATE TABLE sys_role_hierarchy (
    parent_role_id BIGINT NOT NULL REFERENCES sys_role(role_id),
    child_role_id  BIGINT NOT NULL REFERENCES sys_role(role_id),
    PRIMARY KEY (parent_role_id, child_role_id),
    CHECK (parent_role_id != child_role_id)
);

-- 角色层次数据（EMPLOYEE < MANAGER < HR < ADMIN < CEO）
INSERT INTO sys_role_hierarchy (parent_role_id, child_role_id) VALUES
    (3, 4),  -- EMPLOYEE ⊂ MANAGER
    (4, 2),  -- MANAGER  ⊂ HR
    (2, 1),  -- HR       ⊂ ADMIN
    (1, 5);  -- ADMIN    ⊂ CEO
```

#### 2.2.5 加密敏感列

```sql
-- 方式1: 使用数据库加密函数（pgcrypto 扩展）
-- id_card_no 加密存储
-- 注意: 实际部署时需要配置密钥管理
-- ALTER TABLE employee ALTER COLUMN id_card_no TYPE byte4a USING pgp_sym_encrypt(id_card_no, current_setting('app.encrypt_key'));
```

### 2.3 外模式（视图定义）

#### 2.3.1 员工相关视图

```sql
-- ============================================
-- 外模式 V1: emp_self_view (EMPLOYEE 角色)
-- 仅暴露当前登录员工的基本信息
-- 隐藏: salary, id_card_no, manager_employee_id
-- ============================================
CREATE VIEW emp_self_view AS
SELECT
    employee_id,
    employee_no,
    full_name,
    gender,
    hire_date,
    employment_status,
    department_id,
    position_id,
    email,
    phone
FROM employee
WHERE employee_id = current_setting('app.emp_id')::BIGINT;

-- ============================================
-- 外模式 V2: emp_dept_view (MANAGER 角色)
-- 暴露本部门员工的基本信息 + 所属部门
-- 隐藏: salary, id_card_no, phone (除非需要)
-- ============================================
CREATE VIEW emp_dept_view AS
SELECT
    e.employee_id,
    e.employee_no,
    e.full_name,
    e.gender,
    e.hire_date,
    e.employment_status,
    e.department_id,
    d.department_name,
    e.position_id,
    e.email,
    e.phone
FROM employee e
JOIN department d ON e.department_id = d.department_id
WHERE e.department_id = (
    SELECT department_id FROM employee
    WHERE employee_id = current_setting('app.emp_id')::BIGINT
);

-- ============================================
-- 外模式 V3: emp_hr_view (HR 角色)
-- 暴露所有员工信息，但 id_card_no 脱敏
-- ============================================
CREATE VIEW emp_hr_view AS
SELECT
    e.employee_id,
    e.employee_no,
    e.full_name,
    e.gender,
    e.hire_date,
    e.employment_status,
    e.department_id,
    d.department_name,
    e.position_id,
    p.position_name,
    e.email,
    e.phone,
    e.salary,
    CASE
        WHEN e.id_card_no IS NOT NULL
        THEN CONCAT(LEFT(e.id_card_no, 3), '**********', RIGHT(e.id_card_no, 4))
        ELSE NULL
    END AS id_card_no_masked,
    e.manager_employee_id,
    m.full_name AS manager_name
FROM employee e
LEFT JOIN department d ON e.department_id = d.department_id
LEFT JOIN position p ON e.position_id = p.position_id
LEFT JOIN employee m ON e.manager_employee_id = m.employee_id;

-- ============================================
-- 外模式 V4: emp_admin_view (ADMIN/CEO 角色)
-- 暴露全部列（含原始 id_card_no）
-- 此视图仅授权给 admin 和 ceo 角色
-- ============================================
CREATE VIEW emp_admin_view AS
SELECT
    e.*,
    d.department_name,
    p.position_name,
    m.full_name AS manager_name
FROM employee e
LEFT JOIN department d ON e.department_id = d.department_id
LEFT JOIN position p ON e.position_id = p.position_id
LEFT JOIN employee m ON e.manager_employee_id = m.employee_id;
```

#### 2.3.2 请假相关视图

```sql
-- ============================================
-- 外模式 V5: leave_self_view (EMPLOYEE 角色)
-- ============================================
CREATE VIEW leave_self_view AS
SELECT
    leave_id,
    employee_id,
    leave_type_id,
    lt.leave_code,
    lt.leave_name,
    start_date,
    end_date,
    total_days,
    reason,
    approval_status,
    created_at
FROM leave_request lr
JOIN leave_type lt ON lr.leave_type_id = lt.leave_type_id
WHERE lr.employee_id = current_setting('app.emp_id')::BIGINT;

-- ============================================
-- 外模式 V6: leave_dept_view (MANAGER 角色)
-- ============================================
CREATE VIEW leave_dept_view AS
SELECT
    lr.leave_id,
    lr.employee_id,
    e.full_name AS employee_name,
    lr.leave_type_id,
    lt.leave_name,
    lr.start_date,
    lr.end_date,
    lr.total_days,
    lr.reason,
    lr.approval_status,
    lr.created_at
FROM leave_request lr
JOIN leave_type lt ON lr.leave_type_id = lt.leave_type_id
JOIN employee e ON lr.employee_id = e.employee_id
WHERE e.department_id = (
    SELECT department_id FROM employee
    WHERE employee_id = current_setting('app.emp_id')::BIGINT
);

-- ============================================
-- 外模式 V7: leave_hr_view (HR 角色)
-- ============================================
CREATE VIEW leave_hr_view AS
SELECT
    lr.*,
    e.full_name AS employee_name,
    e.department_id,
    d.department_name,
    lt.leave_name
FROM leave_request lr
JOIN employee e ON lr.employee_id = e.employee_id
JOIN department d ON e.department_id = d.department_id
JOIN leave_type lt ON lr.leave_type_id = lt.leave_type_id;
```

#### 2.3.3 考勤相关视图

```sql
-- ============================================
-- 外模式 V8: attendance_self_view (EMPLOYEE 角色)
-- ============================================
CREATE VIEW attendance_self_view AS
SELECT
    record_id,
    employee_id,
    work_date,
    clock_in,
    clock_out,
    status,
    late_minutes,
    early_leave_minutes,
    clock_type,
    source
FROM attendance_record
WHERE employee_id = current_setting('app.emp_id')::BIGINT;

-- ============================================
-- 外模式 V9: attendance_dept_view (MANAGER 角色)
-- ============================================
CREATE VIEW attendance_dept_view AS
SELECT
    ar.record_id,
    ar.employee_id,
    e.full_name AS employee_name,
    ar.work_date,
    ar.clock_in,
    ar.clock_out,
    ar.status,
    ar.late_minutes,
    ar.early_leave_minutes
FROM attendance_record ar
JOIN employee e ON ar.employee_id = e.employee_id
WHERE e.department_id = (
    SELECT department_id FROM employee
    WHERE employee_id = current_setting('app.emp_id')::BIGINT
);

-- ============================================
-- 外模式 V10: attendance_hr_view (HR 角色)
-- ============================================
CREATE VIEW attendance_hr_view AS
SELECT
    ar.*,
    e.full_name AS employee_name,
    e.department_id,
    d.department_name
FROM attendance_record ar
JOIN employee e ON ar.employee_id = e.employee_id
JOIN department d ON e.department_id = d.department_id;
```

#### 2.3.4 技能相关视图

```sql
-- ============================================
-- 外模式 V11: skill_self_view (EMPLOYEE 角色)
-- ============================================
CREATE VIEW skill_self_view AS
SELECT
    es.employee_skill_id,
    es.employee_id,
    es.skill_id,
    s.skill_name,
    sc.category_name,
    es.proficiency_level,
    es.is_core,
    es.acquired_date,
    es.acquired_from
FROM employee_skill es
JOIN skill s ON es.skill_id = s.skill_id
JOIN skill_category sc ON s.category_id = sc.category_id
WHERE es.employee_id = current_setting('app.emp_id')::BIGINT;

-- ============================================
-- 外模式 V12: skill_dept_view (MANAGER 角色)
-- ============================================
CREATE VIEW skill_dept_view AS
SELECT
    es.employee_skill_id,
    es.employee_id,
    e.full_name AS employee_name,
    es.skill_id,
    s.skill_name,
    sc.category_name,
    es.proficiency_level,
    es.is_core,
    es.acquired_date
FROM employee_skill es
JOIN employee e ON es.employee_id = e.employee_id
JOIN skill s ON es.skill_id = s.skill_id
JOIN skill_category sc ON s.category_id = sc.category_id
WHERE e.department_id = (
    SELECT department_id FROM employee
    WHERE employee_id = current_setting('app.emp_id')::BIGINT
);

-- ============================================
-- 外模式 V13: skill_hr_view (HR 角色)
-- ============================================
CREATE VIEW skill_hr_view AS
SELECT
    es.*,
    e.full_name AS employee_name,
    e.department_id,
    d.department_name,
    s.skill_name,
    sc.category_name
FROM employee_skill es
JOIN employee e ON es.employee_id = e.employee_id
JOIN department d ON e.department_id = d.department_id
JOIN skill s ON es.skill_id = s.skill_id
JOIN skill_category sc ON s.category_id = sc.category_id;
```

#### 2.3.5 分析相关物化视图

```sql
-- ============================================
-- 物化视图 MV1: mv_attrition_risk
-- 将离职风险评分公式抽取为公共物化视图
-- 消除跨文件公式重复
-- ============================================
CREATE MATERIALIZED VIEW mv_attrition_risk AS
SELECT
    e.employee_id,
    e.full_name,
    e.department_id,
    d.department_name,
    e.position_id,
    -- 8 因子复合评分（标准化公式）
    ROUND((
        COALESCE(att.tenure, 5) * 0.15 +
        COALESCE(att.engagement_score, 70) * (-0.01) +
        COALESCE(att.last_promotion_months, 12) * 0.10 +
        COALESCE(att.manager_changes, 0) * 0.10 +
        COALESCE(att.overtime_count, 0) * 0.15 +
        COALESCE(ABSENT.count, 0) * 0.15 +
        COALESCE(LATE.count, 0) * 0.10 +
        COALESCE(PERF.avg_score, 75) * (-0.10)
    )::DECIMAL, 2) AS composite_risk_score,
    CASE
        WHEN (COALESCE(att.tenure, 5) * 0.15 +
              COALESCE(att.engagement_score, 70) * (-0.01) +
              COALESCE(att.last_promotion_months, 12) * 0.10 +
              COALESCE(att.manager_changes, 0) * 0.10 +
              COALESCE(att.overtime_count, 0) * 0.15 +
              COALESCE(ABSENT.count, 0) * 0.15 +
              COALESCE(LATE.count, 0) * 0.10 +
              COALESCE(PERF.avg_score, 75) * (-0.10)) >= 80 THEN 'critical'
        WHEN ... >= 60 THEN 'high'
        WHEN ... >= 40 THEN 'medium'
        ELSE 'low'
    END AS risk_level,
    CURRENT_TIMESTAMP AS computed_at
FROM employee e
LEFT JOIN department d ON e.department_id = d.department_id
LEFT JOIN attrition_history att ON e.employee_id = att.employee_id
    AND att.snapshot_date = (SELECT MAX(snapshot_date) FROM attrition_history ah WHERE ah.employee_id = e.employee_id)
LEFT JOIN (
    SELECT employee_id, COUNT(*) AS count
    FROM attendance_record
    WHERE status = 'absent' AND work_date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY employee_id
) ABSENT ON e.employee_id = ABSENT.employee_id
LEFT JOIN (
    SELECT employee_id, COUNT(*) AS count
    FROM attendance_record
    WHERE status IN ('late', 'half-day') AND work_date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY employee_id
) LATE ON e.employee_id = LATE.employee_id
LEFT JOIN (
    SELECT employee_id, AVG(score) AS avg_score
    FROM performance_review
    WHERE status = 'acknowledged'
    GROUP BY employee_id
) PERF ON e.employee_id = PERF.employee_id;

-- 唯一索引以支持 CONCURRENTLY 刷新
CREATE UNIQUE INDEX idx_mv_attrition_risk ON mv_attrition_risk(employee_id);
```

### 2.4 内模式优化

#### 2.4.1 时间序列表分区

```sql
-- attendance_record 按 work_date 范围分区
CREATE TABLE attendance_record (
    record_id BIGSERIAL,
    employee_id BIGINT NOT NULL,
    work_date DATE NOT NULL,
    clock_in TIMESTAMP,
    clock_out TIMESTAMP,
    status VARCHAR(30) NOT NULL,
    late_minutes INT DEFAULT 0,
    early_leave_minutes INT DEFAULT 0,
    clock_type VARCHAR(20),
    source VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (record_id, work_date)
) PARTITION BY RANGE (work_date);

CREATE TABLE attendance_2024 PARTITION OF attendance_record
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE attendance_2025 PARTITION OF attendance_record
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE attendance_2026 PARTITION OF attendance_record
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE attendance_future PARTITION OF attendance_record
    FOR VALUES FROM ('2027-01-01') TO ('2030-01-01');

-- attrition_history 按 snapshot_date 范围分区
-- audit_log 按 created_at 范围分区（同理）
```

#### 2.4.2 补充索引

```sql
-- approval_request 补充 action_code 索引
CREATE INDEX idx_approval_action_code ON approval_request(action_code);
```

### 2.5 完整 ER 图（文本表示）

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────────┐
│    location     │────<│     department        │────<│        position          │
│                 │     │                      │     │                          │
│ location_id(PK) │     │ department_id(PK)    │     │ position_id(PK)         │
│ location_name   │     │ department_name      │     │ position_name           │
│ location_code   │     │ parent_department_id─│──┐  │ department_id(FK)──>──┐ │
└─────────────────┘     │ manager_employee_id─│─│─│─│ job_id(FK)──>──┐      │ │
                        │ location_id(FK)──>──┘ │ │ │              │      │ │
                        └───────────────────────┘ │ │ └────────────┘──────│───┘
                                                  │ │      │              │
                        ┌──────────────────┐      │ │   ┌──┘              │
                        │      job         │      │ │   │                 │
                        │  job_id(PK)      │<─────┘─┘───│───FK───────────┘
                        │  job_name        │          │
                        └──────────────────┘          │
                                                       │
                        ┌──────────────────────────────────────────┐
                        │              employee                    │
                        │  employee_id(PK)                         │
                        │  employee_no(UNIQUE)                     │
                        │  full_name, gender, hire_date            │
                        │  employment_status (CHK: active/resigned)│
                        │  department_id(FK)──>── department       │
                        │  position_id(FK)──>─── position          │
                        │  manager_employee_id(FK)──>── employee   │
                        │  salary                                  │
                        │  phone, email                            │
                        │  id_card_no (加密存储)                     │
                        └────┬──────┬──────┬──────┬──────┬─────────┘
                             │      │      │      │      │
              ┌──────────────┤      │      │      │      ├──────────────┐
              ▼              ▼      ▼      ▼      ▼      ▼              ▼
    ┌──────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────┐
    │employee_skill│  │attendance  │  │performance │  │leave_request │  │employee_job  │
    │              │  │_record    │  │_review     │  │              │  │_history     │
    │PK:emp_skill  │  │            │  │            │  │              │  │              │
    │FK:employee_id│  │PK:record_id│  │PK:review_id│  │PK:leave_id   │  │PK:history_id │
    │FK:skill_id   │  │FK:emp_id   │  │FK:emp_id   │  │FK:emp_id     │  │FK:emp_id     │
    │FK:confirmed_ │  │CHK:status  │  │CHK:rating  │  │FK:leave_type │  │FK:dept/pos   │
    │   by         │  │CHK:time    │  │CHK:score   │  │CHK:status    │  │              │
    │CHK:proficienc│  │UNIQUE:date │  │CHK:no_self │  │              │  │              │
    └──────────────┘  └────────────┘  └────────────┘  └──────────────┘  └──────────────┘

    ┌──────────────────────┐      ┌───────────────────────┐
    │  approval_request    │      │    attrition_history   │
    │  request_id(PK)      │      │  history_id(PK)        │
    │  applicant_id(FK)    │      │  employee_id(FK)──>──┐ │
    │  action_code(FK)     │      │  snapshot_date       │ │
    │  target_type         │      │  risk_score          │ │
    │  target_id           │      │  risk_level(CHK)     │ │
    │  status(CHK)         │      │  tenure, engagement  │ │
    │                      │      │  ...(input snapshot) │ │
    │  ──< approval_step   │      └──────────────────────┘ │
    │      step_id(PK)     │                               │
    │      request_id(FK)  │                               │
    └──────────────────────┘                               │
                                                           │
    ┌──────────────────────┐      ┌────────────────────────┘
    │  权限相关表           │      │
    │  sys_user            │      │
    │  sys_role            │      │
    │  sys_permission      │      │
    │  sys_user_role       │      │
    │  sys_role_permission │      │
    │  sys_role_hierarchy  │      │  ← 新增
    └──────────────────────┘      │
                                  │
    ┌──────────────────────┐      │
    │  audit_log           │      │
    │  log_id(PK)          │      │
    │  username            │      │
    │  action_type         │      │
    │  target_type/target  │      │
    │  created_at          │      │
    └──────────────────────┘      │
```

---

## Part 3: Redesigned Permission System

### 3.1 总架构：三层叠加安全模型

```
Layer 1: 认证 + 会话上下文
  ├── JWT token 验证 (现有, 保留)
  └── SET app.emp_id / app.role / app.dept_id (新增)
      在每个连接建立时从 token 注入会话变量

Layer 2: 数据库级 DAC (GRANT/REVOKE)
  ├── 对角色 GRANT SELECT ON 外模式视图
  ├── 对角色 GRANT INSERT/UPDATE/DELETE (受限)
  └── 角色继承: GRANT lower_role TO higher_role

Layer 3: RLS (行级安全)
  ├── employee 表: 部门隔离策略
  └── leave_request 等: 自有数据 vs 部门数据
```

### 3.2 数据库级角色定义（基于 SQL GRANT 标准）

```sql
-- ============================================
-- 创建数据库角色（SQL:1999 标准）
-- ============================================
CREATE ROLE hrms_employee;
CREATE ROLE hrms_manager;
CREATE ROLE hrms_hr;
CREATE ROLE hrms_admin;

-- ============================================
-- 角色继承层次
-- EMPLOYEE ⊂ MANAGER ⊂ HR ⊂ ADMIN
-- ============================================
GRANT hrms_employee TO hrms_manager;
GRANT hrms_manager  TO hrms_hr;
GRANT hrms_hr       TO hrms_admin;

-- ============================================
-- EMPLOYEE 层权限（最小权限原则）
-- ============================================
GRANT SELECT ON emp_self_view          TO hrms_employee;
GRANT SELECT ON leave_self_view        TO hrms_employee;
GRANT SELECT ON attendance_self_view   TO hrms_employee;
GRANT SELECT ON skill_self_view        TO hrms_employee;

-- 写入权限（仅限于自己的数据）
GRANT INSERT ON leave_request          TO hrms_employee;
GRANT INSERT ON approval_request       TO hrms_employee;

-- ============================================
-- MANAGER 层权限（继承 EMPLOYEE + 部门级数据）
-- ============================================
GRANT SELECT ON emp_dept_view          TO hrms_manager;
GRANT SELECT ON leave_dept_view        TO hrms_manager;
GRANT SELECT ON attendance_dept_view   TO hrms_manager;
GRANT SELECT ON skill_dept_view        TO hrms_manager;

-- 审批权限
GRANT UPDATE (status) ON approval_step TO hrms_manager;

-- ============================================
-- HR 层权限（继承 MANAGER + 全量数据）
-- ============================================
GRANT SELECT ON emp_hr_view            TO hrms_hr;
GRANT SELECT ON leave_hr_view          TO hrms_hr;
GRANT SELECT ON attendance_hr_view     TO hrms_hr;
GRANT SELECT ON skill_hr_view          TO hrms_hr;
GRANT SELECT ON mv_attrition_risk      TO hrms_hr;

-- 写入权限（管理所有数据）
GRANT INSERT, UPDATE, DELETE ON employee         TO hrms_hr;
GRANT INSERT, UPDATE, DELETE ON leave_request    TO hrms_hr;
GRANT INSERT, UPDATE, DELETE ON attendance_record TO hrms_hr;
GRANT INSERT, UPDATE, DELETE ON employee_skill   TO hrms_hr;

-- ============================================
-- ADMIN 层权限（继承 HR + 全部权限）
-- ============================================
GRANT SELECT ON emp_admin_view          TO hrms_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO hrms_admin;
```

### 3.3 列级权限（GRANT SELECT (col1, col2)）

```sql
-- ADMIN 可以直接查询 id_card_no 原始列（通过 emp_admin_view）
-- HR 只能看到脱敏版本（通过 emp_hr_view 中的 CASE 表达式）
-- MANAGER 和 EMPLOYEE 完全看不到 id_card_no

-- 示例: 如果某些场景需要基表列级 GRANT（不经过视图）
GRANT SELECT (employee_id, employee_no, full_name, email, phone)
    ON employee TO hrms_employee;
```

### 3.4 RLS 行级安全策略

```sql
-- ============================================
-- RLS 策略 1: employee 表部门隔离
-- ============================================
ALTER TABLE employee ENABLE ROW LEVEL SECURITY;

-- 策略 A: HR 和管理员不受 RLS 限制（通过角色豁免）
-- （PostgreSQL 不支持 BYPASSRLS 通过 policy 控制，superuser BYPASSRLS 默认）

-- 策略 B: 普通员工只能看到自己
CREATE POLICY employee_self_policy ON employee
    FOR SELECT
    USING (employee_id = current_setting('app.emp_id')::BIGINT);

-- 策略 C: 经理可以看到本部门员工
-- 注意: 这通过外模式视图实现，不是 RLS
-- emp_dept_view 已经做了部门过滤

-- ============================================
-- RLS 策略 2: leave_request 部门隔离
-- ============================================
ALTER TABLE leave_request ENABLE ROW LEVEL SECURITY;

CREATE POLICY leave_self_policy ON leave_request
    FOR ALL
    USING (employee_id = current_setting('app.emp_id')::BIGINT)
    WITH CHECK (employee_id = current_setting('app.emp_id')::BIGINT);

-- ============================================
-- RLS 策略 3: 使用 app.current_role 动态控制
-- 结合视图和 RLS 提供双重保护
-- ============================================
-- 设置会话变量的方式（在应用层连接池初始化时注入）:
-- SELECT set_config('app.emp_id', '123', false);
-- SELECT set_config('app.role', 'hrms_manager', false);
-- SELECT set_config('app.dept_id', '5', false);
```

### 3.5 应用层 RBAC + 数据库层 DAC 的双轨制

```
最终权限检查链路:

用户请求 → JWT 验证（应用层）→ 外模式视图（数据库层）→ RLS 策略（数据库层）→ 基表

Layer 1 (应用层): JWT 中的 permissions 数组做"粗粒度"路由级检查
  - 用途: 控制用户可以访问哪些 API 路由
  - 示例: _require_permission('analytics.view')

Layer 2 (数据库层): GRANT SELECT ON 外模式视图
  - 用途: 控制用户可以看哪些列、哪些表
  - 示例: hrms_employee 只能查 emp_self_view, 不能查 employee 基表

Layer 3 (数据库层): RLS 策略
  - 用途: 控制用户可以看到哪些行
  - 示例: leave_request 上 RLS 策略确保员工只看到自己的记录

三层叠加效果:
  - 即使应用层 JWT 被伪造（直连 DB）, GRANT + RLS 仍然保护数据
  - 即使数据库的 GRANT 配置出错（SELECT 授权过多）, RLS 仍然限制行级可见性
  - 即使 RLS 策略遗漏（未定义 policy）, 外模式视图仍然限制列级可见性
```

### 3.6 会话变量注入机制

```python
# 在应用层数据库连接池初始化时（连接创建后、查询执行前）
# 伪代码:
def on_connection_create(conn, user_context):
    with conn.cursor() as cur:
        cur.execute("SELECT set_config('app.emp_id', %s, false)", [user_context['emp_id']])
        cur.execute("SELECT set_config('app.role', %s, false)", [user_context['role']])
        cur.execute("SELECT set_config('app.dept_id', %s, false)", [user_context['dept_id']])
```

---

## Part 4: Closed-Loop Process Design

### 4.1 审批流闭环（完整生命周期）

#### 4.1.1 数据流图

```
                        ┌──────────────┐
                        │  员工提交审批   │
                        │  (B1-B8 入口) │
                        └──────┬───────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  approval_request    │← 外模式: leave_self_view
                    │  status = pending    │         skill_self_view
                    │  target_type/payload │         attendance_self_view
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  approval_step (N个) │← 审批节点链
                    │  step_order 1..N    │
                    │  reviewer_id, status │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
      ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
      │ 批准 (ALL)   │  │ 驳回 (ANY)   │  │ 撤回         │
      │ status→      │  │ status→     │  │ status→      │
      │ approved    │  │ rejected    │  │ recalled     │
      └──────┬──────┘  └─────────────┘  └─────────────┘
             │
             ▼
    ┌──────────────────────┐
    │ _execute_payload()    │  ★ 关键改进: 在 status 更新前执行
    │ 同一事务 (原子操作)    │
    │ 执行成功 → status =   │
    │   'approved'          │
    │ 执行失败 → status =   │
    │   'execution_failed'  │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Verify (验证节点, 新增)│
    │ verifier 确认执行结果  │
    │ status → 'verified'  │  ← 终态
    └──────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ 审计日志写入          │
    │ audit_log:            │
    │ action_type=APPROVE   │
    │ + EXECUTE + VERIFY    │
    └──────────────────────┘
```

#### 4.1.2 改进后的状态机

```
现状:
  submit → pending → approved (终态, 可能未执行)
                   → rejected (终态)
                   → recalled (终态)

修复后:
  submit → pending → executing → approved → verified (终态)
                   |           |           ↑
                   |           └→ execution_failed → pending (重试)
                   → rejected (终态)
                   → recalled (终态)

新增状态:
  - 'executing':      正在执行业务操作（中间态）
  - 'execution_failed': 执行业务数据失败（可重试）
  - 'verified':       验证人确认执行结果正确（终态）

相关 CHECK 约束更新:
  ALTER TABLE approval_request DROP CONSTRAINT IF EXISTS chk_approval_status;
  ALTER TABLE approval_request ADD CONSTRAINT chk_approval_status
    CHECK (status IN ('pending','approved','rejected','cancelled','recalled',
                      'executing','execution_failed','verified'));
```

#### 4.1.3 事务性修复（`_execute_payload` 原子性）

```python
# 修复后的执行逻辑（伪代码）:
def approve(request_id, reviewer_id):
    # 1. 乐观锁校验
    # 2. 将状态设为 'executing'（提前通知数据库即将变更）
    # 3. BEGIN TRANSACTION
    # 4. 如果是末节点: 调用 _execute_payload()
    #     成功 → UPDATE status = 'approved'
    #     失败 → UPDATE status = 'execution_failed', ROLLBACK
    # 5. RIGHT AFTER transaction: 写入执行审计日志
    # 6. 可选: 自动通知 verifier
```

#### 4.1.4 每个业务类型的输入/处理/输出/反馈

| 业务类型 | 输入 (payload) | 执行操作 | 输出 | 反馈/审计 |
|---------|---------------|---------|------|---------|
| SKILL_ADD | 部门, 岗位, 技能名称, 等级 | INSERT INTO employee_skill | 新技能记录 | audit_log: SKILL_ADD_EXECUTED |
| SKILL_UPDATE | 技能ID, 新等级 | UPDATE employee_skill SET proficiency_level | 更新后记录 | audit_log: SKILL_UPDATE_EXECUTED |
| SKILL_REMOVE | 技能ID | DELETE FROM employee_skill | 删除确认 | audit_log: SKILL_REMOVE_EXECUTED |
| LEAVE_APPLY | 请假类型, 日期范围, 原因 | INSERT INTO leave_request | 请假记录 | 自动通知 manager 审批 |
| ATTENDANCE_CORRECT | 日期, 时段, 原因 | INSERT INTO attendance_record | 补卡记录 | audit_log: CORRECT_EXECUTED |
| PROFILE_UPDATE | phone, email | UPDATE employee SET phone, email | 更新后个人信息 | audit_log: PROFILE_UPDATED |

### 4.2 离职风险分析管线闭环

#### 4.2.1 数据流图

```
原始数据层 (Raw Data):
  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐
  │ attendance│  │  performance  │  │  employee        │
  │ _record   │  │  _review      │  │  + attrition_hist│
  └─────┬─────┘  └──────┬───────┘  └────────┬─────────┘
        │               │                   │
        ▼               ▼                   ▼
    外模式:          外模式:             外模式:
    attendance_hr   perf_hr_view        emp_hr_view
    _view                                + mv_attrition_risk

聚合层 (Aggregation):
  ┌──────────────────────────────────────────────┐
  │  mv_attrition_risk (物化视图, 统一公式)       │
  │  8 因子复合评分:                               │
  │  tenure*0.15 + engagement*(-0.01) +           │
  │  last_promotion*0.10 + mgr_changes*0.10 +     │
  │  overtime*0.15 + absent*0.15 +                │
  │  late*0.10 + avg_perf*(-0.10)                 │
  │                                                │
  │  刷新策略: 每 6 小时 REFRESH MATERIALIZED VIEW  │
  │  CONCURRENTLY                                   │
  └──────────────────────┬─────────────────────────┘
                         │
                         ▼
ML 层 (Machine Learning):
  ┌──────────────────────────────────────────────┐
  │  PREDICT BY attrition_model                  │
  │  修正: ML 子查询使用与规则评分一致的子查询     │
  │  不再是 SELECT FROM employee 读不存在的列     │
  │  特征: 从 mv_attrition_risk 提取              │
  └──────────────────────┬─────────────────────────┘
                         │
                         ▼
展示层 (Presentation):
  ┌──────────────────────────────────────────────┐
  │  StrategicAnalytics.tsx                      │
  │  Tab1: 离职风险 (分页+排序+因子分解图)        │
  │  Tab2: 技能缺口 (部门级下钻, 新增)            │
  │  Tab3: 考勤分析 (出勤率趋势, 新增)            │
  │  Tab4: 绩效分析 (评分分布, 新增)              │
  │  Tab5: 综合健康度 (部门风险矩阵, 新增)         │
  └──────────────────────────────────────────────┘
```

#### 4.2.2 关键修复

```python
# 修复 B1: ML 特征列不存在 → 改为从 mv_attrition_risk 读取
# 原代码:
# SELECT employee_id, PREDICT BY attrition_model (FEATURES
#     tenure, engagement_score, ...)   ← employee 表无这些列
# FROM employee

# 修复后:
SELECT r.employee_id,
       ROUND((PREDICT BY attrition_model (FEATURES
           r.composite_risk_score,
           r.tenure, r.engagement_score,
           r.last_promotion_months, r.manager_changes,
           r.overtime_count, r.absent_count,
           r.late_count, r.avg_performance_score
       ) * 100)::decimal, 1) AS ml_risk_score
FROM mv_attrition_risk r
JOIN employee e ON r.employee_id = e.employee_id;
```

#### 4.2.3 快照管线修复

```python
# 修复 B3: attrition_history 表 DDL 缺失
# 添加表定义 (V12 迁移):
# CREATE TABLE attrition_history (
#     history_id BIGSERIAL PRIMARY KEY,
#     employee_id BIGINT NOT NULL REFERENCES employee(employee_id) ON DELETE CASCADE,
#     snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
#     risk_score DECIMAL(5,2),
#     risk_level VARCHAR(20) CHECK (risk_level IN ('low','medium','high','critical')),
#     tenure INT,
#     engagement_score INT,
#     last_promotion_months INT,
#     manager_changes INT,
#     overtime_count INT,
#     attendance_absent_count INT,
#     attendance_late_count INT,
#     avg_performance_score DECIMAL(5,2),
#     ml_risk_score DECIMAL(5,2),
#     risk_score_pct DECIMAL(7,4) GENERATED ALWAYS AS (risk_score * 100) STORED,
#     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
#     UNIQUE (employee_id, snapshot_date)
# );
```

### 4.3 技能管理闭环

#### 4.3.1 数据流图

```
                    员工/HR 发起技能变更
                          │
                    ┌─────▼──────┐
                    │ 审批流引擎   │
                    │ (外模式:    │
                    │  skill_     │
                    │  self_view) │
                    └─────┬──────┘
                          │ 审批通过
                          ▼
                    ┌──────────────────┐
                    │ _execute_payload  │
                    │ INSERT/UPDATE/    │
                    │ DELETE employee_  │
                    │ skill             │
                    └────────┬─────────┘
                             │
                    ┌────────▼────────┐
                    │ mv_skill_coverage │ ← 物化视图, 技能覆盖率
                    │ 刷新 (每日)       │    定期重新计算
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ 分析页 Tab      │
                    │ 技能缺口 (C5)   │
                    │ 部门级下钻 (C6) │
                    └─────────────────┘
```

#### 4.3.2 技能覆盖率物化视图

```sql
CREATE MATERIALIZED VIEW mv_skill_coverage AS
SELECT
    d.department_id,
    d.department_name,
    sc.category_id,
    sc.category_name,
    COUNT(DISTINCT e.employee_id) AS total_employees,
    COUNT(DISTINCT es.employee_id) AS skilled_employees,
    ROUND(
        COUNT(DISTINCT es.employee_id)::DECIMAL /
        NULLIF(COUNT(DISTINCT e.employee_id), 0) * 100, 1
    ) AS coverage_pct,
    ROUND(AVG(es.proficiency_level), 2) AS avg_proficiency
FROM department d
CROSS JOIN skill_category sc
LEFT JOIN employee e ON e.department_id = d.department_id
    AND e.employment_status = 'active'
LEFT JOIN employee_skill es ON e.employee_id = es.employee_id
    AND es.skill_id IN (SELECT skill_id FROM skill WHERE category_id = sc.category_id)
GROUP BY d.department_id, d.department_name, sc.category_id, sc.category_name;
```

### 4.4 跨模块分析闭环

```
┌────────────────────────────────────────────────────────────┐
│                   综合健康度 (部门风险矩阵)                   │
│                                                            │
│  技能覆盖率 ── 25% ─┐                                       │
│  出勤率    ── 25% ──┤                                       │
│  绩效均分  ── 25% ──┤→ department_health_score              │
│  离职风险  ── 25% ──┘                                       │
│                                                            │
│  数据来源:                                                  │
│    mv_skill_coverage  (技能)                                │
│    attendance_hr_view (出勤率 = present/total)              │
│    perf_hr_view       (平均评分)                             │
│    mv_attrition_risk  (平均离职风险)                         │
└────────────────────────────────────────────────────────────┘
```

---

## Part 5: Implementation Roadmap

### 5.1 执行顺序与依赖关系

```
Phase 0: 基础修复 (P0) — 1-2 天
  └── 依赖: 无（独立修复）
  └── 产出: 数据库不再出现运行时崩溃

Phase 1: 外模式 + 权限 (P1) — 2-3 天
  └── 依赖: Phase 0
  └── 产出: 数据库拥有完整三级模式 + DAC

Phase 2: 闭环流程 (P1-P2) — 2-3 天
  └── 依赖: Phase 0
  └── 产出: 审批流 + 离职管线 + 技能管线闭环

Phase 3: 内模式优化 + 应用层适配 (P2-P3) — 2 天
  └── 依赖: Phase 0, Phase 1
  └── 产出: 分区 + 物化视图刷新 + 应用层迁移至视图访问

Phase 4: 前端补全 (P1-P2) — 2 天
  └── 依赖: Phase 2 (数据层就绪)
  └── 产出: 分析页补全 + 权限 UI
```

### 5.2 Phase 0: 基础修复（P0 级）

| 任务 | 文件/位置 | 工作量 | 说明 |
|------|---------|-------|------|
| 0.1 补充 3 个缺失的 FK | `V12__fix_missing_fks.sql` | 30 分钟 | `employee.manager_employee_id`, `department.manager_employee_id`, `employee_job_history.manager_employee_id` |
| 0.2 补充 6 个缺失的 CHECK | `V12__fix_missing_checks.sql` | 30 分钟 | leave_status, risk_level, employment_status, gender, leave_type_status, clock_type/source |
| 0.3 添加 `attrition_history` 表 DDL | `V12__add_attrition_history.sql` | 1 小时 | 基于审计发现的字段定义 |
| 0.4 修复 ML 特征列 | `attrition_service.py` | 2 小时 | 将 3 个不存在列改为子查询表达式，或基于 mv_attrition_risk |
| 0.5 修复 `_execute_payload` 原子性 | `approval_service.py` | 1 小时 | 将执行步骤移到 status UPDATE 前；引入 'executing' 中间态 |
| 0.6 添加 approval_request `action_code` 索引 | `V12__add_action_code_index.sql` | 10 分钟 | 无依赖 |

### 5.3 Phase 1: 外模式 + 权限系统（P1 级）

| 任务 | 文件/位置 | 工作量 | 说明 |
|------|---------|-------|------|
| 1.1 创建全部外模式视图 (13 个视图) | `V13__create_external_views.sql` | 3 小时 | 基于 Part 2.3 的视图定义 |
| 1.2 创建角色层次表 `sys_role_hierarchy` | `V13__add_role_hierarchy.sql` | 30 分钟 | 新增表 + 种子数据 |
| 1.3 创建物化视图 `mv_attrition_risk` | `V13__create_mv_attrition.sql` | 2 小时 | 消除公式重复 |
| 1.4 执行数据库级 GRANT | `V13__grant_permissions.sql` | 1 小时 | 基于 Part 3.2 的 GRANT 定义 |
| 1.5 启用 RLS 策略 | `V13__enable_rls.sql` | 1 小时 | employee + leave_request 的 RLS 策略 |
| 1.6 应用层会话变量注入 | `db_connection.py` 或连接池配置 | 1 小时 | set_config('app.emp_id', ...) |
| 1.7 评估并移除 CEO/ADMIN 冗余 | 概念模式修复 | 30 分钟 | 合并或文档说明 |

### 5.4 Phase 2: 闭环流程（P1-P2 级）

| 任务 | 文件/位置 | 工作量 | 说明 |
|------|---------|-------|------|
| 2.1 修复状态机 + 添加 Verify 节点 | `approval_service.py` | 2 小时 | 引入 verifying/verified 状态 |
| 2.2 添加执行结果审计 | `approval_service.py` + `_execute_payload` | 1 小时 | 每个操作类型写入对应审计日志 |
| 2.3 添加执行失败通知 | `approval_service.py` | 1 小时 | try/except 包裹 + 通知申请人/管理员 |
| 2.4 创建 `mv_skill_coverage` | `V14__create_mv_skill_coverage.sql` | 1 小时 | 技能覆盖率物化视图 + 刷新调度 |
| 2.5 统一风险评分公式 | `attrition_service.py`, `analytics_service.py` | 2 小时 | 改为引用 mv_attrition_risk 而非重复公式 |
| 2.6 ML 训练接口权限校验 | `server.py` + `predict_service.py` | 30 分钟 | 添加 _require_permission |

### 5.5 Phase 3: 内模式优化 + 应用层适配（P2-P3 级）

| 任务 | 文件/位置 | 工作量 | 说明 |
|------|---------|-------|------|
| 3.1 实现表分区 | `V15__add_partitions.sql` | 2 小时 | attendance_record, attrition_history, audit_log |
| 3.2 配置物化视图刷新策略 | 定时任务/Cron | 1 小时 | mv_attrition_risk 每 6h, mv_skill_coverage 每日 |
| 3.3 服务层迁移至视图访问 | 各 service 文件 | 4 小时 | 将基表 SELECT 改为视图 SELECT（逐步迁移） |
| 3.4 补充 id_card_no 加密 | 存储层 | 2 小时 | 评估 pgcrypto 或应用层加密 |

### 5.6 Phase 4: 前端补全（P1-P2 级）

| 任务 | 文件/位置 | 工作量 | 说明 |
|------|---------|-------|------|
| 4.1 技能缺口部门下钻 | `StrategicAnalytics.tsx` + 后端 API | 2 小时 | C6 缺失 |
| 4.2 考勤分析 Tab | `StrategicAnalytics.tsx` + 后端 API | 3 小时 | C7 缺失 |
| 4.3 绩效分析 Tab | `StrategicAnalytics.tsx` + 后端 API | 3 小时 | C8 缺失 |
| 4.4 综合健康度 Tab | `StrategicAnalytics.tsx` + 后端 API | 3 小时 | C9 缺失 |
| 4.5 权限 UI (403 提示 / RouteGuard / RequirePermission) | 前端组件 | 2 小时 | E5, E6, E7 缺失 |

### 5.7 迁移文件版本规划

```
DB/sql/migrations/
  V12__fix_integrity_constraints.sql     ← Phase 0: FK + CHECK + attrition_history DDL
  V13__external_schema_and_dac.sql       ← Phase 1: views + role hierarchy + GRANT + RLS
  V14__materialized_views.sql            ← Phase 2: mv_attrition_risk + mv_skill_coverage
  V15__partition_and_encryption.sql      ← Phase 3: partitioning + encryption
```

### 5.8 依赖图

```
Phase 0 (基础修复)
  │
  ├──── Phase 1 (外模式 + 权限) ← 必须先有基础 FK/CHK 保证数据完整性再建视图
  │         │
  │         └──── Phase 3 (内模式 + 应用迁移) ← 视图就绪后才能迁移服务层
  │
  └──── Phase 2 (闭环流程) ← 基础修复就绪后独立进行
            │
            └──── Phase 4 (前端补全) ← 数据层就绪后才开始
```

---

## Appendix A: 当前状态 vs 目标状态对比

| 维度 | 当前状态 | 目标状态 |
|------|---------|---------|
| 三级模式 | 只有概念模式 | 完整三级: 外模式(13视图) + 概念模式 + 内模式(分区) |
| 权限模型 | 应用层字符串集合检查 | 三层叠加: JWT(RBAC) + GRANT(DAC) + RLS |
| 角色层次 | 扁平, 无继承 | EMPLOYEE < MANAGER < HR < ADMIN 层级继承 |
| 参照完整性 | 3 个 FK 缺失 | 全部 FK 到位 |
| CHECK 约束 | 11 个有, 6 个缺失 | 全部 CHECK 到位 |
| 公式一致性 | 3 处重复 | 统一物化视图 |
| 审批流原子性 | execute 在状态更新后 | 同一事务, 前置执行 |
| 表分区 | 无 | attendance/audit/attrition 按时间分区 |
| PII 保护 | id_card_no 明文 | 加密存储或脱敏视图 |
| 分析页 | 只有离职风险 | 5 Tab 全覆盖 |
| GRANT/REVOKE | 完全未使用 | 全部视图 GRANT + 角色层次 GRANT |

## Appendix B: 理论对标总结

| 数据库理论 | 当前符合度 | 目标符合度 | 关键措施 |
|-----------|----------|----------|---------|
| 三级模式结构 (ANSI/SPARC) | 40% | 95% | 新建 13 个外模式视图 + 内模式分区 |
| 逻辑独立性 | 10% | 90% | 服务层通过视图访问基表 |
| 物理独立性 | 30% | 85% | 分区策略不影響概念模式 |
| 参照完整性 | 85% | 100% | 补充 3 个 FK |
| 用户定义完整性 | 65% | 100% | 补充 6 个 CHECK |
| 1NF | 100% | 100% | 维持 |
| 2NF | 100% | 100% | 维持 |
| 3NF | 95% | 100% | 移除 leave_type 冗余列 |
| BCNF | 100% | 100% | 维持 |
| DAC (GRANT/REVOKE) | 0% | 90% | 全部视图 + 列级 GRANT |
| RBAC 角色层次 | 20% | 90% | sys_role_hierarchy + GRANT role TO role |
| RLS (行级安全) | 0% | 85% | employee + leave_request RLS 策略 |
| 事务 ACID 原子性 | 50% | 100% | _execute_payload 前置到事务内 |
| 物化视图 | 0% | 80% | mv_attrition_risk + mv_skill_coverage |

---

*计划生成结束。本文件覆盖全部审计发现 (schema-audit.md 19 项 + permission-audit.md 5 大问题 + closed-loop-audit.md 12 项缺陷) 及其修复路径。*
