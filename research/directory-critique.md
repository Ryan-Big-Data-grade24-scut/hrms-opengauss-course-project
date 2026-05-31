# Directory / Org Page Design Critique

**Analyzed:** 2026-05-30
**Codebase:** HRMS (Hgclass/DB) — backend/services, sql/migrations, frontend-react
**Target standard:** Feishu-style organizational directory (通讯录)

---

## Executive Summary

The current Directory and Organization pages provide functional building blocks but suffer from three critical structural gaps: (1) positions are not department-scoped in the hierarchy query, causing cross-department position bleed; (2) CRUD operations exist on the backend but have zero frontend surface area; (3) employee profile display in the slide-out panel only fetches skills, ignoring the rich 7-domain bundle the backend already supports. Beyond these specific issues, there are approximately 15 additional deficiencies that prevent the system from matching a proper Feishu-style org directory experience.

---

## Problem 1: Department-Position Scoping (The "Wrong Positions" Bug)

### Root Cause

The `org_hierarchy()` function in `org_service.py` groups positions by `employee_data.department_id` (which is `e.department_id` from the `employee` table), **not** by `position.department_id`. This means if any employee in Engineering has `position_id = 3` (which in the seed data is "Marketing Specialist"), that position will appear under Engineering, not under Marketing.

### Evidence

- `org_hierarchy()` (line 162-186): `position_agg` CTE groups by `ed.department_id, ed.position_id` where `ed` is `employee_data`, which contains `e.department_id`.
- The `position` table has its own `department_id` field (added in V2 migration, line 85), but `org_hierarchy()` ignores it entirely.
- Seed data in V5 (line 177-178): `department_id = (i%3)+1` randomly distributes employees across departments 1-3, while `position_id = (i%6)+1` assigns any of 6 positions. This creates mismatches where Backend Engineers end up in HR and HR Specialists end up in Engineering.
- `directory_tree()` (line 158-191) also has this problem: it groups employees under departments by `e.department_id` but never verifies that the employee's `position_id` belongs to that department.

### Impact

- Engineering shows positions like Accountant, HR Specialist, Marketing Specialist
- HR shows Backend Engineer, Fullstack Engineer
- The org chart is structurally unsound — positions float across departments

### Fix Required

The hierarchy query must validate that `e.position_id`'s owning `department_id` matches `e.department_id`, OR render positions under their owning department regardless of which employee holds them. The `directory_tree()` should also group employees by position within department.

---

## Problem 2: No Frontend CRUD

### What Exists on Backend

The `directory_service.py` has full CRUD:
- `create_department()` / `update_department()` / `delete_department()` (lines 22-76)
- `create_position()` / `update_position()` / `delete_position()` (lines 94-150)
- All wired to REST endpoints in `server.py` under `/api/departments` and `/api/positions`

### What's Missing on Frontend

`DirectoryPage.tsx` has absolutely zero CRUD affordances:
- No "Add Department" button or dialog
- No "Edit Department" (rename, reassign manager)
- No "Delete Department" with confirmation
- No "Add Position" within a department
- No "Edit Position" (rename, change headcount, required skills)
- No "Delete Position"
- No way to reassign an employee to a different department/position from the directory view
- No inline editing of employee fields (phone, email, status)

### Backend Gaps

- `delete_department()` (line 74) has no `CASCADE` or safety check — it will fail with FK violations if employees or positions reference the department
- No batch operations (reassign all employees from a deleted department)
- No validation that a position's headcount isn't exceeded
- No audit of department/position changes in the directory CRUD paths (only `write_audit` is called in individual services)

---

## Problem 3: Profile Only Shows Skills

### What the Frontend Fetches

`DirectoryPage.tsx` line 200:
```typescript
const s = await get('/employees/skills?employee_id=' + selectedEmp.employee_id)
```

This calls `skill_service.get_employee_skills()` — only skills data.

### What the Backend Offers

`org_service.get_employee_bundle()` (line 277-309) returns a 7-field bundle:
1. **employee** — employee_no, full_name, gender, phone, email, hire_date, department_name, position_name, manager_name, birth_date, employment_type
2. **profile** — address, emergency_contact_name, emergency_contact_phone, education_level, marital_status, personal_email, notes
3. **skills** — skill_name, proficiency_level, category_name
4. **position_match** — match percentage for every position
5. **reporting** — manager, peers, subordinates
6. **job_history** — position/department changes over time
7. **attrition_risk** — hybrid risk score

### What the Slide-Out Panel Shows

The frontend slide-out (lines 455-549) only shows:
- Full name and position
- Department, phone, email, employment status
- Skill bars (proficiency level)

