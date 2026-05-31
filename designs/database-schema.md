# Layer 1: Database Schema Design

> **Blueprint Reference**: `workspace/architecture-blueprint.md`
> **Migration**: `sql/migrations/V9__schema_enhance.sql`
> **Date**: 2026-05-30

---

## Overview

This document specifies the complete database schema design for Layer 1 of the HRMS rewrite. It covers two new tables (`attendance_record`, `performance_review`), missing indexes on existing tables, new permission codes, and updated role-permission mappings. The existing V8 migration (`V8__analytics_attendance_performance.sql`) creates the basic table skeletons; this V9 migration adds constraints, computed columns, sub-score columns, and missing indexes.

---

## 1. `attendance_record` Table (Enhanced)

### Purpose
Tracks employee clock-in/clock-out events with support for late detection, overtime approval, and cross-department analytics.

### Column Specification

| # | Column | Type | Constraints | Description |
|---|--------|------|-------------|-------------|
| 1 | `attendance_id` | `BIGSERIAL` | `PRIMARY KEY` | Surrogate primary key |
| 2 | `employee_id` | `BIGINT` | `NOT NULL`, `FK -> employee(employee_id) ON DELETE CASCADE` | The employee who clocked |
| 3 | `work_date` | `DATE` | `NOT NULL` | Business date of attendance (set = `clock_in::date` at insert; application-layer maintained for compatibility) |
| 4 | `clock_in` | `TIMESTAMP` | `NOT NULL` | Actual clock-in timestamp |
| 5 | `clock_out` | `TIMESTAMP` | — | Actual clock-out timestamp; `NULL` means still active |
| 6 | `clock_type` | `VARCHAR(20)` | `NOT NULL DEFAULT 'normal'` | `normal`, `overtime`, `remote` |
| 7 | `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'present'`, `CHECK (status IN (...))` | `present`, `late`, `absent`, `half-day`, `overtime` |
| 8 | `late_minutes` | `INTEGER` | `DEFAULT 0 CHECK (>= 0)` | Minutes late (set when status = 'late') |
| 9 | `early_leave_minutes` | `INTEGER` | `DEFAULT 0 CHECK (>= 0)` | Minutes left early |
| 10 | `overtime_approved` | `BOOLEAN` | `DEFAULT FALSE` | Whether overtime was manager-approved |
| 11 | `approver_employee_id` | `BIGINT` | `FK -> employee(employee_id)` | Who approved the overtime |
| 12 | `approved_at` | `TIMESTAMP` | — | When approval was granted |
| 13 | `source` | `VARCHAR(20)` | `DEFAULT 'manual'` | `manual`, `system`, `import` |
| 14 | `remarks` | `VARCHAR(255)` | — | Free-text notes (late reason, correction reason) |
| 15 | `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Row creation time |

### Constraints

```sql
-- One record per employee per business day
UNIQUE (employee_id, work_date)

-- Clock-out must be after clock-in (when set)
CHECK (clock_out IS NULL OR clock_out > clock_in)

-- Status values restricted
CHECK (status IN ('present', 'late', 'absent', 'half-day', 'overtime'))

-- Late/early minutes non-negative
CHECK (late_minutes >= 0)
CHECK (early_leave_minutes >= 0)

