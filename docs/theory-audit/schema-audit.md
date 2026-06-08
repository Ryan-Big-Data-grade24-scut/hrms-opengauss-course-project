# HRMS Database Schema Audit

> **Auditor:** Database Theory Analysis
> **Date:** 2026-06-06
> **Scope:** V1 (baseline) through V11 (fix approval schema), plus ER theory document cross-reference
> **Source files:**
> - `DB/sql/migrations/V1__baseline.sql` through `V11__fix_approval_schema.sql`
> - `hrms-design/theory/02-data-model-er.md`

---

## 1. Normalization Analysis

### 1.1 First Normal Form (1NF)

**Requirement:** Each cell must contain a single atomic value; no repeating groups or arrays.

**Assessment: PASS**

- Every table has a defined primary key (BIGSERIAL or composite).
- All columns store scalar values: VARCHAR, INTEGER, DECIMAL, DATE, TIMESTAMP, BOOLEAN, TEXT.
- The `payload TEXT` column in `approval_request` stores JSON as a single opaque text value -- from the relational perspective this is an atomic (though serialized) value, acceptable in modern RDBMS practice.
- Many-to-many relationships are correctly decomposed into junction tables (`employee_skill`, `position_required_skill`, `project_tech_stack`, `sys_user_role`, `sys_role_permission`), eliminating any repeating groups.
- The `attrition_history` table stores sub-risk scores as individual DECIMAL columns rather than an array, avoiding non-atomic grouping.

**Minor concern:** `approval_request.payload` (TEXT storing JSON) introduces a semantic dependency at the application layer -- the DB cannot enforce structure on this column. Acceptable for a workflow payload, but worth noting as a departure from strict 1NF principles.

---

### 1.2 Second Normal Form (2NF)

**Requirement:** 1NF + every non-key column must be fully functionally dependent on the **entire** primary key (no partial dependencies).

**Assessment: PASS**

- Most tables use single-column surrogate primary keys (BIGSERIAL). With a single-column PK, partial dependency is structurally impossible.
- Composite-key tables:
  - `sys_user_role` (PK: user_id, role_id) -- zero non-key columns; no partial dependency concern.
  - `sys_role_permission` (PK: role_id, permission_id) -- same; no non-key columns.
  - `employee_skill` uses a surrogate PK (`employee_skill_id`), with UNIQUE on `(employee_id, skill_id, acquired_from)`. All non-key columns (`proficiency_level`, `is_core`, `acquired_date`, etc.) depend on the full natural key -- a skill's proficiency level belongs to the combination of employee + skill + acquisition source. Correct.
  - `position_required_skill` uses a surrogate PK with UNIQUE `(position_id, skill_id)`. All non-key columns (`required_level`, `importance_weight`) depend on the full position-skill pair. Correct.
  - `project_tech_stack` uses a surrogate PK with UNIQUE `(project_id, skill_id)`. No non-key columns. Correct.

---

### 1.3 Third Normal Form (3NF)

**Requirement:** 2NF + no transitive dependencies (non-key column must not depend on another non-key column).

**Assessment: PASS (with intentional denormalization in two locations)**

**Clean transitive dependency design:**

- `employee.department_id` is a FK to `department` -- department name/manager are accessed via join, not stored on employee. No transitivity.
- `employee.position_id` is a FK to `position` -- position details are accessed via join. No transitivity.
- `employee_skill.skill_id` is a FK to `skill` -- skill metadata is accessed via join.
- `department.parent_department_id` is a self-referencing FK -- hierarchical data stored correctly with join-based access.

**Intentional denormalizations (NOT 3NF violations):**

1. **`attrition_history` raw-input snapshots:** The table stores `tenure`, `engagement_score`, `last_promotion_months`, `manager_changes`, `overtime_count` as historical copies alongside `risk_score`. At first glance this looks like a transitive dependency (`employee_id` -> employee table -> these values), but these are **time-point snapshots** preserving the state at `snapshot_date`. By definition, a historical record should not be derivable from current data (the current values may have changed). This is the correct historical-snapshot pattern, not a 3NF violation.

