-- V8: Analytics module - Attendance, Performance, Enhanced Attrition
-- Depends on V5 (employee ML columns) and V7 (attrition_history).

-- ====================================================================
-- 1. Attendance tracking
-- ====================================================================
CREATE TABLE IF NOT EXISTS attendance_record (
    attendance_id    BIGSERIAL PRIMARY KEY,
    employee_id      BIGINT NOT NULL REFERENCES employee(employee_id) ON DELETE CASCADE,
    clock_in         TIMESTAMP NOT NULL,
    clock_out        TIMESTAMP,
    clock_type       VARCHAR(20) NOT NULL DEFAULT 'normal',  -- normal | overtime | remote
    status           VARCHAR(20) NOT NULL DEFAULT 'present', -- present | late | absent | half-day
    source           VARCHAR(20) DEFAULT 'manual',            -- manual | system
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee   ON attendance_record(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date       ON attendance_record(clock_in);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date   ON attendance_record(employee_id, clock_in);

-- ====================================================================
-- 2. Performance reviews
-- ====================================================================
CREATE TABLE IF NOT EXISTS performance_review (
    review_id        BIGSERIAL PRIMARY KEY,
    employee_id      BIGINT NOT NULL REFERENCES employee(employee_id) ON DELETE CASCADE,
    reviewer_id      BIGINT NOT NULL REFERENCES employee(employee_id),
    review_period    VARCHAR(30) NOT NULL,                -- '2026-Q1', '2026-H1', '2026-Annual'
    rating           SMALLINT CHECK (rating BETWEEN 1 AND 5),
    score            DECIMAL(5,2),                        -- 0.00 - 100.00
    strengths        TEXT,
    improvements     TEXT,
    goals            TEXT,
    status           VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft | submitted | acknowledged
    submitted_at     TIMESTAMP,
    acknowledged_at  TIMESTAMP,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_perf_employee   ON performance_review(employee_id);
CREATE INDEX IF NOT EXISTS idx_perf_period     ON performance_review(review_period);
CREATE INDEX IF NOT EXISTS idx_perf_status     ON performance_review(status);

-- ====================================================================
-- 3. Enhanced employee columns for attrition analytics
-- ====================================================================
ALTER TABLE employee ADD COLUMN IF NOT EXISTS attendance_late_count     INTEGER DEFAULT 0;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS attendance_absent_count   INTEGER DEFAULT 0;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS avg_performance_score     DECIMAL(5,2);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS last_review_rating        SMALLINT;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS last_review_date          DATE;

-- Update attrition_history table to include new component columns
ALTER TABLE attrition_history ADD COLUMN IF NOT EXISTS attendance_risk    DECIMAL(6,4) DEFAULT 0;
ALTER TABLE attrition_history ADD COLUMN IF NOT EXISTS performance_risk   DECIMAL(6,4) DEFAULT 0;

-- ====================================================================
-- 4. New permissions (idempotent)
-- ====================================================================
INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'skill.manage', '技能管理', '管理技能、类别、AI推断'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'skill.manage');

INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'analytics.view', '分析查看', '查看技能差距、离职预测、绩效趋势'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'analytics.view');

INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'attendance.view', '考勤查看', '查看考勤记录（部门级）'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'attendance.view');

INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'performance.view', '绩效查看', '查看绩效评估（部门级）'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'performance.view');

INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'performance.manage', '绩效管理', '创建和更新绩效评估'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'performance.manage');

INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'team.view', '团队查看', '查看直属团队成员资料'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'team.view');

-- ====================================================================
-- 5. Grant new permissions to roles
-- ====================================================================

-- MANAGER role (role_code = 'MANAGER'): add if missing, then grant team-scoped permissions
INSERT INTO sys_role (role_code, role_name, description)
SELECT 'MANAGER', '部门经理', '审批人 + 团队管理'
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code = 'MANAGER');

-- CEO role (role_code = 'CEO')
INSERT INTO sys_role (role_code, role_name, description)
SELECT 'CEO', 'CEO/管理员', '系统所有者——所有权限'
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code = 'CEO');

-- CEO gets every permission
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM sys_role r
CROSS JOIN sys_permission p
WHERE r.role_code = 'CEO'
  AND NOT EXISTS (
    SELECT 1 FROM sys_role_permission x
    WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
  );

-- ADMIN gets all new permissions
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM sys_role r
JOIN sys_permission p ON p.permission_code IN (
    'skill.manage', 'analytics.view', 'attendance.view',
    'performance.view', 'performance.manage', 'team.view'
)
WHERE r.role_code = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM sys_role_permission x
    WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
  );

-- MANAGER gets team-scoped: skill.manage, analytics.view, attendance.view, performance.view, team.view
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM sys_role r
JOIN sys_permission p ON p.permission_code IN (
    'skill.manage', 'analytics.view', 'attendance.view',
    'performance.view', 'team.view'
)
WHERE r.role_code = 'MANAGER'
  AND NOT EXISTS (
    SELECT 1 FROM sys_role_permission x
    WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
  );

-- EMPLOYEE gets leave.manage (self) — already exists from V1
-- EMPLOYEE also gets team.view (self) implicitly via "self-only" logic in API