-- Permission: clock_type values (application-enforced)
-- 'normal', 'overtime', 'remote'
```

### Indexes

| Index Name | Columns | Rationale |
|-----------|---------|-----------|
| `idx_attendance_employee` (existing) | `employee_id` | FK lookups |
| `idx_attendance_date` (existing) | `clock_in` | Date range queries |
| `idx_attendance_emp_date` (existing) | `employee_id, clock_in` | Employee time-series |
| `idx_attendance_work_date` **(new)** | `work_date` | Daily aggregate queries |
| `idx_attendance_status` **(new)** | `status` | Filter by attendance status |
| `idx_attendance_clock_type` **(new)** | `clock_type` | Filter by clock type |
| `idx_attendance_emp_status_date` **(new)** | `employee_id, status, work_date` | Employee analytics by status |
| `idx_attendance_emp_work_date` **(new)** | `employee_id, work_date` | Supports UNIQUE constraint |

### Design Rationale

- **`work_date` as separate DATE column**: The service layer already uses `clock_in >= date::date` predicates extensively. A dedicated `work_date` column avoids function-based index overhead and makes the UNIQUE constraint on `(employee_id, work_date)` straightforward and efficient.
- **`late_minutes` / `early_leave_minutes`**: Capture the severity of lateness, enabling trend analysis ("is this employee getting later over time?"). The `attendance_service.update_absent_late_counts()` method already aggregates by status count; these columns enable deeper insight.
- **`overtime_approved` / `approver_employee_id`**: Supports the real-world overtime approval workflow. When `clock_type = 'overtime'`, the system can require `overtime_approved = TRUE`. This integrates with team.view permission for manager approval.
- **Composite index `idx_attendance_emp_status_date`**: Powers the `attendance_summary()` query which filters by `employee_id`, groups by `status`, and ranges by date.

---

## 2. `performance_review` Table (Enhanced)

### Purpose
Stores multi-dimensional performance evaluations with sub-scores, status workflow (draft -> submitted -> acknowledged), and self/manager comments.

### Column Specification

| # | Column | Type | Constraints | Description |
|---|--------|------|-------------|-------------|
| 1 | `review_id` | `BIGSERIAL` | `PRIMARY KEY` | Surrogate primary key |
| 2 | `employee_id` | `BIGINT` | `NOT NULL`, `FK -> employee(employee_id) ON DELETE CASCADE` | Employee being reviewed |
| 3 | `reviewer_id` | `BIGINT` | `NOT NULL`, `FK -> employee(employee_id)` | Who conducted the review |
| 4 | `review_period` | `VARCHAR(30)` | `NOT NULL` | e.g. `'2026-Q1'`, `'2026-H1'`, `'2026-Annual'` |
| 5 | `rating` | `SMALLINT` | `CHECK (1..5)` | Overall rating |
| 6 | `score` | `DECIMAL(5,2)` | `CHECK (0..100)` | Overall numeric score |
| 7 | `score_technical` | `DECIMAL(5,2)` | — | Technical skills sub-score |
| 8 | `score_communication` | `DECIMAL(5,2)` | — | Communication sub-score |
| 9 | `score_leadership` | `DECIMAL(5,2)` | — | Leadership sub-score |
| 10 | `score_collaboration` | `DECIMAL(5,2)` | — | Collaboration sub-score |
| 11 | `strengths` | `TEXT` | — | Strengths text |
| 12 | `improvements` | `TEXT` | — | Areas for improvement |
| 13 | `goals` | `TEXT` | — | Goals for next period |
| 14 | `reviewer_comment` | `TEXT` | — | Private notes from reviewer (not visible to employee) |
| 15 | `employee_comment` | `TEXT` | — | Employee self-assessment / response |
| 16 | `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'draft'`, `CHECK (status IN (...))` | `draft`, `submitted`, `acknowledged` |
| 17 | `submitted_at` | `TIMESTAMP` | — | When submitted by reviewer |
| 18 | `acknowledged_at` | `TIMESTAMP` | — | When acknowledged by employee |
| 19 | `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Row creation time |

### Constraints

```sql
-- One review per employee per period
UNIQUE (employee_id, review_period)

-- Reviewer cannot be the same as the employee
CHECK (reviewer_id != employee_id)

-- Rating scale
CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5))

-- Score range (overall and sub-scores)
CHECK (score IS NULL OR (score BETWEEN 0 AND 100))

-- Status state machine
CHECK (status IN ('draft', 'submitted', 'acknowledged'))
```

### Indexes

| Index Name | Columns | Rationale |
|-----------|---------|-----------|
| `idx_perf_employee` (existing) | `employee_id` | Employee lookups |
| `idx_perf_period` (existing) | `review_period` | Period-based filtering |
| `idx_perf_status` (existing) | `status` | Status filtering |
| `idx_perf_reviewer` **(new)** | `reviewer_id` | Find reviews by a reviewer |
| `idx_perf_emp_status` **(new)** | `employee_id, status` | Employee reviews by status |
| `idx_perf_emp_period` **(new)** | `employee_id, review_period` | Supports UNIQUE constraint |
| `idx_perf_period_status` **(new)** | `review_period, status` | Period + status filter |

### Design Rationale

- **Four sub-scores**: A single `score` column is insufficient for meaningful analytics. The department-level summaries in `performance_summary()` benefit from dimensional breakdown -- "Engineering is strong technically but weak on communication." These map to real-world 360-review frameworks.
- **`reviewer_comment` vs `employee_comment`**: Separating reviewer-private notes from employee-visible content is an HR compliance requirement. The `reviewer_comment` is only visible to ADMIN/HR/MANAGER roles; `employee_comment` is the employee's self-assessment.
- **`UNIQUE (employee_id, review_period)`**: Prevents duplicate reviews for the same period. This is critical for data integrity -- the `sync_avg_performance_score()` method uses `DISTINCT ON (employee_id)` which assumes one review per employee per period.
- **Status state machine**: `draft` (reviewer is still writing) -> `submitted` (finalized, visible to employee) -> `acknowledged` (employee has read and acknowledged). The `submitted_at` and `acknowledged_at` timestamps support audit trails.

