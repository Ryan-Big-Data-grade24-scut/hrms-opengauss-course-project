-- V9: Schema Enhancements — constraints, indexes, sub-scores, attendance columns
-- Depends on V8 (attendance_record, performance_review, permissions, roles).
--
-- What this migration adds:
--   1. attendance_record: work_date, late/early minutes, overtime approval fields
--   2. attendance_record: CHECK + UNIQUE constraints, 5 new indexes
--   3. performance_review: 4 sub-score columns, reviewer/employee comments
--   4. performance_review: CHECK + UNIQUE constraints, 4 new indexes
--   5. Missing indexes on 6 existing tables (department, employee_job_history,
--      leave_request, audit_log, skill, skill_category, position)
--   6. New permission: attendance.manage
--   7. Grant attendance.manage to ADMIN, HR, MANAGER roles
-- ============================================================================

-- ====================================================================
-- 1. attendance_record column additions
-- ====================================================================

DO $$
BEGIN
    -- work_date: business date extracted from clock_in
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_record' AND column_name = 'work_date'
    ) THEN
        ALTER TABLE attendance_record ADD COLUMN work_date DATE;
    END IF;

    -- late_minutes: how late the employee was (0 = on time)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_record' AND column_name = 'late_minutes'
    ) THEN
        ALTER TABLE attendance_record ADD COLUMN late_minutes INTEGER DEFAULT 0;
    END IF;

    -- early_leave_minutes: how early the employee left
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_record' AND column_name = 'early_leave_minutes'
    ) THEN
        ALTER TABLE attendance_record ADD COLUMN early_leave_minutes INTEGER DEFAULT 0;
    END IF;

    -- overtime_approved: manager approval for overtime shifts
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_record' AND column_name = 'overtime_approved'
    ) THEN
        ALTER TABLE attendance_record ADD COLUMN overtime_approved BOOLEAN DEFAULT FALSE;
    END IF;

    -- approver_employee_id: who approved the overtime
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_record' AND column_name = 'approver_employee_id'
    ) THEN
        ALTER TABLE attendance_record ADD COLUMN approver_employee_id BIGINT
            REFERENCES employee(employee_id);
    END IF;

    -- approved_at: timestamp of approval
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_record' AND column_name = 'approved_at'
    ) THEN
        ALTER TABLE attendance_record ADD COLUMN approved_at TIMESTAMP;
    END IF;

    -- remarks: free-text notes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_record' AND column_name = 'remarks'
    ) THEN
        ALTER TABLE attendance_record ADD COLUMN remarks VARCHAR(255);
    END IF;
END $$;

-- Backfill work_date from clock_in for existing rows
UPDATE attendance_record
SET work_date = clock_in::date
WHERE work_date IS NULL;

-- Make work_date NOT NULL after backfill
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_record'
          AND column_name = 'work_date'
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE attendance_record ALTER COLUMN work_date SET NOT NULL;
    END IF;
END $$;

-- ====================================================================
-- 2. attendance_record constraints
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uk_attendance_employee_date'
    ) THEN
        ALTER TABLE attendance_record
            ADD CONSTRAINT uk_attendance_employee_date
            UNIQUE (employee_id, work_date);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_attendance_clock_out'
    ) THEN
        ALTER TABLE attendance_record
            ADD CONSTRAINT ck_attendance_clock_out
            CHECK (clock_out IS NULL OR clock_out > clock_in);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_attendance_status'
    ) THEN
        ALTER TABLE attendance_record
            ADD CONSTRAINT ck_attendance_status
            CHECK (status IN ('present', 'late', 'absent', 'half-day', 'overtime'));
    END IF;

    -- late/early leave non-negative
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_attendance_late_minutes'
    ) THEN
        ALTER TABLE attendance_record
            ADD CONSTRAINT ck_attendance_late_minutes
            CHECK (late_minutes >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_attendance_early_leave'
    ) THEN
        ALTER TABLE attendance_record
            ADD CONSTRAINT ck_attendance_early_leave
            CHECK (early_leave_minutes >= 0);
    END IF;
END $$;

-- ====================================================================
-- 3. attendance_record new indexes
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_attendance_work_date
    ON attendance_record(work_date);

CREATE INDEX IF NOT EXISTS idx_attendance_status
    ON attendance_record(status);

CREATE INDEX IF NOT EXISTS idx_attendance_clock_type
    ON attendance_record(clock_type);

CREATE INDEX IF NOT EXISTS idx_attendance_emp_status_date
    ON attendance_record(employee_id, status, work_date);

CREATE INDEX IF NOT EXISTS idx_attendance_emp_work_date
    ON attendance_record(employee_id, work_date);

-- ====================================================================
-- 4. performance_review column additions (sub-scores + comments)
-- ====================================================================

DO $$
BEGIN
    -- Technical skills sub-score
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'performance_review' AND column_name = 'score_technical'
    ) THEN
        ALTER TABLE performance_review ADD COLUMN score_technical DECIMAL(5,2);
    END IF;

    -- Communication sub-score
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'performance_review' AND column_name = 'score_communication'
    ) THEN
        ALTER TABLE performance_review ADD COLUMN score_communication DECIMAL(5,2);
    END IF;

    -- Leadership sub-score
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'performance_review' AND column_name = 'score_leadership'
    ) THEN
        ALTER TABLE performance_review ADD COLUMN score_leadership DECIMAL(5,2);
    END IF;

    -- Collaboration sub-score
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'performance_review' AND column_name = 'score_collaboration'
    ) THEN
        ALTER TABLE performance_review ADD COLUMN score_collaboration DECIMAL(5,2);
    END IF;

    -- Reviewer-private notes (not visible to employee)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'performance_review' AND column_name = 'reviewer_comment'
    ) THEN
        ALTER TABLE performance_review ADD COLUMN reviewer_comment TEXT;
    END IF;

    -- Employee self-assessment / response
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'performance_review' AND column_name = 'employee_comment'
    ) THEN
        ALTER TABLE performance_review ADD COLUMN employee_comment TEXT;
    END IF;