2. **`employee` stores both `department_id` and `position_id`:** The `position` table also has a `department_id` (the department that owns the position). Storing `department_id` directly on `employee` creates a potential transitive path: `employee -> position -> department`. However, an employee's reporting department can differ from a position's owning department (e.g., an engineer on loan to marketing). The direct `employee.department_id` represents organizational assignment, which is a distinct business concept from position ownership. This is intentional non-redundant modeling, not a 3NF violation.

**Potential concern -- `leave_request` legacy column:**

- `leave_request.leave_type` (VARCHAR(30)) is duplicated alongside `leave_request.leave_type_id` (FK to `leave_type`). The V4 migration backfills `leave_type_id` from `leave_type` but does NOT drop the original `leave_type` column. This creates redundant data -- `leave_type` value is now transitively derivable via `leave_type_id -> leave_type.leave_code`. This is a **minor 3NF violation** (a transitive dependency from a non-key column through another non-key column) and a **data-synchronization risk** if both are updated independently. The migration should have dropped `leave_request.leave_type` after the backfill.

---

### 1.4 Boyce-Codd Normal Form (BCNF)

**Requirement:** Every determinant must be a candidate key. (For every non-trivial FD X -> Y, X must be a superkey.)

**Assessment: PASS**

- All tables use surrogate BIGSERIAL primary keys as superkeys -- every attribute is functionally determined by the surrogate PK.
- When composite UNIQUE constraints define alternate keys (e.g., `(employee_id, skill_id, acquired_from)` on `employee_skill`), all non-key attributes are determined by this alternate key. There are no overlapping candidate keys that could cause a BCNF violation.
- The `approval_config` table has UNIQUE `(action_code, step_order)`. The surrogate PK `config_id` and the composite unique constraint are both candidate keys, and all non-key columns depend on both -- no BCNF violation.
- The leave_request `leave_type` / `leave_type_id` redundancy flagged under 3NF does not create a BCNF issue because both columns depend on the PK `leave_id`.

---

### 1.5 Normalization Summary

| Normal Form | Status | Notes |
|---|---|---|
| 1NF | PASS | All cells scalar; M:N decomposed into junction tables |
| 2NF | PASS | Surrogate PKs avoid partial dependencies by construction |
| 3NF | PASS (minor finding) | `leave_request.leave_type` column is redundant after V4 migration; should be dropped |
| BCNF | PASS | No overlapping candidate keys that violate BCNF |

---

## 2. Primary Keys, Foreign Keys, and Constraints

### 2.1 Primary Keys

| Table | PK Type | Assessment |
|---|---|---|
| All entity tables | BIGSERIAL surrogate PK | Consistent with standard practice |
| `employee_profile` | BIGINT PK = FK to `employee` | Correct 1:1 mapping (PK doubles as FK) |
| `sys_user_role` | Composite (user_id, role_id) | Correct junction table design |
| `sys_role_permission` | Composite (role_id, permission_id) | Correct junction table design |

**Finding:** All 20+ tables have explicit PRIMARY KEY constraints. No table is missing a PK. **Rating: EXCELLENT.**

### 2.2 Foreign Keys

**Declared FKs found (comprehensive):**