---

## 3. Missing Indexes on Existing Tables

### 3.1 `department`

| Index Name | Columns | Reason |
|-----------|---------|--------|
| `idx_department_parent` | `parent_department_id` | Recursive CTE in `org_tree()` traverses the parent-child hierarchy. Without this index, each recursive step does a full scan. |

### 3.2 `employee_job_history`

| Index Name | Columns | Reason |
|-----------|---------|--------|
| `idx_ejh_department` | `department_id` | Filter job history by department |
| `idx_ejh_position` | `position_id` | Filter job history by position |
| `idx_ejh_job` | `job_id` | Filter job history by job family |
| `idx_ejh_active_range` | `employee_id, start_date, end_date` | Date-range queries for active positions |

### 3.3 `leave_request`

| Index Name | Columns | Reason |
|-----------|---------|--------|
| `idx_leave_employee_status` | `employee_id, approval_status` | "Show me all approved leaves for this employee" |
| `idx_leave_employee_dates` | `employee_id, start_date, end_date` | Date-range overlap checks |
| `idx_leave_status_dates` | `approval_status, start_date` | Pending leaves in date range |

### 3.4 `audit_log`

| Index Name | Columns | Reason |
|-----------|---------|--------|
| `idx_audit_target` | `target_type, target_id` | "Show all audit entries for this specific entity" |
| `idx_audit_action` | `action_type` | Filter by type of action |
| `idx_audit_created_date` | `created_at` | Already exists as `idx_audit_created_at` -- rename for consistency? Existing index is sufficient. |

### 3.5 `skill`

| Index Name | Columns | Reason |
|-----------|---------|--------|
| `idx_skill_category` | `category_id` | `list_skills(category_id)` filters by this column in every call |

### 3.6 `skill_category`

| Index Name | Columns | Reason |
|-----------|---------|--------|
| `idx_skill_category_parent` | `parent_category_id` | Self-referencing hierarchy for category drill-down |

### 3.7 `position`

| Index Name | Columns | Reason |
|-----------|---------|--------|
| `idx_position_dept_job` | `department_id, job_id` | Composite lookup used in `directory_service` joins |

---

## 4. New Permission Codes

The following permission codes need to be inserted into `sys_permission`:

| Permission Code | Permission Name | Description | Required By |
|----------------|----------------|-------------|-------------|
| `attendance.manage` | 考勤管理 | 手动调整考勤记录、补签、审批加班 | ADMIN, HR, MANAGER |

### Rationale

The existing V8 migration already added the following permissions:
- `skill.manage` -- skill CRUD and AI inference
- `analytics.view` -- cross-module analytics dashboards
- `attendance.view` -- view attendance records (department-scoped)
- `performance.view` -- view performance reviews (department-scoped)
- `performance.manage` -- create and update performance reviews
- `team.view` -- view direct report team members

**What's missing** is `attendance.manage` for the real-world scenario where:
- An employee forgot to clock in and needs a manual correction
- HR needs to adjust a late/absent status after receiving a doctor's note
- A manager needs to approve overtime requests
- Bulk import of attendance data from external systems

The `/api/attendance/clock` endpoint currently is self-service (no permission check), but `attendance.manage` gates:
- Manual status overrides
- Editing existing records
- Overtime approval workflow
- Attendance record corrections

---

## 5. Role-Permission Mappings

### Current State (from V8 + bootstrap_rbac)

| Role | Permissions |
|------|------------|
| **CEO** | ALL (cross-join sys_permission) |
| **ADMIN** | `user.manage`, `employee.manage`, `department.manage`, `leave.manage`, `audit.view`, `skill.manage`, `analytics.view`, `attendance.view`, `performance.view`, `performance.manage`, `team.view` |
| **HR** | `employee.manage`, `department.manage`, `leave.manage`, `audit.view`, `skill.manage`, `analytics.view`, `attendance.view`, `performance.view`, `team.view` |
| **MANAGER** | `leave.manage`, `skill.manage`, `analytics.view`, `attendance.view`, `performance.view`, `team.view` |
| **EMPLOYEE** | `leave.manage` |

### Updated Mappings (V9 addition)

