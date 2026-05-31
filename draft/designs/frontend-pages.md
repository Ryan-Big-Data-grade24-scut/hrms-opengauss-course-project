# Layer 3: Frontend Architecture Design

## Table of Contents

1. [DirectoryPage Bug: ?q= vs ?keyword=](#1-directorypage-bug)
2. [Profile Page: Contact & Org Fields](#2-profile-page-enhancement)
3. [Skills Page: CRUD Interaction Flow](#3-skills-page-crud)
4. [Analytics Page: Tab Switching](#4-analytics-page-tab-switching)
5. [Permission Gating: RequirePermission Component](#5-permission-gating)
6. [Navigation: Sidebar Design](#6-navigation-sidebar)
7. [State Management Strategy](#7-state-management)
8. [Error Handling & Loading Patterns](#8-error-handling)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. DirectoryPage Bug

### Current State

| Layer | Parameter | Code Location |
|-------|-----------|--------------|
| Frontend DirectoryPage | `?q=` | Line 183: `'/directory/search?q=' + encodeURIComponent(debouncedQuery)` |
| Backend server.py | `query.get("q", [""])[0]` | Line 331: reads `?q=` from URL query string |
| Backend directory_service.py | `keyword` parameter | Line 194: `def directory_search(keyword: str = "")` |

### Verdict: The frontend and backend currently MATCH — there is no bug.

Both ends use `?q=`. The service function parameter is named `keyword`, but the HTTP handler correctly maps `?q=` to that parameter. No code change is needed for this endpoint.

### Consistency Concern

A separate endpoint, `/api/employees` (line 155 in server.py), uses the raw query dict as filters, and `employee_service.list_employees` reads `filters.get("keyword")`. This means `/api/employees` expects `?keyword=`, while `/api/directory/search` expects `?q=`. This is a design inconsistency but not a bug.

### Recommendation

Document the parameter convention in an API table:

| Endpoint | Search Parameter | Purpose |
|----------|----------------|---------|
| `GET /api/directory/search` | `?q=` | Full-text directory search |
| `GET /api/employees` | `?keyword=` | Paginated employee list filter |

If you want to unify them, change the frontend and backend to use `?keyword=` everywhere. The minimal change path:

1. In `server.py` line 331: change `query.get("q", [""])[0]` to `query.get("keyword", [""])[0]`
2. In `DirectoryPage.tsx` line 183: change `'?q='` to `'?keyword='`

This is low-risk and takes 2 minutes but is entirely optional — the current state is functional.

---

## 2. Profile Page Enhancement

### Current Gaps

`ProfileTalentHub.tsx` currently displays:
- Employee name (from selector)
- Department name
- Employment status
- Skills (bar chart)
- Best-fit roles

**Missing**: phone, email, position (shown in selector label but not as distinct fields), hire date, manager name.

### Data Availability

The backend `get_employee()` returns all these fields (employee_service.py lines 60-88):
- `phone`, `email`, `department_name`, `position_name`, `hire_date`, `manager_name`, `employment_type`, `gender`, `birth_date`, `employee_no`

### Implementation Plan

**Step 1: Add a profile detail section** below the employee selector, showing contact and organizational information in a structured card.

```
+----------------------------------------------------+
| Profile & Talent Hub                                |
+----------------------------------------------------+
| Employee: [Jane Smith - Senior Engineer v]          |
+------------------------+---------------------------+
| Contact Information    | Organizational            |
|                        |                           |
| Phone: +86 138 xxxx    | Department: Engineering   |
| Email: jane@company    | Position: Senior Engineer |
|                        | Manager: John Doe         |
|                        | Hire Date: 2022-03-15     |
|                        | Status: Active            |
+------------------------+---------------------------+
| Skills                 | Best-Fit Roles            |
| ...                    | ...                       |
+------------------------+---------------------------+
```

**Step 2: Wire the API call**.

The current `ProfileTalentHub.tsx` fetches employee data via `api.employees('page=1&page_size=50')` which returns a list. To get full contact details, use the existing selected employee object which already has `phone`, `email`, `position_name`, `department_name` from the list endpoint — these are returned by `employee_service.list_employees()` (lines 27-57 of employee_service.py) which includes all needed fields.

No additional API calls needed — the data is already in the `employees` state array.

**Step 3: Update the profile card JSX**.

Add phone/email fields to the existing profile card div (around line 56-70):

```tsx
{emp && (
  <div className="space-y-3 text-sm text-stone-600">
    {/* Contact */}
    <div className="pt-2 border-t border-stone-100">
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Contact</p>
      {emp.phone && (
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-stone-400" />
          <span>{emp.phone}</span>
        </div>
      )}
      {emp.email && (
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-stone-400" />
          <span className="truncate">{emp.email}</span>
        </div>
      )}
    </div>
    {/* Organization */}
    <div className="pt-2 border-t border-stone-100">
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Organization</p>
      <div className="flex justify-between">
        <span className="text-stone-400">Department</span>
        <span>{emp.department_name}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-stone-400">Position</span>
        <span>{emp.position_name}</span>
      </div>
      {emp.manager_name && (
        <div className="flex justify-between">
          <span className="text-stone-400">Manager</span>
          <span>{emp.manager_name}</span>
        </div>
      )}
    </div>
  </div>
)}
```

---

## 3. Skills Page CRUD

### Overview

The skills page (`SkillsPage.tsx` — a NEW page, not yet created) enables HR managers to manage the skill taxonomy and employee skill assignments. It has two modes:

### Mode A: Skill Taxonomy Management (admin)

Requires `skill.manage` permission. CRUD on the skill library.

### Mode B: Employee Skill Assignment (manager / self-service)

Upsert and delete employee_skill records.

### API Endpoints Used

| Action | Method | Endpoint | Permission |
|--------|--------|----------|------------|
| List skills | GET | `/api/skills?category_id=...` | None |
| List categories | GET | `/api/skills/categories` | None |
| **Create skill** | POST | `/api/skills` | `skill.manage` |
| **Update skill** | PUT | `/api/skills/{id}` | `skill.manage` |
| **Delete skill** | DELETE | `/api/skills/{id}` | `skill.manage` |
| **Create category** | POST | `/api/skills/categories` | `skill.manage` |
| **Update category** | PUT | `/api/skills/categories/{id}` | `skill.manage` |
| **Delete category** | DELETE | `/api/skills/categories/{id}` | `skill.manage` |
| Get employee skills | GET | `/api/employees/skills?employee_id=...` | None |
| **Upsert employee skill** | POST | `/api/employees/skills` | `skill.manage` |
| **Delete employee skill** | DELETE | `/api/employees/skills` | `skill.manage` |
| Get skill recommendations | GET | `/api/skills/recommend?skill_id=...` | None |

### Page Layout

```
+------------------------------------------------------+
| Skills Management                                     |
+------------------------------------------------------+
| [Browse Skills Tab] [Employee Skills Tab]              |
+------------------------------------------------------+
|                                                       |
| TAB: Browse Skills (taxonomy admin)                   |
|                                                       |
| +----------+ +-------------------------------------+ |
| | Categories| | Skills in "Programming Languages"   | |
| |           | |                                     | |
| | [All]     | | Python      [Edit] [Delete]         | |
| | Languages | | JavaScript  [Edit] [Delete]         | |
| | Backend   | | TypeScript  [Edit] [Delete]         | |
| | DevOps    | | Go          [Edit] [Delete]         | |
| | Database  | |                                     | |
| |           | | [+ Add Skill]                       | |
| +----------+ +-------------------------------------+ |
|                                                       |
| TAB: Employee Skills (assignment)                     |
|                                                       |
| Employee: [Jane Smith v]                              |
|                                                       |
| [Add Skill +]                                         |
|                                                       |
| Python         [Level: 4/5] [Remove]                 |
| JavaScript     [Level: 3/5] [Remove]                 |
| Docker         [Level: 2/5] [Remove]                 |
+------------------------------------------------------+
```

### Interaction Flows

#### Flow 1: Add a New Skill (Taxonomy)

1. User clicks "[+ Add Skill]" button
2. Modal opens with form fields:
   - `skill_name` (text input, required)
   - `category_id` (dropdown from /api/skills/categories, required)
   - `description` (textarea, optional)
3. User fills form and clicks "Save"
4. Frontend calls `POST /api/skills` with `{ skill_name, category_id, description }`
5. On success: close modal, refresh skill list, show success toast
6. On error: show validation error in modal (e.g., "Skill name already exists")

**States**: idle -> loading (spinner in save button) -> success (close + refresh) | error (inline message)

#### Flow 2: Edit Skill Level (Employee Assignment)

1. User clicks proficiency level value (e.g., "3/5")
2. Inline dropdown or star-rating input appears
3. User selects new level (1-5)
4. Frontend calls `POST /api/employees/skills` with `{ employee_id, skill_id, proficiency_level: newValue }`
5. Update succeeds silently (no reload needed — optimistic update)
6. Show brief "Saved" indicator that fades after 1.5s

**States**: idle -> saving (throttled, avoid rapid saves) -> saved (brief confirmation)

#### Flow 3: Add Skill to Employee (Assignment)

1. User clicks "[Add Skill +]" button on Employee Skills tab
2. Modal opens with:
   - Skill selector (searchable dropdown of all skills from `/api/skills` with no category filter)
   - Proficiency level (1-5, star rating or slider, default 3)
   - `is_core` toggle (optional)
3. User selects skill and level, clicks "Assign"
4. Frontend calls `POST /api/employees/skills` with `{ employee_id, skill_id, proficiency_level, is_core }`
5. On success: close modal, refresh employee skill list, show toast

#### Flow 4: Delete Skill from Employee

1. User clicks "[Remove]" button on a skill row
2. Confirmation dialog: "Remove [Skill Name] from [Employee Name]?"
3. User confirms
4. Frontend calls `DELETE /api/employees/skills` with `{ employee_id, skill_id }` in body
5. On success: remove the row from the list (optimistic), show toast

#### Flow 5: Delete Skill (Taxonomy)

1. User clicks "[Delete]" on a skill in Browse Skills tab
2. Confirmation dialog warns: "This will remove [Skill] from all employees who have it. Continue?"
3. User confirms
4. Frontend calls `DELETE /api/skills/{skill_id}`
5. On success: remove from list, show toast

### Component Tree

```
SkillsPage
├── SkillTabs
│   ├── BrowseSkillsTab
│   │   ├── CategorySidebar
│   │   │   ├── CategoryItem (clickable)
│   │   │   └── AddCategoryButton (if skill.manage)
│   │   └── SkillListPanel
│   │       ├── SkillRow
│   │       │   ├── SkillName
│   │       │   ├── EditButton (if skill.manage -> opens SkillFormModal)
│   │       │   └── DeleteButton (if skill.manage -> opens ConfirmDialog)
│   │       └── AddSkillButton (if skill.manage -> opens SkillFormModal)
│   └── EmployeeSkillsTab
│       ├── EmployeeSelector
│       ├── SkillAssignmentList
│       │   ├── SkillRow
│       │   │   ├── SkillName
│       │   │   ├── ProfiencyEditor (inline editable)
│       │   │   └── RemoveButton -> ConfirmDialog
│       │   └── EmptyState
│       └── AddSkillButton -> SkillAssignmentModal
├── SkillFormModal (create/edit skill)
│   ├── SkillNameInput
│   ├── CategoryDropdown
│   ├── DescriptionTextarea
│   └── SaveButton -> loading state
├── SkillAssignmentModal (add skill to employee)
│   ├── SkillSearchableSelect
│   ├── ProficiencySlider
│   ├── IsCoreToggle
│   └── AssignButton -> loading state
├── ConfirmDialog (delete confirmation)
└── Toast (success/error notifications)
```

---

## 4. Analytics Page Tab Switching

### Current State

`StrategicAnalytics.tsx` currently renders three sections vertically on one scrollable page:
1. Attrition risk summary cards + table
2. Skills coverage (gap analysis)
3. No third section (heatmap is fetched but never rendered in a visible component)

### Design: Tabbed Analytics Page

The page should be refactored into four tabs, each loading its data lazily (only when the tab is selected):

```
+------------------------------------------------------+
| Strategic Analytics                                    |
+------------------------------------------------------+
| [Attrition Risk] [Skills Coverage] [Performance] [Org Health] |
+------------------------------------------------------+
| (tab content renders below)                            |
```

### Tab 1: Attrition Risk (default)

What the current page shows: summary cards (total/critical/high/medium), risk table with bar charts, retrain button.

Data endpoints:
- `GET /api/attrition/risk` -> list of {employee_id, full_name, department_name, risk_score}
- `GET /api/attrition/summary` -> {total, critical, high, medium, avg_risk} (optional, could derive from risk)

### Tab 2: Skills Coverage

What the current "Skills Coverage" section shows plus more.

Data endpoints:
- `GET /api/skills/analytics/overview` -> per-category coverage
- `GET /api/skills/analytics/department-comparison` -> department x category heatmap
- `GET /api/skills/gap` -> gap analysis (target vs current)

Renders:
- Coverage bar chart per category
- Department comparison heatmap (grid of dept x category with color-coded cells)
- Gap analysis table

### Tab 3: Performance (NEW)

Requires `performance.view` permission.

Data endpoints:
- `GET /api/performance/summary` -> summary stats per department
- `GET /api/performance/my` -> current user's reviews

Renders:
- Performance score distribution chart
- Department comparison table
- Recent reviews list

### Tab 4: Org Health (NEW)

Requires `analytics.view` permission.

Data endpoints:
- `GET /api/analytics/department-health` -> health scores
- `GET /api/analytics/risk-trends` -> trend data
- `GET /api/analytics/critical-persons` -> critical person alerts

### Implementation Pattern

Use a tab state variable and conditional rendering. Each tab's data loading is wrapped in its own `useEffect` that only fires when the tab is active:

```tsx
const [activeTab, setActiveTab] = useState<'attrition' | 'skills' | 'performance' | 'org'>('attrition')

// Only fetch attrition data when that tab is active
useEffect(() => {
  if (activeTab !== 'attrition') return
  loadAttritionData()
}, [activeTab])
```

This avoids loading all four datasets on mount. Each tab has its own loading/error/empty states.

### Tab Navigation Component

```tsx
const TABS = [
  { key: 'attrition', label: 'Attrition Risk', icon: AlertTriangle, permission: 'analytics.view' },
  { key: 'skills', label: 'Skills Coverage', icon: Target, permission: null },
  { key: 'performance', label: 'Performance', icon: TrendingUp, permission: 'performance.view' },
  { key: 'org', label: 'Org Health', icon: Building2, permission: 'analytics.view' },
]

{tabs
  .filter(tab => !tab.permission || hasPermission(tab.permission))
  .map(tab => (
    <button onClick={() => setActiveTab(tab.key)}>
      <tab.icon /> {tab.label}
    </button>
  ))}
```

---

## 5. Permission Gating

### Backend Permission Model

From `auth_service.py` and `server.py`, each user's JWT token contains a `permissions` array. The backend checks permissions via `_require_permission(user, permission_code)`.

Available permission codes (inferred from server.py usage):
- `user.manage`
- `department.manage`
- `employee.manage`
- `skill.manage`
- `leave.manage`
- `attendance.view`
- `performance.view`
- `performance.manage`
- `analytics.view`
- `audit.view`

### Frontend Component: RequirePermission

Create a new file `frontend-react/src/components/RequirePermission.tsx`:

```tsx
import { ReactNode } from 'react'

interface Props {
  permission: string          // required permission code
  children: ReactNode         // rendered if authorized
  fallback?: ReactNode        // rendered if unauthorized (default: null)
}

export default function RequirePermission({ permission, children, fallback = null }: Props) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  const permissions: string[] = profile.permissions || []
  
  if (!permissions.includes(permission)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}
```

### Hook Version: usePermission

For cases where you need a boolean (e.g., to conditionally disable a button):

```tsx
// frontend-react/src/hooks/usePermission.ts
export function usePermission(permission: string): boolean {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  const permissions: string[] = profile.permissions || []
  return permissions.includes(permission)
}
```

### Usage Examples

**Hide an entire button**:  
```tsx
<RequirePermission permission="skill.manage">
  <button onClick={openSkillForm}>Add Skill</button>
</RequirePermission>
```

**Show a disabled button with explanation**:  
```tsx
<RequirePermission 
  permission="skill.manage" 
  fallback={
    <button disabled className="opacity-50 cursor-not-allowed">
      Add Skill (requires skill.manage)
    </button>
  }
>
  <button onClick={openSkillForm}>Add Skill</button>
</RequirePermission>
```

**Conditionally render a tab**:  
```tsx
{tabs.filter(tab => !tab.permission || permissions.includes(tab.permission)).map(...)}
```

**Hide a navigation item**:  
```tsx
// In Layout.tsx sidebar
{navItems
  .filter(item => !item.permission || hasPermission(item.permission))
  .map(item => (...))}
```

### Permission to Page Mapping

| Page | Required Permission | Fallback Behavior |
|------|-------------------|-------------------|
| DirectoryPage | None (public) | Always accessible |
| ProfileTalentHub | None (public) | Always accessible |
| SkillsPage (browse) | None | Always accessible |
| SkillsPage (create/edit/delete) | `skill.manage` | Hide CRUD buttons |
| OrgManagement | `employee.manage` | Redirect or show "Access Denied" |
| StrategicAnalytics | `analytics.view` | Redirect or show "Access Denied" |
| User Management (future) | `user.manage` | Redirect |
| Attendance (future) | `attendance.view` | Redirect |

### ProtectedRoute Enhancement

Enhance the existing `ProtectedRoute` in `App.tsx` to optionally check permissions:

```tsx
function ProtectedRoute({ children, permission }: { children: React.ReactNode, permission?: string }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  
  if (permission) {
    const profile = JSON.parse(localStorage.getItem('profile') || '{}')
    const permissions: string[] = profile.permissions || []
    if (!permissions.includes(permission)) {
      return <Navigate to="/profile" replace />  // redirect to a safe page
    }
  }
  
  return <>{children}</>
}

// Usage:
<Route path="org" element={<ProtectedRoute permission="employee.manage"><OrgManagement /></ProtectedRoute>} />
<Route path="analytics" element={<ProtectedRoute permission="analytics.view"><StrategicAnalytics /></ProtectedRoute>} />
```

---

## 6. Navigation Sidebar

### Current Sidebar

Layout.tsx lines 12-16 define 4 nav items with duplicate icons (two `User` icons). The sidebar lacks permission gating.

### Redesigned Sidebar

```
+-------------------+
| HRMS              |  <- Logo/brand
| Intelligence      |  <- Tagline
+-------------------+
|                    |
| [User] Profile     |  <- Always visible
| [Users] Directory  |  <- Always visible
| [Building2] Org    |  <- Requires employee.manage
| [BarChart3]        |
|   Analytics        |  <- Requires analytics.view
| [Target] Skills    |  <- Requires skill.manage
| [Calendar] Leave   |  <- Future
| [Clock] Attendance |  <- Future
|                    |
+-------------------+
| [user avatar]      |
| Jane Smith         |  <- Profile info
| admin              |  <- Username
+-------------------+
| [LogOut] Sign out  |
+-------------------+
```

### Nav Items Array (with permissions)

```tsx
const navItems = [
  { to: '/profile', label: 'Profile & Talent', icon: User, permission: null },
  { to: '/directory', label: 'Directory', icon: Users, permission: null },
  { to: '/org', label: 'Organization', icon: Building2, permission: 'employee.manage' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics.view' },
  { to: '/skills', label: 'Skills', icon: Target, permission: null },  // browse is public
]
```

### Icon Selection

Use unique icons from `lucide-react`:

| Nav Item | Icon | Import |
|----------|------|--------|
| Profile & Talent | `User` | Already imported |
| Directory | `Users` | Add to imports |
| Organization | `Building2` | Already imported |
| Analytics | `BarChart3` | Already imported |
| Skills | `Target` | Already imported |
| (sign out) | `LogOut` | Already imported |
| (expand/collapse) | `ChevronLeft` | (optional for collapsible sidebar) |

### Filtered Rendering

```tsx
const profile = JSON.parse(localStorage.getItem('profile') || '{}')
const permissions = profile.permissions || []

const visibleNav = navItems.filter(
  item => !item.permission || permissions.includes(item.permission)
)
```

### Active State

Keep the current `location.pathname === item.to` logic. For nested routes like `/skills/analytics`, use `location.pathname.startsWith(item.to)` to keep the nav item highlighted when inside a sub-page.

---

## 7. State Management Strategy

### Current Patterns

The codebase uses local React state (`useState`) per component. There is no global state management (Redux, Zustand, Context). This is appropriate for the current scale.

### Recommendation: Keep it simple

Do NOT introduce Redux or a state management library at this stage. Use:

1. **localStorage** for authentication state (token, profile) — already done
2. **useState + useEffect** for per-page data fetching — already done
3. **React Context** (optional) for cross-cutting concerns like permissions

```
src/
├── api/
│   └── client.ts         ← centralized API client with auth header
├── hooks/
│   ├── usePermission.ts  ← check if user has a permission
│   └── useDebounce.ts    ← debounce reusable hook (extract from DirectoryPage)
├── components/
│   ├── Layout.tsx        ← sidebar + header + Outlet
│   ├── RequirePermission.tsx  ← permission gating component
│   ├── Spinner.tsx       ← reusable loading spinner
│   ├── EmptyState.tsx    ← reusable empty state
│   └── ErrorBanner.tsx   ← reusable error banner
├── context/
│   └── AuthContext.tsx   ← (future) provide auth state via context
└── pages/
    ├── DirectoryPage.tsx
    ├── ProfileTalentHub.tsx
    ├── SkillsPage.tsx    ← NEW
    ├── OrgManagement.tsx
    ├── StrategicAnalytics.tsx
    └── LoginPage.tsx
```

### Lifting Shared Sub-components

The `Spinner`, `EmptyState`, and `ErrorBanner` components are duplicated across pages (DirectoryPage defines its own, OrgManagement has inline equivalents). Extract them into `components/` for reuse.

---

## 8. Error Handling & Loading Patterns

### Standardized States

Every data-fetching page should handle five states:

| State | Visual | Implementation |
|-------|--------|---------------|
| **Loading** | Spinner centered in content area | Boolean flag before data fetch |
| **Empty** | Icon + descriptive message | Check `data.length === 0` after load |
| **Error** | Red banner with message + retry | Catch block, set error state |
| **Success** | Normal render with data | Default render path |
| **Permission denied** | "Access Denied" message | Check permissions at page entry |

### Pattern Template

```tsx
function DataPage() {
  const [data, setData] = useState<DataType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await get('/endpoint')
      setData(res.data || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />
  if (error) return <ErrorBanner message={error} onRetry={load} />
  if (data.length === 0) return <EmptyState icon={...} message="No data" />

  return <div>{/* data render */}</div>
}
```

---

## 9. Implementation Roadmap

### Phase 1: Infrastructure (est. 1 day)

1. Extract shared components: `Spinner`, `EmptyState`, `ErrorBanner` into `components/`
2. Create `RequirePermission` component
3. Create `usePermission` hook
4. Create `useDebounce` hook (extract from DirectoryPage)
5. Add `Users` icon to Layout imports
6. Add permission filtering to sidebar nav

### Phase 2: Bug Fix + Profile Enhancement (est. 0.5 day)

1. If using `?keyword=` convention: fix server.py line 331 and DirectoryPage.tsx line 183
2. Add phone/email/department/position display to ProfileTalentHub.tsx profile card
3. Add section headers ("Contact", "Organization") with top borders

### Phase 3: Skills Page (est. 1.5 days)

1. Create `SkillsPage.tsx` with tabbed layout (Browse + Employee)
2. Implement skill taxonomy CRUD (create/edit/delete skill + category)
3. Implement employee skill assignment (add/remove skill, edit level)
4. Add permission gating for admin actions
5. Register route in App.tsx

### Phase 4: Analytics Tabs (est. 1 day)

1. Refactor StrategicAnalytics.tsx into tabbed layout
2. Extract AttritionRiskTab, SkillsCoverageTab, PerformanceTab, OrgHealthTab
3. Add lazy data loading per tab
4. Add permission gating per tab

### Phase 5: Polish (est. 0.5 day)

1. Add toast notifications for CRUD operations
2. Add confirmation dialogs for destructive actions
3. Test all loading/error/empty states
4. Verify permission gating end-to-end

---

## Appendix: File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `frontend-react/src/components/RequirePermission.tsx` | **CREATE** | Permission gating component |
| `frontend-react/src/hooks/usePermission.ts` | **CREATE** | Permission check hook |
| `frontend-react/src/hooks/useDebounce.ts` | **CREATE** | Debounce hook extracted from DirectoryPage |
| `frontend-react/src/components/Spinner.tsx` | **CREATE** | Shared loading spinner |
| `frontend-react/src/components/EmptyState.tsx` | **CREATE** | Shared empty state |
| `frontend-react/src/components/ErrorBanner.tsx` | **CREATE** | Shared error banner |
| `frontend-react/src/pages/SkillsPage.tsx` | **CREATE** | New skills management page |
| `frontend-react/src/pages/DirectoryPage.tsx` | **EDIT** | Use shared components; optional ?q= fix |
| `frontend-react/src/pages/ProfileTalentHub.tsx` | **EDIT** | Add phone/email/org fields |
| `frontend-react/src/pages/StrategicAnalytics.tsx` | **EDIT** | Tabbed layout, extract sections |
| `frontend-react/src/components/Layout.tsx` | **EDIT** | Fix nav icons, add permission filtering |
| `frontend-react/src/App.tsx` | **EDIT** | Add SkillsPage route, enhance ProtectedRoute |
| `frontend-react/src/api/client.ts` | **EDIT** | Add skills API methods |