| Source Table | FK Column(s) | Referenced Table |
|---|---|---|
| `employee` | `department_id` | `department` |
| `employee` | `position_id` | `position` |
| `employee_skill` | `employee_id` | `employee` (CASCADE) |
| `employee_skill` | `skill_id` | `skill` |
| `employee_skill` | `confirmed_by` | `sys_user` |
| `position_required_skill` | `position_id` | `position` (CASCADE) |
| `position_required_skill` | `skill_id` | `skill` |
| `employee_project` | `employee_id` | `employee` (CASCADE) |
| `project_tech_stack` | `project_id` | `employee_project` (CASCADE) |
| `project_tech_stack` | `skill_id` | `skill` |
| `attrition_history` | `employee_id` | `employee` (CASCADE) |
| `attendance_record` | `employee_id` | `employee` (CASCADE) |
| `attendance_record` | `approver_employee_id` | `employee` |
| `performance_review` | `employee_id` | `employee` (CASCADE) |
| `performance_review` | `reviewer_id` | `employee` |
| `approval_request` | `applicant_id` | `employee` |
| `approval_request` | `action_code` | `approval_action_type` |
| `approval_step` | `request_id` | `approval_request` |
| `approval_step` | `reviewer_id` | `employee` |
| `approval_config` | `action_code` | `approval_action_type` |
| `employee_job_history` | `employee_id` | `employee` (CASCADE) |
| `employee_job_history` | `department_id` | `department` |
| `employee_job_history` | `position_id` | `position` |
| `employee_job_history` | `job_id` | `job` |
| `leave_request` | `employee_id` | `employee` (CASCADE) |
| `leave_request` | `leave_type_id` | `leave_type` |
| `leave_request` | `approver_user_id` | `sys_user` |
| `skill` | `category_id` | `skill_category` |
| `skill` | `skill_group_id` | `skill` (self-ref) |
| `skill_category` | `parent_category_id` | `skill_category` (self-ref) |
| `department` | `parent_department_id` | `department` (self-ref) |
| `department` | `location_id` | `location` |
| `position` | `job_id` | `job` |
| `position` | `department_id` | `department` |
| `sys_user_role` | `user_id` | `sys_user` (CASCADE) |
| `sys_user_role` | `role_id` | `sys_role` (CASCADE) |
| `sys_role_permission` | `role_id` | `sys_role` (CASCADE) |
| `sys_role_permission` | `permission_id` | `sys_permission` (CASCADE) |
| `employee_profile` | `employee_id` | `employee` (CASCADE) |

**Missing FKs (defects):**

1. **`employee.manager_employee_id`** is `BIGINT` (V3) but has **no FOREIGN KEY constraint** to `employee(employee_id)`. This self-referencing manager relationship has no referential integrity enforcement. A manager_employee_id could reference a non-existent employee.

2. **`department.manager_employee_id`** is `BIGINT` (V2) but has **no FOREIGN KEY constraint** to `employee(employee_id)`. The department manager could reference a deleted or non-existent employee.

3. **`employee_job_history.manager_employee_id`** is `BIGINT` but has **no FOREIGN KEY constraint**. Same issue.

### 2.3 CHECK Constraints

| Table | Constraint | Purpose |
|---|---|---|
| `employee_skill` | `proficiency_level BETWEEN 0 AND 5` | Valid skill level range |
| `position_required_skill` | `required_level BETWEEN 1 AND 5` | Valid requirement level |
| `position_required_skill` | `importance_weight BETWEEN 1 AND 3` | Valid importance weight |
| `performance_review` | `rating BETWEEN 1 AND 5` | Valid rating range |
| `performance_review` | `score IS NULL OR (score BETWEEN 0 AND 100)` | Valid score range |
| `performance_review` | `status IN ('draft','submitted','acknowledged')` | State machine |
| `performance_review` | `reviewer_id != employee_id` | Prevents self-review |
| `attendance_record` | `status IN ('present','late','absent','half-day','overtime')` | Valid status values |
| `attendance_record` | `clock_out IS NULL OR clock_out > clock_in` | Time ordering |
| `attendance_record` | `late_minutes >= 0` | Non-negative |
| `attendance_record` | `early_leave_minutes >= 0` | Non-negative |
| `attendance_record` | UNIQUE (employee_id, work_date) | One record per day |
| `approval_request` | `status IN ('pending','approved','rejected','cancelled','recalled')` | State machine (V11 fix) |
| `approval_step` | `status IN ('pending','approved','rejected','cancelled')` | State machine |

**Missing CHECK constraints:**

1. **`leave_request.approval_status`** is `VARCHAR(30)` with no CHECK constraint. The application layer enforces values like `'pending'`, `'approved'`, `'rejected'`, but there is no database-level validation. Risk of data corruption from application bugs.

2. **`attrition_history.risk_level`** is `VARCHAR(20)` with no CHECK constraint. Expected values are `'low'`, `'medium'`, `'high'`, `'critical'`, but the database does not enforce this.

3. **`employee.employment_status`** is `VARCHAR(30)` with no CHECK constraint. Expected values include `'active'` and `'resigned'`, but not enforced.

4. **`employee.gender`** is `CHAR(1)` with no CHECK constraint. Expected values are `'M'` and `'F'`, but not enforced. Should add `CHECK (gender IN ('M', 'F'))`.