| Role | Add Permission |
|------|---------------|
| **ADMIN** | `attendance.manage` |
| **HR** | `attendance.manage` |
| **MANAGER** | `attendance.manage` (for overtime approval of direct reports) |

No changes needed for CEO (already has all via cross-join) or EMPLOYEE.

---

## 6. Data Migration Considerations

### 6.1 Backfilling `work_date` on `attendance_record`

```sql
UPDATE attendance_record
SET work_date = clock_in::date
WHERE work_date IS NULL;
```

### 6.2 `attendance.manage` for CEO role

Since CEO gets all permissions via `CROSS JOIN sys_permission`, no explicit insert is needed. The CEO role will automatically pick up `attendance.manage` once it exists in `sys_permission`.

### 6.3 Idempotency

All DDL statements use `IF NOT EXISTS` / `IF NOT ... THEN` patterns. All DML permission inserts use `WHERE NOT EXISTS (...)`. This allows safe re-execution of the migration.

---

## 7. Query Patterns and Index Coverage

### attendance_record query patterns

| Pattern | Columns Filtered | Index Used |
|---------|-----------------|------------|
| Employee's recent records | `employee_id`, `clock_in` DESC | `idx_attendance_emp_date` |
| Department attendance today | `work_date` = today, `employee_id` via dept join | `idx_attendance_work_date` |
| Late employees this month | `status` = 'late', `work_date` range | `idx_attendance_status` + `idx_attendance_work_date` |
| Overtime records for approval | `clock_type` = 'overtime', `overtime_approved` = false | `idx_attendance_clock_type` |
| Employee attendance summary | `employee_id`, `status`, date range | `idx_attendance_emp_status_date` |

### performance_review query patterns

| Pattern | Columns Filtered | Index Used |
|---------|-----------------|------------|
| Reviews for an employee | `employee_id` | `idx_perf_employee` |
| Reviews in a period | `review_period` | `idx_perf_period` |
| Pending reviews for a department | `status`, period, dept via employee join | `idx_perf_status` + `idx_perf_period_status` |
| Find reviews by a specific reviewer | `reviewer_id` | `idx_perf_reviewer` |
| Employee's completed reviews | `employee_id`, `status` | `idx_perf_emp_status` |
| Unique constraint enforcement | `employee_id`, `review_period` | `idx_perf_emp_period` |

---

## 8. Index Size Estimates

Assumptions: ~60 employees, ~30 attendance records/employee/year, ~4 reviews/employee/year

### attendance_record
- Main table: ~80 rows/month, ~1000 rows/year
- Each index: ~40 KB (8 KB/page * ~5 pages at B-tree fill factor)
- Total index overhead: ~320 KB (negligible)

### performance_review
- Main table: ~240 rows/year (60 employees * 4 reviews)
- Each index: ~24 KB
- Total index overhead: ~168 KB (negligible)

### Missing indexes on existing tables
- `employee_job_history`: ~60-200 rows; indexes ~24 KB each
- `audit_log`: ~500-2000 rows/year; indexes ~40 KB each
- Others: proportionally small

**Total additional storage**: < 2 MB. The indexes are designed for query performance, not storage efficiency.

---

## 9. Upgrade Path from V8

```plaintext
V8 (baseline tables)
  |
  v
V9 (this migration):
  1. ALTER attendance_record -- add work_date, late_minutes, early_leave_minutes,
     overtime_approved, approver_employee_id, approved_at, remarks
  2. ADD constraints -- UNIQUE (employee_id, work_date), CHECK for status/clock_out
  3. ADD indexes -- 5 new indexes
  4. ALTER performance_review -- add 4 sub-score columns, two comment columns
  5. ADD constraints -- UNIQUE (employee_id, review_period), CHECK for status/reviewer
  6. ADD indexes -- 4 new indexes
  7. ADD indexes to existing tables -- 10 new indexes across 6 tables
  8. INSERT sys_permission -- attendance.manage
  9. INSERT sys_role_permission -- grant attendance.manage to ADMIN, HR, MANAGER
```

---

## 10. ER Relationships (New Tables Only)

```
employee (1) ----< (N) attendance_record
    |                          |
    |                          +-- [FK] approver_employee_id -> employee (self-ref)
    |
    +-- (1) ----< (N) performance_review (as employee_id)
    |
    +-- (1) ----< (N) performance_review (as reviewer_id)
```

Both tables reference `employee` with foreign keys. `performance_review` has a self-referencing pattern where both the reviewed employee and the reviewer are employees. `attendance_record` has an optional self-reference for overtime approver.