### What's Missing from the Slide-Out

| Field | Backend Available? | Frontend Shown? |
|-------|-------------------|-----------------|
| Employee number (工号) | Yes (employee.employee_no) | No |
| Manager name | Yes (employee.manager_name) | No |
| Hire date | Yes (employee.hire_date) | No |
| Birth date | Yes (employee.birth_date) | No |
| Employment type | Yes (employee.employment_type) | No |
| Gender | Yes (employee.gender) | No |
| Address | Yes (profile.address) | No |
| Emergency contact | Yes (profile.emergency_contact_*) | No |
| Education level | Yes (profile.education_level) | No |
| Position match % | Yes (position_match) | No |
| Reporting chain | Yes (reporting) | No |
| Job history timeline | Yes (job_history) | No |
| Attrition risk score | Yes (attrition_risk) | No |

---

## Problem 4: Permissions Are Wrong for Directory Access

### Current Permission Model

In `server.py`, directory endpoints:
- `/api/directory/tree` — **no permission check** (accessible to any authenticated user)
- `/api/directory/search` — **no permission check**
- `/api/directory/filters` — **no permission check**
- `/api/org/hierarchy` — requires `employee.manage`
- `/api/org/employee/{id}` — requires `employee.manage`

### Issues

1. The public directory endpoints (`/api/directory/tree`, `/api/directory/search`) expose full org structure to every authenticated user, including resigned employees and their assignments.
2. The rich bundle endpoint (`/api/org/employee/{id}`) requires `employee.manage`, meaning regular employees cannot view their own profile's full details.
3. There is no role-based field filtering — an HR employee might need to see salary or emergency contact, but a regular employee should not.
4. Feishu-style directories typically show limited info to all employees (name, department, position, phone, email) and more detail to HR/admins.

---

## Problem 5: Flat vs. Hierarchical Department Display

### Department Hierarchy

The `department` table has `parent_department_id` (self-referential FK), but:
- `directory_tree()` (line 158-191) returns a flat list of departments with no nesting
- The left sidebar in `DirectoryPage.tsx` (line 248-288) renders departments as a flat button list
- `org_hierarchy()` also returns a flat department list ordered alphabetically

### Impact

The company_design.md describes a 5-level org structure (CEO -> VP -> Director -> Manager -> IC). But the current directory renders all departments as peers. There is no:
- Collapsible department tree
- Parent/child visual indentation
- Breadcrumb navigation for nested departments
- "Sub-department" count on parent departments

---

## Problem 6: Search Limitations

### Backend

`directory_search()` (line 194-230):
- LIMIT 50 results (hard-coded)
- Full-text search across employee name, number, phone, email, department, position, skill
- Returns flat employee list with department/position names

### Frontend

`DirectoryPage.tsx` (line 162-191):
- 300ms debounce on search input
- Filter chips (department, position) are applied client-side only
- No server-side filtered search

### Issues

1. 50-result limit means in a 60-person company, some searches will be incomplete; in larger deployments this is broken
2. Filter chips are populated from `/api/directory/filters` which returns ALL departments and ALL positions, not contextual ones (e.g., if searching in Engineering, only Engineering positions should be suggested)
3. No typeahead/suggestions while typing
4. No search within the slide-out panel
5. Search does not return profile fields (address, emergency contact, education)

---

## Problem 7: No Visual Org Chart

### Missing Features

Feishu-style directories typically have:
- Department card view showing manager name, headcount, top skills/stats
- Position-grouped employee cards within each department
- Reporting line visualization (who reports to whom)
- Click-to-expand organizational chart
- Employee avatar/initial circles

### Current State

- `DirectoryPage.tsx` shows a flat left sidebar of departments and a grid of employee cards
- No org chart rendering
- No reporting line visualization
- "Reporting chain" data is computed in `employee_network()` (org_service.py line 224-253) but never displayed
- The `org_hierarchy()` endpoint returns rich data (required_skills, match_pct, top_skills) but the frontend never calls it

---

## Complete Gap Checklist

### Data / Schema Gaps

| Gap | Severity | File |
|-----|----------|------|
| Position `department_id` not used in hierarchy queries | Critical | `org_service.py` lines 162-186 |
| No avatar/photo support for employees | Medium | Schema: `employee` table |
| No department contact info (phone, email) | Medium | Schema: `department` table |
| No employee social/IM handles | Low | Schema: `employee` table |
| No employee work location per-seat | Low | Schema: `employee` or `employee_profile` |

### Backend API Gaps

