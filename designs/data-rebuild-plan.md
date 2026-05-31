# HRMS Data Rebuild Plan -- Layer 0 (Raw Data)

> Target: V7/V8 schema environment (all tables exist but empty of seed data).
> Author: Data Architecture Agent
> Date: 2026-05-30

---

## 1. Which Tables Need to Be Truncated and Rebuilt?

All tables that carry seed or demo data must be truncated **in FK-safe order** (children before parents), then re-inserted with explicit IDs. The following 24 tables must be rebuilt:

### Truncation Order (leaf-to-root, respecting FK chains)

| Step | Table | FK Dependencies | Reason |
|------|-------|----------------|--------|
| 1 | `attrition_history` | -> employee | Trend snapshots |
| 2 | `attendance_record` | -> employee | Clock data |
| 3 | `performance_review` | -> employee x2 | Reviewer references employee |
| 4 | `project_tech_stack` | -> employee_project, skill | Tech stack per project |
| 5 | `employee_project` | -> employee | Project assignments |
| 6 | `employee_skill` | -> employee, skill | Skill proficiency records |
| 7 | `position_required_skill` | -> position, skill | Job reqs per position |
| 8 | `employee_job_history` | -> employee, dept, position, job | Position change log |
| 9 | `employee_profile` | -> employee | Extended profile |
| 10 | `employee` | -> department, position, self (manager_employee_id) | Core employee data |
| 11 | `leave_request` | -> employee, leave_type, sys_user | Leave records |
| 12 | `position` | -> department, job | Job positions |
| 13 | `skill` | -> skill_category | Individual skills |
| 14 | `skill_category` | (self-referencing) | Skill groups |
| 15 | `job` | (independent) | Job families |
| 16 | `location` | (independent) | Office locations |
| 17 | `department` | (self: parent_department_id) | Org units |
| 18 | `leave_type` | (independent) | Leave categories |
| 19 | `sys_role_permission` | -> sys_role, sys_permission | Role-permission mapping |
| 20 | `sys_user_role` | -> sys_user, sys_role | User-role mapping |
| 21 | `audit_log` | -> sys_user (indirect) | Audit trail |
| 22 | `sys_user` | (independent) | Login accounts |
| 23 | `sys_permission` | (independent) | Permission definitions |
| 24 | `sys_role` | (independent) | Role definitions |

### Tables That Are NOT Truncated (schema-only, no seed data)

- `employee_profile` — truncated as part of step 9 above (children of employee)
- `employee_job_history` — truncated as part of step 8
- No other tables carry pre-existing seed data after the rebuild

---

## 2. Employee ID Sequence: How to Reset It to Start from 1

### The Core Problem

The current V6 migration inserts 60 employees via `BIGSERIAL` auto-increment, but migrations V1 and V5 have already consumed the first ~22 sequence values. The result:

- **V1 baseline**: Inserts 2 employees (E2026001, E2026002) -> sequence advances to 2
- **V5 migration**: Inserts ~20 more employees (loop i=10..30) -> sequence advances to ~22
- **V6 seed**: Inserts 60 employees, but their IDs start at ~23, NOT at 1
- **manager_employee_id** in V6 uses hardcoded numbers (1, 2, 3, ...) intended to match the first 60 employees, but these point to the WRONG records

### Solution: Three-Step Sequence Reset

**Step A** -- After truncation, reset all relevant sequences to 1:

```sql
ALTER SEQUENCE employee_employee_id_seq RESTART WITH 1;
ALTER SEQUENCE department_department_id_seq RESTART WITH 1;
ALTER SEQUENCE position_position_id_seq RESTART WITH 1;
-- ... all other sequences
```

**Step B** -- Insert all data with **explicit primary key values** so FK references are deterministic:

```sql
INSERT INTO employee (employee_id, employee_no, full_name, ...)
VALUES (1, 'NT0001', 'Alex Chen', ...);
-- manager_employee_id = 1 now correctly refers to Alex Chen (ID=1)
```

**Step C** -- After all inserts, advance each sequence past the max used ID:

```sql
SELECT setval('employee_employee_id_seq', (SELECT MAX(employee_id) FROM employee));
```

---

## 3. Manager Employee ID: FK Consistency When Reseeding

### The Five Consistency Rules