END $$;

-- ====================================================================
-- 5. performance_review constraints
-- ====================================================================

DO $$
BEGIN
    -- One review per employee per period
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uk_perf_employee_period'
    ) THEN
        ALTER TABLE performance_review
            ADD CONSTRAINT uk_perf_employee_period
            UNIQUE (employee_id, review_period);
    END IF;

    -- Reviewer cannot review themselves
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_perf_reviewer_not_self'
    ) THEN
        ALTER TABLE performance_review
            ADD CONSTRAINT ck_perf_reviewer_not_self
            CHECK (reviewer_id != employee_id);
    END IF;

    -- Score range (0-100)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_perf_score_range'
    ) THEN
        ALTER TABLE performance_review
            ADD CONSTRAINT ck_perf_score_range
            CHECK (score IS NULL OR (score BETWEEN 0 AND 100));
    END IF;

    -- Status state machine
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_perf_status'
    ) THEN
        ALTER TABLE performance_review
            ADD CONSTRAINT ck_perf_status
            CHECK (status IN ('draft', 'submitted', 'acknowledged'));
    END IF;
END $$;

-- ====================================================================
-- 6. performance_review new indexes
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_perf_reviewer
    ON performance_review(reviewer_id);

CREATE INDEX IF NOT EXISTS idx_perf_emp_status
    ON performance_review(employee_id, status);

CREATE INDEX IF NOT EXISTS idx_perf_emp_period
    ON performance_review(employee_id, review_period);

CREATE INDEX IF NOT EXISTS idx_perf_period_status
    ON performance_review(review_period, status);

-- ====================================================================
-- 7. Missing indexes on existing tables
-- ====================================================================

-- 7.1 department: parent_department_id (recursive CTE)
CREATE INDEX IF NOT EXISTS idx_department_parent
    ON department(parent_department_id);

-- 7.2 employee_job_history: FK columns + date-range composite
CREATE INDEX IF NOT EXISTS idx_ejh_department
    ON employee_job_history(department_id);

CREATE INDEX IF NOT EXISTS idx_ejh_position
    ON employee_job_history(position_id);

CREATE INDEX IF NOT EXISTS idx_ejh_job
    ON employee_job_history(job_id);

CREATE INDEX IF NOT EXISTS idx_ejh_active_range
    ON employee_job_history(employee_id, start_date, end_date);

-- 7.3 leave_request: composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_leave_employee_status
    ON leave_request(employee_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_leave_employee_dates
    ON leave_request(employee_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_leave_status_dates
    ON leave_request(approval_status, start_date);

-- 7.4 audit_log: target-based + action-type lookups
CREATE INDEX IF NOT EXISTS idx_audit_target
    ON audit_log(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_audit_action
    ON audit_log(action_type);

-- 7.5 skill: category_id filter
CREATE INDEX IF NOT EXISTS idx_skill_category
    ON skill(category_id);

-- 7.6 skill_category: self-referencing hierarchy
CREATE INDEX IF NOT EXISTS idx_skill_category_parent
    ON skill_category(parent_category_id);

-- 7.7 position: composite department + job lookup
CREATE INDEX IF NOT EXISTS idx_position_dept_job
    ON position(department_id, job_id);

-- ====================================================================
-- 8. New permission: attendance.manage
-- ====================================================================

INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'attendance.manage', '考勤管理', '手动调整考勤记录、补签、审批加班'
WHERE NOT EXISTS (
    SELECT 1 FROM sys_permission WHERE permission_code = 'attendance.manage'
);

-- ====================================================================
-- 9. Grant attendance.manage to ADMIN, HR, MANAGER roles
-- ====================================================================

-- ADMIN gets attendance.manage
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM sys_role r
CROSS JOIN sys_permission p
WHERE r.role_code = 'ADMIN'
  AND p.permission_code = 'attendance.manage'
  AND NOT EXISTS (
    SELECT 1 FROM sys_role_permission x
    WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
  );

-- HR gets attendance.manage
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM sys_role r
CROSS JOIN sys_permission p
WHERE r.role_code = 'HR'
  AND p.permission_code = 'attendance.manage'
  AND NOT EXISTS (
    SELECT 1 FROM sys_role_permission x
    WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
  );

-- MANAGER gets attendance.manage (for overtime approval of direct reports)
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM sys_role r
CROSS JOIN sys_permission p
WHERE r.role_code = 'MANAGER'
  AND p.permission_code = 'attendance.manage'
  AND NOT EXISTS (
    SELECT 1 FROM sys_role_permission x
    WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id
  );

-- CEO already has all permissions via the cross-join in V8, so no insert needed.
-- The new permission will automatically be available to CEO.

-- ====================================================================
-- NOTE: If you need to rebootstrap RBAC after this migration, call:
--   SELECT bootstrap_rbac();
-- (defined in src/common/db.py)
-- ====================================================================