5. **`leave_type.requires_approval`** and `leave_type.status` are `SMALLINT` with no CHECK constraint to restrict to 0/1 values.

6. **`attendance_record.clock_type`** and `attendance_record.source` are `VARCHAR` without CHECK constraints.

### 2.4 UNIQUE Constraints

- Correctly applied on business keys: `employee_no`, `department_code`, `position_code`, `location_code`, `skill_name`, `category_name`, `action_code`, `leave_code`, `username`, `role_code`, `permission_code`.
- Correctly applied on functional unique pairs: `(employee_id, skill_id, acquired_from)`, `(position_id, skill_id)`, `(project_id, skill_id)`, `(employee_id, project_name)`, `(action_code, step_order)`.
- Correctly applied on temporal unique pairs: `(employee_id, work_date)`, `(employee_id, review_period)`.
- **No missing UNIQUE constraints identified.**

### 2.5 Index Coverage Assessment

The schema is well-indexed with appropriate coverage:

**Core lookup indexes:**
- Employee: department, position, hire_date, status, manager -- all covered
- Attendance: employee, date, status, clock_type, 3 composite indexes -- comprehensive
- Performance: employee, period, status, reviewer, 4 composite indexes -- comprehensive
- Skill: employee_skill (employee, skill, level), skill category, skill group -- comprehensive
- Audit: created_at, username, target_type+target_id, action_type -- comprehensive
- Leave: employee, status, leave_type_id, approver, 3 composite indexes -- comprehensive
- Job history: employee, department, position, job, active range composite -- comprehensive
- Department hierarchy: parent_department_id -- covered (V9)
- Position: department+job composite -- covered (V9)

**Rating: EXCELLENT.** The V9 migration specifically addressed missing indexes. One minor observation: `approval_request` has indexes on `applicant_id` and `status` but not on `action_code` -- if filtering by action type is common, an index on `action_code` would help.

---

## 3. Three-Schema Architecture Assessment

The ANSI-SPARC three-schema architecture defines three levels:

### 3.1 Conceptual Schema (Logical Level)

**Assessment: STRONG**

The logical schema is comprehensively defined in the migration files:

- All entities are represented as CREATE TABLE statements with explicit column definitions, data types, and nullability.
- Relationships are modeled through FOREIGN KEY constraints.
- Business rules are enforced through CHECK constraints.
- The schema is versioned and incremental (11+ migrations), reflecting an evolution-aware design process.

The conceptual schema is well-documented and architecturally sound.

### 3.2 External Schema (View Level)

**Assessment: WEAK -- CRITICAL GAP**

**No database views (CREATE VIEW) are defined in any migration.** The schema lacks:

- User-specific views that expose only authorized columns/rows.
- Aggregated reporting views (e.g., department-level attendance summaries, performance averages).
- Role-specific projections (e.g., a `self_service_view` for EMPLOYEE role vs. `hr_dashboard_view` for HR role).
- Redacted/sanitized views (e.g., employee list without salary/ID card data for general access).

The external schema is entirely implemented at the **application layer** (Python service code). The database itself provides no abstraction between the logical schema and the end-user data presentation.

**Impact:**
- Any application bug can expose raw table data.
- Adding a new client (mobile app, reporting tool) requires duplicating filtering logic.
- Auditing what data each user role can see requires reading Python code, not querying the database catalog.

### 3.3 Internal Schema (Physical Level)

**Assessment: SATISFACTORY**

- **Indexes:** Well-planned with 30+ indexes across the schema, including composite indexes for common query patterns.
- **Computed columns:** `attrition_history.risk_score_pct` uses `GENERATED ALWAYS AS (...)` STORED -- good use of computed columns for performance.
- **Missing physical design elements:**
  - No partitioning strategy (no table partitioning by date, department, or region).
  - No tablespace definitions or storage parameter tuning.
  - No materialized views for pre-computed analytics.
  - No CLUSTER or index ordering hints.
- The schema would benefit from partitioning on `attendance_record(work_date)` and `attrition_history(snapshot_date)` for time-series scalability.

### 3.4 Three-Schema Architecture Summary