1. **CEO reports to NULL** (root of org tree)
2. **Every VP reports to the CEO** (manager_employee_id = CEO's employee_id = 1)
3. **Every manager reports to their VP** (e.g., Engineering Manager -> VP Engineering)
4. **Every IC reports to their direct manager** (e.g., Backend Engineer -> Engineering Manager)
5. **Resigned employees** retain their manager reference from the time they left

### The Org Hierarchy (derived from company_design.md)

```
CEO (1)                                     [dept: Engineering]
├── VP Engineering (2)                      [dept: Engineering]
│   ├── Engineering Manager (3, 4)          [dept: Engineering]
│   │   ├── Senior Backend Eng (5, 6)       [dept: Engineering]
│   │   │   └── Backend Eng (7, 8, 9, 10)  [dept: Engineering]
│   ├── Senior Frontend Eng (11, 12)        [dept: Engineering]
│   │   └── Frontend Eng (13, 14, 15)      [dept: Engineering]
│   ├── DevOps Eng (16, 17, 18)            [dept: Engineering]
│   └── QA Eng (19, 20)                    [dept: Engineering]
├── VP Product (21)                         [dept: Product]
│   ├── Product Manager (22, 23, 24, 25, 26) [dept: Product]
│   ├── UX Designer (27, 28, 29, 30)       [dept: Product]
│   └── Data Analyst (31, 32, 33)          [dept: Product]
├── VP Sales & Marketing (34)               [dept: Sales & Marketing]
│   ├── Sales Rep (35, 36, 37, 38, 39, 40) [dept: Sales & Marketing]
│   ├── Marketing Specialist (41, 42, 43)  [dept: Sales & Marketing]
│   └── Customer Success (44)              [dept: Sales & Marketing]
└── VP Operations (46)                      [dept: Operations]
    ├── HR Specialist (47, 48, 51)         [dept: Operations]
    └── Accountant (49, 50, 52, 53)        [dept: Operations]
```

Note: Employee #45 (Marco Pi, resigned Sales Rep) and #54-60 (resigned employees) exist outside this active tree.

### The Cross-Department Rule

Although the CEO (employee_id=1) sits in Engineering department_id=1, VPs from all departments report to CEO. This is intentional -- the CEO is the company-wide leader. The org tree is built on `manager_employee_id`, not on `department_id`. The `department_id` on an employee defines their **cost-center / functional unit**, while `manager_employee_id` defines their **reporting line**.

---

## 4. Correct Business Logic for Department-Position-Employee Relationship

### Entity Roles

| Entity | Role | Cardinality |
|--------|------|-------------|
| **Department** | Functional unit (cost center, location) | Parent of positions |
| **Position** | Job role within a department (with headcount budget) | Belongs to exactly one department |
| **Employee** | Person holding a position in a department | Has exactly one department + one position |

### Business Rules

1. **A position belongs to exactly one department** -> `position.department_id` is NOT NULL in the rebuild
2. **An employee belongs to exactly one department** -> `employee.department_id` is NOT NULL
3. **An employee holds exactly one position** -> `employee.position_id` is NOT NULL
4. **An employee's department SHOULD match their position's department**, with ONE exception: the CEO position is company-wide (department_id=Engineering for cost purposes), while the CEO manages all departments
5. **Headcount on position is a budget ceiling**, not a DB constraint -- enforced at the application layer
6. **The org hierarchy is built on `employee.manager_employee_id`**, a self-referencing FK

### Position-to-Department Mapping in the Rebuild

| Position ID | Position Name | Department ID | Department Name |
|-------------|---------------|---------------|-----------------|
| 1 | CEO | 1 | Engineering (company-wide) |
| 2 | VP Engineering | 1 | Engineering |
| 3 | Engineering Manager | 1 | Engineering |
| 4 | Senior Backend Engineer | 1 | Engineering |
| 5 | Backend Engineer | 1 | Engineering |
| 6 | Senior Frontend Engineer | 1 | Engineering |
| 7 | Frontend Engineer | 1 | Engineering |
| 8 | DevOps Engineer | 1 | Engineering |
| 9 | QA Engineer | 1 | Engineering |
| 10 | VP Product | 2 | Product |
| 11 | Product Manager | 2 | Product |
| 12 | UX Designer | 2 | Product |
| 13 | Data Analyst | 2 | Product |
| 14 | VP Sales & Marketing | 3 | Sales & Marketing |
| 15 | Sales Representative | 3 | Sales & Marketing |
| 16 | Marketing Specialist | 3 | Sales & Marketing |
| 17 | Customer Success Manager | 3 | Sales & Marketing |
| 18 | VP Operations | 4 | Operations |
| 19 | HR Specialist | 4 | Operations |
| 20 | Accountant | 4 | Operations |

---

## 5. Should Resigned Employees Be Kept?

**YES -- absolutely.** They are critical for two reasons:

### Reason 1: ML Attrition Training

The attrition prediction model (openGauss DB4AI / `attrition_model`) requires a labeled dataset of employees who DID leave (attrition_flag=1) vs. those who stayed (attrition_flag=0). Without the 8 resigned employees, the model has no positive class and cannot train.

### Reason 2: Historical Reporting

Reports like "department turnover rate over time" and "attrition by position" require knowing who left and when.

### How to Mark Them

- `employment_status = 'resigned'` -- primary discriminator
- `attrition_flag = 1` -- ML label
- `manager_employee_id` -- populated with the manager they reported to at the time of leaving
- They are automatically excluded from all active queries in the backend: `WHERE employment_status IN ('active', 'probation')`

### Resigned Employees in This Rebuild

| Employee | Position | Department | Manager (ID) | Tenure | Attrition Flag |
|----------|----------|------------|--------------|--------|----------------|
| Victor Bao (54) | Backend Eng (5) | Engineering | Mike Zhang (3) | 18 | 1 |
| Willa Chu (55) | Product Mgr (11) | Product | Pearl Song (22) | 14 | 1 |
| Xia Dan (56) | Sales Rep (15) | Sales | Cindy Dai (35) | 10 | 1 |
| Yuan Er (57) | Frontend Eng (7) | Engineering | Brian Feng (11) | 6 | 1 |
| Zoe Fang (58) | Accountant (20) | Operations | Quincy Tao (49) | 8 | 1 |
| Bao Gong (59) | Marketing (16) | Sales | Jake Mo (42) | 4 | 1 |
| Chao Han (60) | QA Eng (9) | Engineering | Mia Tan (19) | 3 | 1 |
| Marco Pi (45) | Sales Rep (15) | Sales | Derek Fu (36) | 1 | 1 |

Note: Marco Pi (employee_id=45) was already a resigned employee in the original V6 seed, inserted alongside active employees. In the rebuild, resigned employees are grouped after all active employees for readability, but the IDs are kept contiguous.

---

## 6. New Seed Data for attendance_record and performance_review

### attendance_record

**Volume**: 20 employees x ~22 working days = ~440 rows for May 2026.

**Pattern**: Most employees are present with normal clock-in/out. A subset exhibits late arrivals, overtime, remote work, or absenteeism to create realistic ML training signals.

**Data distribution**:
- 80 % `present`, clock_in ~08:45-09:15, clock_out ~17:45-18:15
- 10 % `late`, clock_in 09:30-10:30
- 5 % `absent` (no clock_in recorded)
- 5 % `half-day` (clock_out before 13:00)
- 5 % `overtime` (clock_out after 19:00 or clock_type='overtime')

**Employees with abnormal patterns** (to match attrition risk profiles):
- Uma Zeng (53): high absenteeism + frequent lateness
- Kevin He (17): excessive overtime
- David Huang (9): frequent half-days
- Jack Yang (7): chronic lateness

### performance_review

**Volume**: 52 rows (one per active/probation employee) for 2026-Q1.

**Data design**:
- Reviewer = the employee's manager (manager_employee_id)
- Rating and score are correlated with engagement_score:
  - engagement_score >= 85 -> rating 4-5, score 80-95
  - engagement_score 70-84 -> rating 3-4, score 65-82
  - engagement_score < 70 -> rating 2-3, score 45-60
- Strengths, improvements, goals: realistic HR text in Chinese/English
- Status: 'submitted' for most, 'acknowledged' for a few (employee confirmed receipt)

### Attrition History Seed (for trend chart)

**Volume**: 52 active employees x 6 monthly snapshots = 312 rows.

**Design**: Each employee gets a 6-month back-history of monthly risk scores. The risk score for each month is computed using the employee's current data + a small random variance (-5% to +5%) to simulate trend data. This powers the "risk trend over time" chart in the analytics page.

---

## 7. Dependency Resolution Strategy

### Self-Referencing Tables

Three tables have self-referencing FKs that must be handled carefully:

1. **department** (`parent_department_id` -> `department.department_id`)
   - Solution: Insert root departments (no parent) first, then child departments in separate statements

2. **employee** (`manager_employee_id` -> `employee.employee_id`)
   - Solution: Insert CEO first (manager_employee_id=NULL), then all employees in manager-first order within a DO block. This is the most complex part -- use a single DO block with RETURNING to capture IDs.

3. **skill_category** (`parent_category_id` -> `skill_category.category_id`)
   - Solution: Categories in the seed have no parent categories; insert in one batch.

### Cross-Table FK Order

The critical ordering constraint is:
```
sys_role -> sys_permission -> sys_role_permission
sys_user -> sys_user_role -> sys_role_permission
location -> department -> position -> employee -> employee_skill -> ...
skill_category -> skill -> employee_skill, position_required_skill
```

The SQL follows this order precisely.

---

## 8. Error Handling and Idempotency

The rebuild SQL is **NOT idempotent** by design -- it TRUNCATEs all data and re-inserts. Running it twice will succeed because the first run populates data, and the second run TRUNCATES before inserting again.

For production safety, the SQL wraps all truncation in a single transaction with `TRUNCATE ... CASCADE` to handle FK chains atomically.

---

## 9. Validation Checklist

After running the rebuild SQL, verify:

- [ ] Sequence `employee_employee_id_seq` starts at 61 (max employee_id + 1)
- [ ] Sequence `department_department_id_seq` starts at 5
- [ ] Sequence `position_position_id_seq` starts at 21
- [ ] Every `manager_employee_id` points to an existing employee
- [ ] Every `department_id` on employee matches the position's `department_id`
- [ ] `COUNT(*) WHERE employment_status IN ('active', 'probation')` = 52
- [ ] `COUNT(*) WHERE employment_status = 'resigned'` = 8
- [ ] `COUNT(*) WHERE attrition_flag = 1` = 8
- [ ] `attendance_record` has ~440 rows, all with valid employee_id
- [ ] `performance_review` has 52 rows, all with valid employee_id and reviewer_id
- [ ] `attrition_history` has ~312 rows (52 employees x 6 months)
- [ ] CEO (Alex Chen) has `manager_employee_id IS NULL`
- [ ] All 9 sys_user accounts can log in with password '123456'
