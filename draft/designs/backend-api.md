# Backend API Design — NovaTech HRMS

> Revision: 1.0
> Layer: 2 (Backend)
> Status: Design

---

## Table of Contents

1. [org_hierarchy(): Fix Using position.department_id](#1-org_hierarchy-fix-using-positiondepartment_id)
2. [directory_search(): Performance & Indexes](#2-directory_search-performance--indexes)
3. [Permission Scope: Extend _require_permission()](#3-permission-scope-extend-_require_permission)
4. [Missing API Endpoints](#4-missing-api-endpoints)
5. [Route Parameter Mismatches](#5-route-parameter-mismatches)
6. [Complete Endpoint Inventory](#6-complete-endpoint-inventory)

---

## 1. org_hierarchy(): Fix Using position.department_id

### Problem

The current `org_hierarchy()` SQL in `E:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/services/org_service.py` builds the org tree by grouping employees by `employee.department_id`, then joining `position` as a subordinate label. It does NOT use `position.department_id` as the grouping dimension.

This creates two structural issues:

1. **Orphan positions**: If a position has `department_id = 2` but all employees assigned to it are in `department_id = 1` (e.g., a Data Analyst position belonging to Product department but an employee is temporarily reassigned), the position appears under the wrong department.

2. **Empty positions collapse**: Positions with `headcount > 0` but zero active employees vanish from the tree entirely because the CTE starts from `employee`. The org chart should show the position scaffold regardless of headcount.

### Schema Confirmation

From `E:/Ufolder/Current/ActionSys/Hgclass/DB/sql/migrations/V2__org_and_job.sql` (lines 83-86):

```sql
ALTER TABLE position ADD COLUMN department_id BIGINT REFERENCES department(department_id);
```

The `position.department_id` column exists. The `list_positions()` service already joins it:

```python
LEFT JOIN department d ON d.department_id = p.department_id
```

### Correct SQL

The corrected `org_hierarchy()` must pivot to use `position.department_id` as the authoritative grouping dimension. The structure becomes:

```
Department
  +-- Position (belongs to department via position.department_id)
       +-- Employee (assigned to position via employee.position_id)
```

Key changes:
- Anchor on `position` table, not `employee`
- Group positions by `position.department_id`
- Left-join employees so positions with zero staff still appear
- Retain all existing computed fields (top_skills, required_skills, match_pct)

```sql
WITH
-- Department head: most senior employee per department (lowest position_id)
dept_head AS (
    SELECT department_id, full_name AS manager_name
    FROM (
        SELECT department_id, full_name,
               ROW_NUMBER() OVER (
                   PARTITION BY department_id ORDER BY position_id
               ) AS rn
        FROM employee
        WHERE employment_status IN ('active', 'probation')
    ) t
    WHERE rn = 1
),
-- Top 5 most common skills per department (by frequency count)
dept_top_skills AS (
    SELECT department_id,
           json_agg(skill_name ORDER BY cnt DESC) AS top_skills
    FROM (
        SELECT e.department_id, s.skill_name,
               COUNT(*) AS cnt,
               ROW_NUMBER() OVER (
                   PARTITION BY e.department_id ORDER BY COUNT(*) DESC
               ) AS rn
        FROM employee e
        JOIN employee_skill es ON es.employee_id = e.employee_id
        JOIN skill s ON s.skill_id = es.skill_id
        WHERE e.employment_status IN ('active', 'probation')
        GROUP BY e.department_id, s.skill_name
    ) t
    WHERE rn <= 5
    GROUP BY department_id
),
-- Required skills per position (from position_required_skill)
pos_required_skills AS (
    SELECT prs.position_id,
           json_agg(
               json_build_object(
                   'skill_name', s.skill_name,
                   'required_level', prs.required_level,
                   'importance_weight', prs.importance_weight
               )
               ORDER BY prs.importance_weight DESC, prs.required_level DESC
           ) AS required_skills
    FROM position_required_skill prs
    JOIN skill s ON s.skill_id = prs.skill_id
    GROUP BY prs.position_id
),
-- Employee-level data: skills array + match percentage vs their position
employee_data AS (
    SELECT
        e.employee_id,
        e.employee_no,
        e.full_name,
        e.gender,
        e.employment_status,
        e.hire_date,
        e.position_id,  -- grouping by position, not department
        e.manager_employee_id,
        COALESCE(
            json_agg(
                json_build_object(
                    'skill_name', s.skill_name,
                    'proficiency_level', es.proficiency_level,
                    'category_name', sc.category_name
                )
                ORDER BY es.proficiency_level DESC
            ) FILTER (WHERE es.skill_id IS NOT NULL),
            '[]'::json
        ) AS skills,
        ROUND(
            SUM(
                COALESCE(prs.importance_weight, 0)
                * LEAST(
                    COALESCE(es.proficiency_level, 0),
                    COALESCE(prs.required_level, 0)
                )
            )::decimal
            / NULLIF(
                SUM(
                    COALESCE(prs.importance_weight, 0)
                    * COALESCE(prs.required_level, 0)
                ),
                0
            )
            * 100,
            1
        ) AS match_pct
    FROM employee e
    LEFT JOIN employee_skill es ON es.employee_id = e.employee_id
    LEFT JOIN skill s ON s.skill_id = es.skill_id
    LEFT JOIN skill_category sc ON sc.category_id = s.category_id
    LEFT JOIN position_required_skill prs
        ON prs.position_id = e.position_id
        AND prs.skill_id = es.skill_id
    WHERE e.employment_status IN ('active', 'probation')
    GROUP BY e.employee_id, e.employee_no, e.full_name, e.gender,
             e.employment_status, e.hire_date, e.position_id,
             e.manager_employee_id
),
-- Position-level aggregation (anchored on position.department_id)
position_agg AS (
    SELECT
        p.department_id,
        p.position_id,
        p.position_name,
        p.headcount,
        COUNT(ed.employee_id) AS employee_count,
        COALESCE(
            json_agg(
                json_build_object(
                    'employee_id', ed.employee_id,
                    'employee_no', ed.employee_no,
                    'full_name', ed.full_name,
                    'gender', ed.gender,
                    'employment_status', ed.employment_status,
                    'hire_date', ed.hire_date,
                    'skills', COALESCE(ed.skills, '[]'::json),
                    'match_pct', ed.match_pct
                )
                ORDER BY ed.full_name
            ) FILTER (WHERE ed.employee_id IS NOT NULL),
            '[]'::json
        ) AS employees
    FROM position p
    LEFT JOIN employee_data ed ON ed.position_id = p.position_id
    WHERE p.status = 1
    GROUP BY p.department_id, p.position_id, p.position_name, p.headcount
)
-- Final department-level select
SELECT
    d.department_id,
    d.department_name,
    dh.manager_name AS department_manager,
    COALESCE(dts.top_skills, '[]'::json) AS top_skills,
    (
        SELECT COUNT(*)
        FROM employee e2
        WHERE e2.department_id = d.department_id
          AND e2.employment_status IN ('active', 'probation')
    ) AS headcount,
    COALESCE(
        json_agg(
            json_build_object(
                'position_id', pa.position_id,
                'position_name', pa.position_name,
                'employee_count', pa.employee_count,
                'headcount', pa.headcount,
                'required_skills',
                COALESCE(prs.required_skills, '[]'::json),
                'employees', pa.employees
            )
            ORDER BY pa.position_name
        ) FILTER (WHERE pa.position_id IS NOT NULL),
        '[]'::json
    ) AS positions
FROM department d
LEFT JOIN dept_head dh ON dh.department_id = d.department_id
LEFT JOIN dept_top_skills dts ON dts.department_id = d.department_id
LEFT JOIN position_agg pa ON pa.department_id = d.department_id
LEFT JOIN pos_required_skills prs ON prs.position_id = pa.position_id
GROUP BY d.department_id, d.department_name, dh.manager_name, dts.top_skills
ORDER BY d.department_name
```

### Migration Impact

- No schema changes needed. `position.department_id` already exists.
- The `/api/org/hierarchy` endpoint now returns positions even when zero employees occupy them.
- The `headcount` field vs `employee_count` field lets the frontend show vacancy gaps.

---

## 2. directory_search(): Performance & Indexes

### Problem

Current `directory_search()` in `E:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/services/directory_service.py` (lines 194-230):

```python
like_pattern = f"'%' || {sql_literal(keyword)} || '%'"
# ...
WHERE e.employment_status IN ('active', 'probation')
  AND (
       e.full_name ILIKE {like_pattern}
       OR e.employee_no ILIKE {like_pattern}
       ...
  )
```

This uses leading-wildcard `ILIKE` (`'%keyword%'`), which **cannot use B-tree indexes**. Every search triggers a sequential scan across five joined tables.

### Performance Strategy

**Strategy: GIN trigram indexes (openGauss compatible)**

openGauss supports `pg_trgm` extension (trigram) for GIN-indexed fuzzy text search. Trigram indexes convert text into 3-character chunks and index them, enabling fast `ILIKE '%keyword%'` lookups.

For deployments where trigram is unavailable, fall back to case-insensitive `LIKE` with the same index type.

### Index SQL

```sql
-- =====================================================
-- Migration: V9__directory_search_indexes.sql
-- =====================================================

-- 1. Enable pg_trgm extension (openGauss / PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Trigram indexes on employee searchable fields
CREATE INDEX IF NOT EXISTS idx_employee_full_name_trgm
    ON employee USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employee_no_trgm
    ON employee USING gin (employee_no gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employee_phone_trgm
    ON employee USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employee_email_trgm
    ON employee USING gin (email gin_trgm_ops);

-- 3. Trigram indexes on joined tables
CREATE INDEX IF NOT EXISTS idx_department_name_trgm
    ON department USING gin (department_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_position_name_trgm
    ON position USING gin (position_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_skill_name_trgm
    ON skill USING gin (skill_name gin_trgm_ops);

-- 4. B-tree for the employment_status filter (equality lookup)
CREATE INDEX IF NOT EXISTS idx_employee_status_active
    ON employee(employment_status) WHERE employment_status IN ('active', 'probation');

-- 5. Composite index for the most common search path
--    (status + name covers the WHERE + main ORDER BY)
CREATE INDEX IF NOT EXISTS idx_employee_status_name
    ON employee(employment_status, full_name);
```

### Query Rewrite

Minor improvement: wrap the OR conditions in a `(status_filter)` subquery to let the planner use the partial index before hitting the trigram index:

```python
def directory_search(keyword: str = "", department_id: int = None, position_id: int = None):
    """Cross-field full-text search with optional filter predicates."""
    if not keyword.strip() and not department_id and not position_id:
        return []

    where_clauses = ["e.employment_status IN ('active', 'probation')"]
    
    if keyword.strip():
        like_pattern = f"'%' || {sql_literal(keyword)} || '%'"
        where_clauses.append(f"""(
             e.full_name ILIKE {like_pattern}
          OR e.employee_no ILIKE {like_pattern}
          OR e.phone ILIKE {like_pattern}
          OR e.email ILIKE {like_pattern}
          OR d.department_name ILIKE {like_pattern}
          OR p.position_name ILIKE {like_pattern}
          OR s.skill_name ILIKE {like_pattern}
        )""")
    
    if department_id:
        where_clauses.append(f"e.department_id = {int(department_id)}")
    if position_id:
        where_clauses.append(f"e.position_id = {int(position_id)}")

    return json_array_query(f"""
        SELECT DISTINCT e.employee_id, e.employee_no, e.full_name,
               e.gender, e.phone, e.email,
               d.department_name,
               p.position_name,
               e.employment_status,
               e.hire_date,
               e.manager_employee_id,
               mgr.full_name AS manager_name
        FROM employee e
        JOIN department d ON d.department_id = e.department_id
        JOIN position p ON p.position_id = e.position_id
        LEFT JOIN employee mgr ON mgr.employee_id = e.manager_employee_id
        LEFT JOIN employee_skill es ON es.employee_id = e.employee_id
        LEFT JOIN skill s ON s.skill_id = es.skill_id
        WHERE {' AND '.join(where_clauses)}
        ORDER BY e.full_name
        LIMIT 50
    """)
```

### Alternative: Materialized Search View

For very large datasets (>50K employees), consider a materialized view that pre-joins and concatenates all searchable fields into a single `tsvector` column:

```sql
CREATE MATERIALIZED VIEW directory_search_mv AS
SELECT e.employee_id, e.employee_no, e.full_name, e.gender,
       e.phone, e.email, e.employment_status, e.hire_date,
       e.manager_employee_id,
       d.department_id, d.department_name,
       p.position_id, p.position_name,
       mgr.full_name AS manager_name,
       to_tsvector('simple',
           coalesce(e.full_name,'') || ' ' ||
           coalesce(e.employee_no,'') || ' ' ||
           coalesce(d.department_name,'') || ' ' ||
           coalesce(p.position_name,'') || ' ' ||
           coalesce(string_agg(s.skill_name, ' '), '')
       ) AS search_vector
FROM employee e
JOIN department d ON d.department_id = e.department_id
JOIN position p ON p.position_id = e.position_id
LEFT JOIN employee mgr ON mgr.employee_id = e.manager_employee_id
LEFT JOIN employee_skill es ON es.employee_id = e.employee_id
LEFT JOIN skill s ON s.skill_id = es.skill_id
WHERE e.employment_status IN ('active', 'probation')
GROUP BY e.employee_id, d.department_id, p.position_id, mgr.employee_id;

CREATE INDEX idx_dir_search_mv_gin ON directory_search_mv USING gin(search_vector);
```

For the current project size (~60 employees), **trigram indexes are sufficient** and the materialized view is over-engineering.

---

## 3. Permission Scope: Extend _require_permission()

### Problem

Current `_require_permission()` in `E:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/server.py` (lines 612-615) performs a flat membership check:

```python
def _require_permission(self, user, permission_code):
    permissions = set(user.get("permissions", []))
    if permission_code not in permissions:
        raise PermissionError(f"permission denied: {permission_code}")
```

There is no scope awareness. A user with `employee.manage` sees all employees; a user without it sees nothing. There is no middle ground for "view my team" or "view only myself."

### Scope Hierarchy

Define three data visibility levels:

| Scope   | Label    | Meaning                                                        |
|---------|----------|----------------------------------------------------------------|
| `self`  | Own      | Target data belongs to the authenticated user's employee record |
| `team`  | Team     | Target data belongs to the user's direct reports or department  |
| `all`   | All      | No restriction — full data access                              |

### Permission Naming Convention

Convert flat permission codes to scoped codes:

| Flat Code             | Self Scope       | Team Scope           | All Scope               |
|-----------------------|------------------|----------------------|-------------------------|
| `employee.manage`     | (self implied)   | `employee.team`      | `employee.manage`       |
| `attendance.view`     | (self implied)   | `attendance.team`    | `attendance.view`       |
| `performance.view`    | (self implied)   | `performance.team`   | `performance.view`      |
| `analytics.view`      | (minimal)        | (minimal)            | `analytics.view`        |
| `team.view`           | (exists)         | `team.view`          | (same)                  |
| `directory.view`      | (new)            | `directory.team`     | `directory.view`        |

### Implementation: Scope-Aware Middleware

Replace the flat `_require_permission` with a scope resolver:

```python
# Permission scope hierarchy (higher = broader access)
_SCOPE_RANK = {"self": 0, "team": 1, "all": 2}

# Maps API endpoint minimum scopes
_ENDPOINT_SCOPE = {
    # Directory/search — everyone can search, scope filters results
    "/api/directory/tree":         "team",    # minimum: team view
    "/api/directory/search":       "self",    # minimum: self (filters by scope)
    "/api/directory/filters":      "self",
    # Org hierarchy
    "/api/org/tree":               "all",
    "/api/org/hierarchy":          "team",    # changed from employee.manage
    "/api/org/employee/{id}":      "self",    # checked dynamically
    # Attrition
    "/api/attrition/risk":         "analytics.view",
    "/api/attrition/summary":      "analytics.view",
}


def _resolve_user_scope(self, user):
    """Determine the user's maximum data scope from their permissions."""
    permissions = set(user.get("permissions", []))
    scope = "self"  # default: only self
    
    # Check broadest permission first
    # All-scope permissions
    if any(p.endswith(".manage") or p == "analytics.view" or p == "attendance.view"
           or p == "performance.view" for p in permissions):
        scope = "all"
    elif "team.view" in permissions:
        scope = "team"
    elif any(p.endswith(".team") for p in permissions):
        scope = "team"
    
    return scope


def _require_permission(self, user, permission_code, scope="all"):
    """Permission check with optional scope constraint.
    
    Args:
        user: Authenticated user profile from token.
        permission_code: The required permission (e.g. 'employee.manage').
        scope: Minimum required scope: 'self', 'team', or 'all'.
    
    Raises PermissionError if the user lacks the permission or scope.
    """
    permissions = set(user.get("permissions", []))
    
    # 1. Check permission exists
    if permission_code not in permissions:
        raise PermissionError(f"permission denied: {permission_code}")
    
    # 2. Check scope (if the endpoint demands it)
    user_scope = self._resolve_user_scope(user)
    required_rank = _SCOPE_RANK.get(scope, 2)      # default 'all'
    user_rank = _SCOPE_RANK.get(user_scope, 0)     # default 'self'
    
    if user_rank < required_rank:
        raise PermissionError(
            f"insufficient scope: need '{scope}', user has '{user_scope}'"
        )
```

### Data Filtering by Scope

Once the scope is resolved, endpoints must filter results. Add a helper:

```python
def _apply_scope_filter(self, user, scope):
    """Return SQL WHERE fragment and params for scope-based filtering.
    
    Returns ('', {}) if the user has 'all' scope.
    """
    user_scope = self._resolve_user_scope(user)
    employee_id = user.get("employee_id")
    
    if user_scope == "all":
        return "", {}
    
    if user_scope == "team" and employee_id:
        # Get all direct reports + the user themselves
        return (
            "AND (e.employee_id = %(self_id)s "
            "OR e.manager_employee_id = %(self_id)s)",
            {"self_id": employee_id}
        )
    
    if employee_id:
        return "AND e.employee_id = %(self_id)s", {"self_id": employee_id}
    
    # User has no employee binding — show nothing
    return "AND 1=0", {}
```

### RBAC Seed Update

In `bootstrap_rbac()` at `E:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/common/db.py`, update the MANAGER role to include `directory.view` and `employee.team`:

```sql
INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'directory.view', '组织目录查看', '查看组织架构和人员目录'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'directory.view');

INSERT INTO sys_permission (permission_code, permission_name, description)
SELECT 'directory.team', '团队目录查看', '查看本团队的组织架构和人员目录'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'directory.team');

-- Manager gets team scope
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM sys_role r
JOIN sys_permission p ON p.permission_code IN (
    'directory.view', 'directory.team'
)
WHERE r.role_code = 'MANAGER'
  AND NOT EXISTS (...);
```

---

## 4. Missing API Endpoints

The following endpoints are needed but missing from the current backend (`E:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/server.py`).

### 4.1 Directory with Filter/Search Combined

**Endpoint**: `GET /api/directory/search` (enhance existing)

**Current**: Only supports keyword search (`?q=xxx`).

**Missing**: Filter by department_id, position_id, employment_status.

**Update**: Add optional query parameters:

| Parameter       | Type   | Description                    |
|-----------------|--------|--------------------------------|
| `q`             | string | Full-text keyword              |
| `department_id` | int    | Filter by department           |
| `position_id`   | int    | Filter by position             |
| `status`        | string | `active`, `probation`, `all`   |

```python
if path == "/api/directory/search" and method == "GET":
    keyword = query.get("q", [""])[0]
    dept_id = query.get("department_id", [None])[0]
    pos_id = query.get("position_id", [None])[0]
    status = query.get("status", ["active"])[0]
    return self._send(
        200,
        ok(directory_service.directory_search(
            keyword=keyword,
            department_id=int(dept_id) if dept_id else None,
            position_id=int(pos_id) if pos_id else None,
            employment_status=status,
        ))
    )
```

### 4.2 Employee Skills Management (Batch / Self-Service)

**Endpoint**: `PUT /api/employees/:id/skills/batch`

Updates multiple skills at once for the talent discovery "edit skills" feature.

```python
# In server.py
match = re.fullmatch(r"/api/employees/(\d+)/skills/batch", path)
if match and method == "PUT":
    self._require_permission(user, "skill.manage")
    return self._send(
        200,
        ok(skill_service.batch_upsert_employee_skills(
            int(match.group(1)),
            body.get("skills", []),  # [{skill_id, proficiency_level}]
            user["username"]
        ))
    )
```

### 4.3 Department Position Listing

**Endpoint**: `GET /api/departments/:id/positions`

Returns only positions within a specific department (simpler than the full hierarchy).

```python
match = re.fullmatch(r"/api/departments/(\d+)/positions", path)
if match and method == "GET":
    self._require_permission(user, "department.manage")
    return self._send(
        200,
        ok(directory_service.list_positions_by_department(int(match.group(1))))
    )
```

Add to `directory_service.py`:

```python
def list_positions_by_department(department_id):
    return json_array_query(f"""
        SELECT p.*, j.job_title
        FROM position p
        LEFT JOIN job j ON j.job_id = p.job_id
        WHERE p.department_id = {int(department_id)}
          AND p.status = 1
        ORDER BY p.position_name
    """)
```

### 4.4 Skill Recommendation by Employee

**Endpoint**: `GET /api/skills/recommend/for-employee/:employee_id`

Recommends skills an employee should develop next (different from `skill_recommendations` which finds related skills by skill_id).

```python
match = re.fullmatch(r"/api/skills/recommend/for-employee/(\d+)", path)
if match and method == "GET":
    return self._send(
        200,
        ok(skill_service.recommend_skills_for_employee(int(match.group(1))))
    )
```

### 4.5 Employee Network by Path Parameter

**Endpoint**: `GET /api/employees/:id/network`

Currently `/api/org/network` uses query parameter `?employee_id=X`. Add a path-parameter version for consistency with other endpoints.

```python
match = re.fullmatch(r"/api/employees/(\d+)/network", path)
if match and method == "GET":
    return self._send(
        200,
        ok(org_service._build_reporting(int(match.group(1))))
    )
```

### 4.6 Directory Tree with Permission Scope

**Endpoint**: `GET /api/directory/tree` (enhance existing)

Currently no permission check. Add scope filtering so managers see only their team's data.

```python
if path == "/api/directory/tree" and method == "GET":
    self._require_permission(user, "directory.view", scope="team")
    return self._send(200, ok(directory_service.directory_tree(user)))
```

Update `directory_tree()` to accept optional employee_id for filtering:

```python
def directory_tree(user=None):
    user_scope = user.get("_scope", "all") if user else "all"
    employee_id = user.get("employee_id") if user else None
    
    where_team = ""
    if user_scope == "team" and employee_id:
        where_team = f"""
            AND e.department_id IN (
                SELECT department_id FROM employee
                WHERE employee_id = {employee_id}
            )
        """
    elif user_scope == "self" and employee_id:
        where_team = f"AND e.employee_id = {employee_id}"
    
    return json_array_query(f"""
        SELECT d.department_id, d.department_name,
               d.manager_name AS dept_manager,
               COALESCE(
                   json_agg(
                       json_build_object(
                           'employee_id', e.employee_id,
                           'employee_no', e.employee_no,
                           'full_name', e.full_name,
                           ...
                       )
                       ORDER BY e.full_name
                   ) FILTER (WHERE e.employee_id IS NOT NULL),
                   '[]'::json
               ) AS employees,
               COUNT(e.employee_id) FILTER (
                   WHERE e.employment_status IN ('active', 'probation')
               ) AS headcount
        FROM department d
        LEFT JOIN employee e ON e.department_id = d.department_id
        LEFT JOIN position p ON p.position_id = e.position_id
        {where_team}
        GROUP BY d.department_id, d.department_name, d.manager_name
        ORDER BY d.department_id
    """)
```

---

## 5. Route Parameter Mismatches

### Discovered Mismatches

| Frontend Call (hrms.ts)                      | Backend Route                                     | Status  |
|----------------------------------------------|---------------------------------------------------|---------|
| `GET /api/employees/skills?employee_id=X`    | `GET /api/employees/skills?employee_id=X`         | MATCH   |
| `GET /api/match/employee?employee_id=X`      | `GET /api/match/employee?employee_id=X`           | MATCH   |
| `GET /api/skills/gap`                        | `GET /api/skills/gap`                             | MATCH   |
| `GET /api/skills/heatmap`                    | `GET /api/skills/heatmap`                         | MATCH   |
| `GET /api/org/departments`                   | `GET /api/org/departments`                        | MATCH   |
| `GET /api/org/critical`                      | `GET /api/org/critical`                           | MATCH   |
| `GET /api/org/tree`                          | `GET /api/org/tree`                               | MATCH   |
| `GET /api/predict/attrition`                 | `GET /api/predict/attrition`                      | MATCH   |

All named frontend API calls in `hrms.ts` match their backend counterparts. However, there are **implicit mismatches** in how the frontend pages consume the data:

### 5.1 Frontend: `/talent` (Talent Discovery)

The talent page at `E:/Ufolder/Current/ActionSys/Hgclass/DB/frontend-pure/src/views/talent/index.vue` uses a **N+1 query pattern**:

```javascript
const r = await getEmployees({page:1, page_size:50});
const emps = r.data?.list||[];
for (const e of emps) {
    const m = await getMatch(e.employee_id);
    enriched.push({...e, match_pct: m.data?.[0]?.match_pct});
}
```

This calls `GET /api/employees` once then `GET /api/match/employee/:id` once per employee. This is **N+1 problem** and will not scale.

**Fix**: Add a batch match endpoint:

```
GET /api/match/batch?employee_ids=1,2,3,4,5
```

### 5.2 Frontend: `/org` (Org Panorama)

The org page uses `getOrgDepartments()` which calls `GET /api/org/departments`, but does NOT call `GET /api/org/hierarchy` or `GET /api/org/employee/:id`. The full hierarchy with nested positions/employees is available at `/api/org/hierarchy` but the frontend doesn't use it.

**Fix**: Add frontend API function for hierarchy:

```typescript
export const getOrgHierarchy = () => http.get('/org/hierarchy')
```

Add to `hrms.ts`:
```typescript
export const getOrgHierarchy = () => http.get('/org/hierarchy')
export const getEmployeeBundle = (id: number) => http.get(`/org/employee/${id}`)
export const getDirectoryTree = () => http.get('/directory/tree')
export const getDirectorySearch = (q: string) => http.get('/directory/search', { params: { q } })
```

### 5.3 Frontend: `/profile`

The profile view (no API calls in `hrms.ts`) is missing endpoints for:
- `GET /api/profile/self` — (exists on backend as `/api/profile/self`)
- `PUT /api/profile/contact` — (exists on backend)
- `GET /api/employees/:id/profile` — (exists on backend)
- `GET /api/employees/:id/job-history` — (exists on backend)

**Fix**: Add frontend API functions:
```typescript
export const getSelfProfile = () => http.get('/profile/self')
export const updateContact = (d: any) => http.put('/profile/contact', d)
export const getEmployeeProfile = (id: number) => http.get(`/employees/${id}/profile`)
export const getJobHistory = (id: number) => http.get(`/employees/${id}/job-history`)
```

### 5.4 Backend: Inconsistent Route Patterns

| Route Pattern                    | Style                 | Issue                               |
|----------------------------------|-----------------------|--------------------------------------|
| `/api/org/network?employee_id=X` | Query parameter       | Should also accept path param for REST consistency |
| `/api/org/employee/:id`          | Path parameter        | Correct                             |
| `/api/employees/skills`          | Flat path             | Consider `/api/employees/:id/skills` |
| `/api/match/employee`            | Query parameter       | Consider `/api/employees/:id/match`  |

---

## 6. Complete Endpoint Inventory

### 6.1 Auth
| Method | Path                          | Permission      | Description              |
|--------|-------------------------------|-----------------|--------------------------|
| POST   | `/api/auth/login`             | public          | Login                    |
| GET    | `/api/auth/profile`           | auth            | Get profile              |
| POST   | `/api/auth/logout`            | auth            | Logout                   |

### 6.2 Directory & Search (new discover layer)
| Method | Path                                   | Permission         | Description                          |
|--------|----------------------------------------|--------------------|--------------------------------------|
| GET    | `/api/directory/tree`                  | `directory.view`   | Dept -> employees (with scope filter)|
| GET    | `/api/directory/search`                | `directory.view`   | Full-text search + filters           |
| GET    | `/api/directory/filters`               | public             | Filter options (dept, position)      |

### 6.3 Organization Hierarchy
| Method | Path                                   | Permission         | Description                          |
|--------|----------------------------------------|--------------------|--------------------------------------|
| GET    | `/api/org/tree`                        | `employee.manage`  | Flat recursive org tree              |
| GET    | `/api/org/hierarchy`                   | `employee.manage`  | Nested dept -> pos -> emp (FIXED)    |
| GET    | `/api/org/employee/:id`                | `employee.manage`  | Employee bundle (7 domains)          |
| GET    | `/api/org/network`                     | `employee.manage`  | Employee network (query param)       |
| GET    | `/api/employees/:id/network`           | `employee.manage`  | Employee network (path param)        |
| GET    | `/api/org/critical`                    | `employee.manage`  | Key person risk                      |
| GET    | `/api/org/departments`                 | `employee.manage`  | Department stats                     |

### 6.4 Skills Intelligence
| Method | Path                                               | Permission        | Description                           |
|--------|----------------------------------------------------|-------------------|---------------------------------------|
| GET    | `/api/skills`                                      | public            | List skills (optional category_id)    |
| POST   | `/api/skills`                                      | `skill.manage`    | Create skill                          |
| PUT    | `/api/skills/:id`                                  | `skill.manage`    | Update skill                          |
| DELETE | `/api/skills/:id`                                  | `skill.manage`    | Delete skill                          |
| GET    | `/api/skills/categories`                           | public            | List categories                       |
| POST   | `/api/skills/categories`                           | `skill.manage`    | Create category                       |
| PUT    | `/api/skills/categories/:id`                       | `skill.manage`    | Update category                       |
| DELETE | `/api/skills/categories/:id`                       | `skill.manage`    | Delete category                       |
| GET    | `/api/skills/recommend`                            | public            | Related skills by skill_id            |
| GET    | `/api/skills/recommend/for-employee/:id`           | `employee.manage` | Recommended skills for employee       |
| GET    | `/api/skills/gap`                                  | `analytics.view`  | Org skill gap (basic)                 |
| GET    | `/api/skills/gap/enhanced`                         | `analytics.view`  | Org skill gap (all skills)            |
| GET    | `/api/skills/gap/department/:id`                   | `analytics.view`  | Dept skill gap detail                 |
| GET    | `/api/skills/heatmap`                              | `analytics.view`  | Dept x category matrix                |
| GET    | `/api/skills/analytics/overview`                   | `analytics.view`  | Org skills overview                   |
| GET    | `/api/skills/analytics/department-comparison`      | `analytics.view`  | Dept comparison                       |
| GET    | `/api/employees/skills`                            | public            | Employee skills (by employee_id param)|
| POST   | `/api/employees/skills`                            | `skill.manage`    | Upsert employee skill                 |
| PUT    | `/api/employees/:id/skills/batch`                  | `skill.manage`    | Batch upsert skills (NEW)             |
| DELETE | `/api/employees/skills`                            | `skill.manage`    | Delete employee skill                 |
| POST   | `/api/skills/infer/:id`                            | `skill.manage`    | AI infer skills                       |
| GET    | `/api/match/employee`                              | public            | Position match for employee           |
| GET    | `/api/match/batch`                                 | public            | Batch position match (NEW)            |

### 6.5 Attrition Risk (hybrid engine)
| Method | Path                                   | Permission        | Description                          |
|--------|----------------------------------------|-------------------|--------------------------------------|
| GET    | `/api/attrition/risk`                  | `analytics.view`  | All or single employee risk          |
| GET    | `/api/attrition/summary`               | `analytics.view`  | Dept-level risk summary              |
| GET    | `/api/attrition/flags`                 | `analytics.view`  | Flagged employees (>= threshold)     |
| GET    | `/api/attrition/drivers`               | `analytics.view`  | Top risk drivers                     |
| GET    | `/api/attrition/distribution`          | `analytics.view`  | Score distribution                   |
| POST   | `/api/attrition/snapshot`              | `analytics.view`  | Persist snapshot                     |
| GET    | `/api/attrition/history/:id`           | `analytics.view`  | Employee risk history                |

### 6.6 Attendance
| Method | Path                                   | Permission            | Description                          |
|--------|----------------------------------------|-----------------------|--------------------------------------|
| POST   | `/api/attendance/clock`                | auth (self)           | Clock in/out                         |
| GET    | `/api/attendance/my`                   | auth (self)           | My attendance records                |
| GET    | `/api/attendance/records`              | `attendance.view`     | All records (paginated, filtered)    |
| GET    | `/api/attendance/summary`              | `analytics.view`      | Dept attendance summary              |
| POST   | `/api/attendance/sync`                 | `analytics.view`      | Sync absences/lateness               |

### 6.7 Performance
| Method | Path                                   | Permission               | Description                          |
|--------|----------------------------------------|--------------------------|--------------------------------------|
| GET    | `/api/performance/reviews`             | `performance.view`       | List reviews (paginated, filtered)   |
| POST   | `/api/performance/reviews`             | `performance.manage`     | Create review                        |
| PUT    | `/api/performance/reviews/:id`         | `performance.manage`     | Update review                        |
| GET    | `/api/performance/my`                  | auth (self)              | My reviews                           |
| GET    | `/api/performance/summary`             | `analytics.view`         | Dept performance summary             |
| POST   | `/api/performance/sync`                | `analytics.view`         | Sync avg performance score           |

### 6.8 Cross-module Analytics
| Method | Path                                   | Permission        | Description                          |
|--------|----------------------------------------|-------------------|--------------------------------------|
| GET    | `/api/analytics/department-health`     | `analytics.view`  | Composite health score               |
| GET    | `/api/analytics/risk-trends`           | `analytics.view`  | Org risk trend summary               |
| GET    | `/api/analytics/critical-persons`      | `analytics.view`  | Key person + attrition risk          |

---

## Implementation Order

### Phase 1: Critical Fixes (immediate)
1. Fix `org_hierarchy()` SQL to use `position.department_id`
2. Add trigram indexes for `directory_search()`
3. Add `department_id`, `position_id` filter params to `directory_search()`

### Phase 2: Permission Scoping (next)
4. Implement `_resolve_user_scope()` in server.py
5. Add `directory.view`, `directory.team` to RBAC bootstrap
6. Apply scope filtering to `/api/directory/tree` and `/api/org/employee/:id`

### Phase 3: Missing Endpoints (parallel)
7. Add `/api/employees/:id/skills/batch` endpoint
8. Add `/api/departments/:id/positions` endpoint
9. Add `/api/skills/recommend/for-employee/:id` endpoint
10. Add `/api/employees/:id/network` path-param endpoint
11. Add `/api/match/batch` endpoint

### Phase 4: Frontend Alignment (parallel)
12. Add frontend API functions for new endpoints in `hrms.ts`
13. Fix N+1 query in talent view
14. Add hierarchy API call to org view

---

*End of Backend API Design Document*