| Gap | Severity | File |
|-----|----------|------|
| No `DELETE` safety check for departments with children/employees | Critical | `directory_service.py` line 74 |
| `/api/directory/tree` exposes all data without permission scoping | High | `server.py` line 327-328 |
| No paginated department listing | Medium | `directory_service.py` line 9 |
| No cascade position query (positions of a department) | Medium | `directory_service.py` |
| No batch employee transfer endpoint | Low | Not implemented |
| No department-move endpoint (reparent a department) | Low | Not implemented |

### Frontend Gaps

| Gap | Severity | File |
|-----|----------|------|
| No CRUD UI for departments/positions/employees | Critical | `DirectoryPage.tsx` |
| Profile slide-out only fetches skills, not full bundle | Critical | `DirectoryPage.tsx` line 200 |
| No department hierarchy nesting in sidebar | High | `DirectoryPage.tsx` lines 248-288 |
| No loading/error states for employee detail (only skills) | High | `DirectoryPage.tsx` lines 193-208 |
| No visual org chart | High | Not implemented |
| No employee avatar display | Medium | `DirectoryPage.tsx` line 412 uses generic icon |
| No pagination for large departments | Medium | `DirectoryPage.tsx` |
| No inline editing of employee fields | Medium | Not implemented |
| No department-level stats shown | Low | `DirectoryPage.tsx` only shows headcount |
| Click on position name to filter by position | Low | Not implemented |
| No copy/export employee contact info | Low | Not implemented |

---

## Architecture Diagram: Data Flow

```
[DirectoryPage.tsx] ---> GET /directory/tree       ---> directory_service.directory_tree()
                    ---> GET /directory/search?q=X  ---> directory_service.directory_search()
                    ---> GET /directory/filters      ---> directory_service.directory_filters()
                    ---> GET /employees/skills?eid=X ---> skill_service.get_employee_skills()

USED BY BACKEND BUT NOT FRONTEND:
[org_hierarchy()]   ---> GET /org/hierarchy         ---> Nested dept->position->employee tree
[get_employee_bundle()] -> GET /org/employee/{id}  ---> 7-domain profile bundle
```

The frontend uses the three simplest endpoints (`tree`, `search`, `filters`) and only one-fifth of the backend's capability. The powerful `org_hierarchy` and `get_employee_bundle` endpoints exist but are never consumed.

---

## Recommended Fix Order

### Phase 1: Correctness (Critical)
1. Fix `org_hierarchy()` to scope positions by `position.department_id` instead of `employee.department_id`
2. Fix `directory_tree()` to show employee-position-department consistency
3. Update the frontend slide-out to call `GET /org/employee/{id}` instead of `GET /employees/skills`
4. Add permission scoping to directory endpoints

### Phase 2: CRUD (High)
5. Add department management UI (create/edit/delete dialogs)
6. Add position management UI (create/edit/delete within department context)
7. Add employee reassignment (change department/position)
8. Add safety validation on delete (check for children, warn)

### Phase 3: Org Chart (Medium)
9. Render department hierarchy (parent/child) in the sidebar
10. Add position grouping within each department view
11. Add reporting-line visualization
12. Add avatar/photo support

### Phase 4: Polish (Low)
13. Add pagination for large departments
14. Add export/copy contact
15. Add department-level stats (avg tenure, turnover rate, skill coverage)
16. Search typeahead with contextual filter suggestions

---

## Key Files Referenced

| File | Role |
|------|------|
| `backend/src/services/org_service.py` | Department->position->employee hierarchy, employee bundle |
| `backend/src/services/directory_service.py` | Directory tree, search, filters, dept/position CRUD |
| `backend/src/services/employee_service.py` | Employee CRUD (used by bundle) |
| `backend/src/services/employee_profile_service.py` | Employee profile (used by bundle) |
| `backend/src/services/skill_service.py` | Skills (used by bundle and frontend) |
| `backend/src/server.py` | All route wiring and permission checks |
| `frontend-react/src/pages/DirectoryPage.tsx` | The directory frontend page |
| `sql/migrations/V2__org_and_job.sql` | Department/position schema additions |
| `sql/migrations/V3__employee_profile_and_history.sql` | Employee profile and job history tables |
| `sql/migrations/V5__discover.sql` | Skill system, seed data (contains position-emp mismatch) |
| `company_design.md` | Design target: 8 departments, 18 positions, hierarchical org |

---

## References

- **Feishu/Lark Directory Design**: Department-based position scoping, cascading filters, org chart with click-to-expand, role-based contact visibility
- **Workday Organizational Chart**: Position hierarchy with reporting lines, department breadcrumbs, manager card view
- **Internal company_design.md**: Specifies 8 departments with proper hierarchical structure (VP -> Director -> Manager -> IC), not the flat 3-department seed data