| Level | Current State | Recommendation |
|---|---|---|
| Conceptual | Strong -- well-defined DDL with constraints | Maintain current practice |
| External | **Missing** -- no views defined | Create role-specific views for access control; create aggregate reporting views |
| Internal | Adequate -- good indexes, no partitioning | Consider range partitioning on time-series tables |

---

## 4. Views for Access Control

**Finding: Views are NOT used for access control.**

The schema implements access control entirely through application-level RBAC:

```
sys_user --< sys_user_role >-- sys_role --< sys_role_permission >-- sys_permission
```

The application reads these tables and filters queries programmatically. No database-level access control objects (views, row-level security policies) are created.

**Current approach -- Application-Layer RBAC:**
- Permission codes like `attendance.view`, `performance.view`, `team.view` are checked in Python before returning data.
- CEO role receives all permissions via a `CROSS JOIN` in V8.
- ADMIN, HR, MANAGER, EMPLOYEE roles receive granular permissions.
- This is a **Role-Based Access Control (RBAC)** implementation, which is a form of DAC.

**Why this is problematic (from a database theory perspective):**

1. **Security bypass risk:** Any direct database connection (ad-hoc queries, backup restoration, ETL tools) bypasses the application access control logic entirely.
2. **No defense in depth:** Database views would provide a second layer of protection.
3. **Audit opacity:** It is impossible to determine "who can see what" by inspecting the database schema alone -- you must analyze the Python service code.

**Recommended improvement:**

Create database views for each role:

```sql
-- Example (not implemented in current schema):
CREATE VIEW employee_self_service AS
SELECT employee_id, full_name, email, phone, department_id, position_id
FROM employee;

CREATE VIEW hr_employee_view AS
SELECT e.*, d.department_name, p.position_name
FROM employee e
JOIN department d USING (department_id)
JOIN position p USING (position_id);

CREATE VIEW manager_team_view AS
SELECT e.*
FROM employee e
JOIN employee m ON e.manager_employee_id = m.employee_id
WHERE m.employee_id = current_setting('app.current_employee_id')::BIGINT;
```

Alternatively, use PostgreSQL/openGauss **Row-Level Security (RLS)** policies for fine-grained row access. The current schema has no RLS policies defined.

---

## 5. Security Model Analysis

### 5.1 Model Classification: Role-Based Access Control (RBAC) / Discretionary Access Control (DAC)

The current schema implements **RBAC**, which is a well-known variant of **DAC** (Discretionary Access Control):

| Characteristic | Current Implementation | DAC | MAC |
|---|---|---|---|
| Permission assignment | Admin assigns permissions to roles | Yes (by owner/admin) | No (system-enforced) |
| User classification | By role membership | Discretionary | Mandatory labels/clearances |
| Data classification | None | Not required | Required (security labels) |
| Override by user | Possible (admin can reassign) | Yes | No |
| Policy enforcement | Application layer | BY application | BY database/system |

**The system is DAC/RBAC, NOT MAC.**

### 5.2 RBAC Implementation Details

**Role Hierarchy:**

| Role Code | Role Name | Scope |
|---|---|---|
| `CEO` | CEO/管理员 | All permissions (CROSS JOIN in V8) |
| `ADMIN` | 系统管理员 | Full CRUD on users, employees, departments, plus all module permissions |
| `HR` | HR管理员 | Employee, department, position, leave management; attendance.manage |
| `MANAGER` | 部门经理 | Team-scoped: skill.manage, analytics.view, attendance.view, performance.view, team.view, attendance.manage |
| `EMPLOYEE` | 普通员工 | Self-service: leave management |

**Permission Granularity:**

The 10+ permission codes (`user.manage`, `employee.manage`, `department.manage`, `leave.manage`, `audit.view`, `skill.manage`, `analytics.view`, `attendance.view`, `attendance.manage`, `performance.view`, `performance.manage`, `team.view`) represent **operation-level** (not row-level) permissions. Row-level filtering (e.g., "manager can only see their direct reports") is handled at the application layer.

### 5.3 Security Strengths

1. **Password hashing:** `password_hash VARCHAR(255)` -- column type suggests proper hashing is used (not plaintext).
2. **No plaintext sensitive data:** No credit card numbers, tax IDs, or other PII are stored in plaintext beyond `id_card_no` (Chinese ID number), which is a concern.
3. **Role separation:** Clear separation of duties between ADMIN, HR, MANAGER, and EMPLOYEE roles.
4. **Audit logging:** `audit_log` table tracks user actions with timestamp, action type, target, and detail.

### 5.4 Security Weaknesses

1. **`id_card_no` in `employee` table is stored in plaintext.** Chinese ID numbers are highly sensitive PII. This should be encrypted at rest or stored as a hash.
2. **No column-level encryption** for any sensitive fields (phone, email, personal_email, emergency contact info).
3. **No row-level security (RLS)** -- all security is application-layer.
4. **`audit_log.target_id` is VARCHAR(50)** -- mixed data type, cannot use FK. The polymorphic reference pattern is inherently insecure because referential integrity is unenforceable.
5. **Seed passwords are demo hashes.** Production should use proper password hashing (bcrypt/argon2).

### 5.5 Security Model vs. Multi-Level Security Requirements

For a system that handles employee PII, a **MAC** model would enforce:

- **Confidentiality level labels** on data rows (e.g., PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED).
- **Clearance levels** on user roles.
- **Mandatory enforcement** at the database level (not bypassable by application).

The current schema does NOT support MAC. This is acceptable for a standard HRMS but would need enhancement for compliance with:
- **GDPR** (European data protection): Article 25 requires data protection by design -- column-level encryption and access controls.
- **China PIPL** (Personal Information Protection Law): Similar requirements for encryption and access logging of PII.
- **ISO 27001**: Access control policy (A.9) requires formal user access provisioning.

---

## 6. Additional Database Theory Observations

### 6.1 Polymorphic Foreign Key Anti-Pattern

**Tables affected:** `audit_log`, `approval_request`

These tables use a `(target_type, target_id)` or `(target_type, target_id, payload)` pattern where `target_type` is a string identifying the target table and `target_id` is a generic ID. This is the **polymorphic association** pattern, which cannot be enforced with declarative referential integrity in a relational database.

**Risks:**
- `audit_log.target_id` is VARCHAR(50) -- type mismatch with BIGINT PKs of referenced tables.
- `approval_request.target_id` is BIGINT but `approval_request.target_emp_id` (added in V11) duplicates this.
- An `audit_log` row could reference a non-existent entity without the DB complaining.

**Alternative:** Use separate FK columns per target type (e.g., `leave_id`, `employee_id`, `attendance_id`), or use PostgreSQL inheritance.

### 6.2 Generated Column Usage

`attrition_history.risk_score_pct` uses `GENERATED ALWAYS AS (risk_score * 100) STORED`. This is a well-designed computed column that:
- Eliminates application-side computation redundancy.
- Ensures the percentage is always consistent with the raw score.
- The STORED keyword means it occupies physical storage but avoids re-computation on every read.

**Rating: GOOD PRACTICE.** The schema uses computed columns sparingly and appropriately.

### 6.3 Temporal Data Modeling

The schema handles temporal data in several ways:

| Pattern | Table | Assessment |
|---|---|---|
| Snapshot history | `attrition_history` | Correct -- stores state at snapshot time with raw input copies |
| Job change trail | `employee_job_history` | Correct -- start/end dates for job assignment changes |
| Status timestamps | `performance_review` (submitted_at, acknowledged_at) | Correct -- tracks state transitions |
| Approval audit trail | `approval_step` (created_at, acted_at) | Correct -- immutable log of approval actions |

The temporal modeling is consistent and well-designed.

### 6.4 Self-Referencing Relationships

| Table | Column | Purpose |
|---|---|---|
| `department` | `parent_department_id` | Organizational hierarchy (tree) |
| `skill` | `skill_group_id` | Skill group hierarchy (tree) |
| `skill_category` | `parent_category_id` | Category hierarchy (tree) |
| `employee` | `manager_employee_id` | Reporting structure (tree) |

All self-referencing relationships are modeled as nullable FKs to the same table's PK. This correctly represents tree structures in a relational model. The V9 migration adds the necessary `idx_department_parent` and `idx_skill_category_parent` indexes for recursive CTE performance.

---

## 7. Summary of Findings

### Critical Issues

| # | Severity | Issue | Location | Recommendation |
|---|---|---|---|---|
| 1 | HIGH | No external schema (views) | Entire schema | Create role-specific views for access abstraction |
| 2 | HIGH | Missing FK on `employee.manager_employee_id` | V3 migration | Add `FOREIGN KEY REFERENCES employee(employee_id)` |
| 3 | HIGH | Missing FK on `department.manager_employee_id` | V2 migration | Add `FOREIGN KEY REFERENCES employee(employee_id)` |
| 4 | HIGH | Missing FK on `employee_job_history.manager_employee_id` | V3 migration | Add `FOREIGN KEY REFERENCES employee(employee_id)` |
| 5 | HIGH | `id_card_no` stored in plaintext | V3 migration | Encrypt at rest or hash the column |

### Moderate Issues

| # | Severity | Issue | Location | Recommendation |
|---|---|---|---|---|
| 6 | MEDIUM | No CHECK on `leave_request.approval_status` | V1 migration | Add `CHECK (approval_status IN ('pending','approved','rejected','cancelled'))` |
| 7 | MEDIUM | No CHECK on `attrition_history.risk_level` | V7 migration | Add `CHECK (risk_level IN ('low','medium','high','critical'))` |
| 8 | MEDIUM | No CHECK on `employee.employment_status` | V1 migration | Add `CHECK (employment_status IN ('active','resigned','terminated','on_leave'))` |
| 9 | MEDIUM | No CHECK on `employee.gender` | V1 migration | Add `CHECK (gender IN ('M','F'))` |
| 10 | MEDIUM | `leave_request.leave_type` column redundant after V4 | V1/V4 migrations | Drop `leave_request.leave_type` after verifying `leave_type_id` backfill |
| 11 | MEDIUM | No RLS policies for row-level access control | Whole schema | Consider PostgreSQL RLS for defense-in-depth |
| 12 | MEDIUM | `audit_log.target_id` is VARCHAR(50), should match PK types | V1 migration | Consider using separate FK columns per target type |

### Minor Issues / Observations

| # | Severity | Issue | Location | Recommendation |
|---|---|---|---|---|
| 13 | LOW | No partitioning on time-series tables | V7/V8/V9 | Consider range partitioning on work_date / snapshot_date |
| 14 | LOW | No materialized views for reporting | V8/V9 | Create materialized views for dashboard performance |
| 15 | LOW | `approval_request` lacks index on `action_code` | V10 | Add index if filtering by action type is common |
| 16 | LOW | No CHECK on `leave_type.requires_approval` and `leave_type.status` | V4 | Add `CHECK (column IN (0,1))` |
| 17 | LOW | No CHECK on `attendance_record.clock_type` / `source` | V8 | Add CHECK constraints for enum-like VARCHAR columns |
| 18 | LOW | `approval_request.target_id` and `target_emp_id` may overlap (added in V11) | V10/V11 | Clarify semantic difference or consolidate |
| 19 | LOW | Demo seed data uses generic password hashes | All migrations | Replace with proper bcrypt/argon2 hashes for non-demo environments |

---

## 8. Final Verdict

This is a **well-designed database schema** from a relational theory perspective. It demonstrates strong understanding of:

- Proper normalization (satisfies BCNF)
- Surrogate key strategy
- Comprehensive foreign key coverage (with the 3 noted exceptions)
- Good index planning
- Appropriate use of computed columns and constraints
- Versioned, incremental migration design
- Solid RBAC framework at the application layer

The two most significant gaps are:

1. **Missing external schema (views):** The three-schema architecture is incomplete without database views for access control and data abstraction. The current application-only approach lacks defense-in-depth and audit transparency.

2. **Three missing foreign key constraints:** `employee.manager_employee_id`, `department.manager_employee_id`, and `employee_job_history.manager_employee_id` lack FK declarations, creating potential referential integrity violations.

**Overall Database Theory Grade: B+**
(Strong normalization and conceptual design; needs views for external schema completion and a few FK/CHECK constraints for data integrity hardening.)
