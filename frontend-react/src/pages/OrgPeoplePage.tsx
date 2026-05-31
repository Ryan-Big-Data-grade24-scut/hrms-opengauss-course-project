import { useEffect, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import {
  X,
  Search,
  User,
  ChevronRight,
  ChevronDown,
  Building2,
  Phone,
  Mail,
  Target,
  Briefcase,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
} from 'lucide-react'

const BASE = '/api'

async function get(path: string) {
  const token = localStorage.getItem('token')
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DeptNode {
  department_id: number
  department_name: string
  parent_department_id: number | null
  manager_name: string | null
  headcount: number
  level: number
}

interface EmployeeSummary {
  employee_id: number
  employee_no: string
  full_name: string
  phone?: string
  email?: string
  hire_date?: string
  employment_status?: string
  position_id?: number
  position_name?: string
  department_id?: number
  department_name?: string
  job_grade?: string
}

interface PositionTag {
  position_id: number
  position_name: string
  department_id: number
  department_name: string
  employee_count: number
}

interface SkillData {
  skill_id: number
  skill_name: string
  category_name?: string
  proficiency_level: number
  is_core?: boolean
  acquired_from?: string
}

interface ProfileBasic {
  employee_id: number
  employee_no: string
  full_name: string
  phone?: string
  email?: string
  hire_date?: string
  employment_status?: string
  position_id?: number
  position_name?: string
  department_id?: number
  department_name?: string
  job_grade?: string
  manager_name?: string | null
  manager_employee_id?: number | null
  emergency_contact_name?: string
  emergency_contact_phone?: string
}

interface AuditLogEntry {
  audit_id: number
  action_type: string
  target_type: string
  action_detail?: string
  created_at: string
  actor_name?: string
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
    </div>
  )
}

function EmptyState({ icon: Icon, message, action }: { icon: any; message: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Icon className="w-10 h-10 text-stone-300 mb-3" />
      <p className="text-sm text-stone-400 mb-3">{message}</p>
      {action && (
        <button onClick={action.onClick} className="text-xs text-stone-600 underline hover:text-stone-800 transition">
          {action.label}
        </button>
      )}
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
      <p className="text-sm text-red-600">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-red-500 underline hover:text-red-700 shrink-0 ml-3">
          Retry
        </button>
      )}
    </div>
  )
}

function SkeletonBar({ width = '100%' }: { width?: string }) {
  return <div className="h-3 bg-stone-100 rounded animate-pulse" style={{ width }} />
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function OrgPeoplePage() {
  const { setTitle } = useOutletContext() as any
  const [searchParams, setSearchParams] = useSearchParams()

  /* ---- Department tree ---- */
  const [treeFlat, setTreeFlat] = useState<DeptNode[]>([])
  const [treeLoading, setTreeLoading] = useState(true)
  const [treeError, setTreeError] = useState('')
  const [expandedDepts, setExpandedDepts] = useState<Set<number>>(new Set())
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null)

  /* ---- Position tags ---- */
  const [positions, setPositions] = useState<PositionTag[]>([])
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null)

  /* ---- Employee cards ---- */
  const [employees, setEmployees] = useState<EmployeeSummary[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [employeesError, setEmployeesError] = useState('')

  /* ---- Search ---- */
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [searchResults, setSearchResults] = useState<EmployeeSummary[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  /* ---- Profile panel ---- */
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null)
  const [profile, setProfile] = useState<{
    basic?: ProfileBasic
    skills?: SkillData[]
    recent_logs?: AuditLogEntry[]
    attrition_risk?: any
  } | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  /* ---- Derived state ---- */
  const isSearching = debouncedQuery.trim().length > 0
  const rootNodes = treeFlat.filter(n => n.parent_department_id === null)
  const childrenMap = new Map<number, DeptNode[]>()
  for (const node of treeFlat) {
    const pid = node.parent_department_id
    if (pid !== null) {
      if (!childrenMap.has(pid)) childrenMap.set(pid, [])
      childrenMap.get(pid)!.push(node)
    }
  }

  /* ---- Init ---- */
  useEffect(() => { setTitle('Organisation & People') }, [])

  // Check URL param for auto-select employee
  useEffect(() => {
    const empId = searchParams.get('empId')
    if (empId) {
      setSelectedEmpId(parseInt(empId, 10))
    }
  }, [searchParams])

  /* ---- Fetch department tree ---- */
  useEffect(() => {
    ;(async () => {
      setTreeLoading(true)
      setTreeError('')
      try {
        const res = await get('/org-people/tree')
        setTreeFlat(res.data || [])
        const flat = res.data || []
        // Auto-expand root nodes
        setExpandedDepts(new Set(flat.filter(n => n.parent_department_id === null).map(n => n.department_id)))
        // Auto-select first root
        const roots = flat.filter((n: DeptNode) => n.parent_department_id === null)
        if (roots.length > 0) {
          setSelectedDeptId(roots[0].department_id)
        }
      } catch (e: any) {
        setTreeError(e.message || 'Failed to load organisation tree')
      } finally {
        setTreeLoading(false)
      }
    })()
  }, [])

  /* ---- Fetch positions when department changes ---- */
  useEffect(() => {
    if (!selectedDeptId || isSearching) return
    ;(async () => {
      setPositionsLoading(true)
      try {
        const res = await get(`/org-people/positions?department_id=${selectedDeptId}`)
        setPositions(res.data || [])
      } catch {
        setPositions([])
      } finally {
        setPositionsLoading(false)
      }
    })()
  }, [selectedDeptId, isSearching])

  /* ---- Fetch employees when department/position changes ---- */
  useEffect(() => {
    if (!selectedDeptId || isSearching) return
    ;(async () => {
      setEmployeesLoading(true)
      setEmployeesError('')
      try {
        let url = `/org-people/employees?department_id=${selectedDeptId}`
        if (selectedPositionId) url += `&position_id=${selectedPositionId}`
        const res = await get(url)
        setEmployees(res.data || [])
      } catch (e: any) {
        setEmployeesError(e.message || 'Failed to load employees')
      } finally {
        setEmployeesLoading(false)
      }
    })()
  }, [selectedDeptId, selectedPositionId, isSearching])

  /* ---- Debounce search ---- */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebouncedQuery(query) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  /* ---- Execute search ---- */
  useEffect(() => {
    if (!isSearching) { setSearchResults([]); return }
    ;(async () => {
      setSearchLoading(true)
      try {
        const res = await get(`/org-people/search?q=${encodeURIComponent(debouncedQuery)}`)
        setSearchResults(res.data || [])
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    })()
  }, [debouncedQuery])

  /* ---- Fetch profile ---- */
  useEffect(() => {
    if (!selectedEmpId) return
    ;(async () => {
      setProfileLoading(true)
      setProfileError('')
      try {
        const res = await get(`/org-people/employee/${selectedEmpId}/profile`)
        setProfile(res.data || null)
      } catch (e: any) {
        setProfileError(e.message || 'Failed to load profile')
      } finally {
        setProfileLoading(false)
      }
    })()
  }, [selectedEmpId])

  /* ---- Handlers ---- */
  const toggleExpand = (deptId: number) => {
    setExpandedDepts(prev => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }

  const selectDept = (deptId: number) => {
    setSelectedDeptId(deptId)
    setSelectedPositionId(null)
    setQuery('')
    setDebouncedQuery('')
    setSelectedEmpId(null)
    setProfile(null)
  }

  const selectPosition = (posId: number | null) => {
    setSelectedPositionId(posId)
    setSelectedEmpId(null)
    setProfile(null)
  }

  const selectEmployee = (empId: number) => {
    setSelectedEmpId(empId)
    setSearchParams(prev => { prev.set('empId', String(empId)); return prev })
  }

  const clearSearch = () => {
    setQuery('')
    setDebouncedQuery('')
  }

  const closeProfile = () => {
    setSelectedEmpId(null)
    setProfile(null)
    setSearchParams(prev => { prev.delete('empId'); return prev })
  }

  /* ---- Render tree node recursively ---- */
  const renderTreeNode = (node: DeptNode) => {
    const children = childrenMap.get(node.department_id) || []
    const isExpanded = expandedDepts.has(node.department_id)
    const isSelected = selectedDeptId === node.department_id
    const hasChildren = children.length > 0

    return (
      <div key={node.department_id}>
        <button
          onClick={() => { selectDept(node.department_id) }}
          className={`w-full flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition text-left ${
            isSelected ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          {/* Expand toggle */}
          {hasChildren ? (
            <span
              onClick={(e) => { e.stopPropagation(); toggleExpand(node.department_id) }}
              className="p-0.5 rounded hover:bg-stone-200 shrink-0"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <Building2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
          <span className="flex-1 truncate">{node.department_name}</span>
          <span className={`text-xs font-mono ${isSelected ? 'text-stone-400' : 'text-stone-400'}`}>
            {node.headcount}
          </span>
        </button>
        {isExpanded && hasChildren && (
          <div className="ml-4 border-l border-stone-200 pl-2 mt-0.5 space-y-0.5">
            {children.map(renderTreeNode)}
          </div>
        )}
      </div>
    )
  }

  /* ---- Display employees (search or browse) ---- */
  const displayEmployees = isSearching ? searchResults : employees
  const displayLoading = isSearching ? searchLoading : employeesLoading
  const displayError = isSearching ? '' : employeesError

  return (
    <div className="flex gap-5 h-full max-w-7xl relative">
      {/* ================================================================ */}
      {/* LEFT: Department tree */}
      {/* ================================================================ */}
      <div className="w-56 shrink-0 bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100">
          <h3 className="font-semibold text-sm text-stone-700">Departments</h3>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-0.5">
          {treeLoading && (
            <div className="px-3 py-6 space-y-3">
              <SkeletonBar width="80%" />
              <SkeletonBar width="60%" />
              <SkeletonBar width="70%" />
              <SkeletonBar width="50%" />
              <SkeletonBar width="65%" />
            </div>
          )}
          {treeError && <ErrorBanner message={treeError} />}
          {!treeLoading && !treeError && treeFlat.length === 0 && (
            <EmptyState icon={Building2} message="No organisation data" action={{ label: 'Import departments', onClick: () => {} }} />
          )}
          {!treeLoading && !treeError && treeFlat.length > 0 && (
            rootNodes.map(renderTreeNode)
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* CENTER: Search + position tags + employee cards */}
      {/* ================================================================ */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Search bar */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200">
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, position, department, skill..."
                className="w-full pl-9 pr-8 py-2 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400 transition bg-stone-50"
              />
              {query && (
                <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-stone-200 transition">
                  <X className="w-3.5 h-3.5 text-stone-400" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Position tag bar (only when not searching) */}
        {!isSearching && (
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => selectPosition(null)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                  selectedPositionId === null ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All
              </button>
              {positionsLoading && (
                <div className="flex gap-2">
                  <SkeletonBar width="60px" />
                  <SkeletonBar width="70px" />
                  <SkeletonBar width="50px" />
                </div>
              )}
              {!positionsLoading && positions.map(pos => (
                <button
                  key={pos.position_id}
                  onClick={() => selectPosition(pos.position_id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    selectedPositionId === pos.position_id ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {pos.position_name}
                  <span className="ml-1.5 opacity-60">({pos.employee_count})</span>
                </button>
              ))}
              {!positionsLoading && positions.length === 0 && (
                <span className="text-xs text-stone-400">No positions for this department</span>
              )}
            </div>
          </div>
        )}

        {/* Section title */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-700">
            {isSearching
              ? `Search results (${searchResults.length})`
              : selectedDeptId
              ? `${treeFlat.find(n => n.department_id === selectedDeptId)?.department_name || ''} (${displayEmployees.length})`
              : 'All employees'}
          </h3>
        </div>

        {/* Employee cards */}
        {displayLoading && <Spinner />}
        {displayError && <ErrorBanner message={displayError} />}
        {!displayLoading && !displayError && isSearching && searchResults.length === 0 && (
          <EmptyState icon={Search} message="No employees match your search" action={{ label: 'Clear search', onClick: clearSearch }} />
        )}
        {!displayLoading && !displayError && !isSearching && selectedDeptId && displayEmployees.length === 0 && (
          <EmptyState icon={User} message="No employees in this department" />
        )}
        {!displayLoading && !displayError && displayEmployees.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {displayEmployees.map(emp => (
              <button
                key={emp.employee_id}
                onClick={() => selectEmployee(emp.employee_id)}
                className={`bg-white rounded-xl shadow-sm border border-stone-200 p-4 text-left transition hover:shadow-md hover:-translate-y-0.5 ${
                  selectedEmpId === emp.employee_id ? 'ring-2 ring-stone-400 bg-stone-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-stone-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-700 truncate">{emp.full_name}</p>
                    <p className="text-xs text-stone-400 truncate">{emp.position_name || 'N/A'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-stone-400">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{emp.department_name || ''}</span>
                  </div>
                  {emp.job_grade && (
                    <span className="text-xs font-mono bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{emp.job_grade}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* RIGHT: Profile panel (slide-out on smaller screens, inline on wide) */}
      {/* ================================================================ */}
      {selectedEmpId && (
        <>
          {/* Overlay for mobile */}
          <div className="hidden max-lg:block fixed inset-0 bg-black/20 z-10" onClick={closeProfile} />
          <div className="w-80 shrink-0 bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col overflow-hidden max-lg:fixed max-lg:right-4 max-lg:top-20 max-lg:bottom-4 max-lg:z-20 max-lg:w-80">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-3 flex items-center justify-between z-10">
              <h3 className="font-semibold text-sm text-stone-700">Profile</h3>
              <button onClick={closeProfile} className="p-1 rounded hover:bg-stone-100 transition">
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-5">
              {profileLoading && <Spinner />}
              {profileError && <ErrorBanner message={profileError} />}

              {!profileLoading && !profileError && profile && (
                <>
                  {/* Block 1: Basic info */}
                  {profile.basic && (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-14 h-14 rounded-full bg-stone-200 flex items-center justify-center shrink-0">
                          <User className="w-7 h-7 text-stone-500" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-stone-800 text-base truncate">{profile.basic.full_name}</h4>
                          <p className="text-xs text-stone-400">{profile.basic.employee_no}</p>
                          <p className="text-sm text-stone-500 truncate">{profile.basic.position_name} &middot; {profile.basic.department_name}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {profile.basic.job_grade && (
                          <span className="text-xs font-mono bg-stone-100 text-stone-500 px-2 py-1 rounded">{profile.basic.job_grade}</span>
                        )}
                        {profile.basic.hire_date && (
                          <span className="text-xs text-stone-400 bg-stone-50 px-2 py-1 rounded">
                            Hired {profile.basic.hire_date?.slice(0, 10)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Block 2: Contact */}
                  {profile.basic && (profile.basic.phone || profile.basic.email || profile.basic.emergency_contact_name) && (
                    <div>
                      <h5 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Contact</h5>
                      <div className="space-y-2 text-sm text-stone-600">
                        {profile.basic.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>{profile.basic.phone}</span>
                          </div>
                        )}
                        {profile.basic.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span className="truncate">{profile.basic.email}</span>
                          </div>
                        )}
                        {profile.basic.manager_name && (
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>Reports to: {profile.basic.manager_name}</span>
                          </div>
                        )}
                        {profile.basic.emergency_contact_name && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>Emergency: {profile.basic.emergency_contact_name} {profile.basic.emergency_contact_phone || ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Block 3: Skills */}
                  {profile.skills && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-4 h-4 text-stone-500" />
                        <h5 className="font-semibold text-sm text-stone-700">Skills</h5>
                      </div>
                      {profile.skills.length === 0 ? (
                        <p className="text-xs text-stone-400">No skills recorded</p>
                      ) : (
                        <div className="space-y-3">
                          {profile.skills.map(s => (
                            <div key={s.skill_id}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-stone-600">{s.skill_name}</span>
                                <span className="text-stone-400">{s.proficiency_level}/5</span>
                              </div>
                              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${s.proficiency_level * 20}%`,
                                    backgroundColor: s.is_core ? '#d97706' : '#78716c',
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Block 4: Attrition risk */}
                  {profile.attrition_risk && (
                    <div className="p-3 rounded-lg bg-stone-50 border border-stone-100">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-stone-500" />
                        <h5 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Attrition Risk</h5>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-bold ${
                          profile.attrition_risk.risk_level === 'critical' ? 'text-red-600' :
                          profile.attrition_risk.risk_level === 'high' ? 'text-amber-600' :
                          profile.attrition_risk.risk_level === 'medium' ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {(profile.attrition_risk.risk_level || 'N/A').toUpperCase()}
                        </span>
                      </div>
                      <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            (profile.attrition_risk.risk_score_pct || 0) >= 70 ? 'bg-red-500' :
                            (profile.attrition_risk.risk_score_pct || 0) >= 50 ? 'bg-amber-500' :
                            (profile.attrition_risk.risk_score_pct || 0) >= 30 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(profile.attrition_risk.risk_score_pct || 0, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-stone-400 mt-1">
                        Score: {profile.attrition_risk.risk_score_pct?.toFixed(1) || 'N/A'}%
                      </p>
                    </div>
                  )}

                  {/* Block 5: Recent logs */}
                  {profile.recent_logs && profile.recent_logs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-stone-500" />
                        <h5 className="font-semibold text-sm text-stone-700">Recent Activity</h5>
                      </div>
                      <div className="space-y-2">
                        {profile.recent_logs.slice(0, 5).map(log => (
                          <div key={log.audit_id} className="text-xs text-stone-500 border-l-2 border-stone-200 pl-3 py-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-stone-400">{log.created_at?.slice(0, 16)}</span>
                              <span className="font-medium text-stone-600">{log.action_type}</span>
                            </div>
                            {log.action_detail && <p className="text-stone-400 mt-0.5 truncate">{log.action_detail}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {!profileLoading && !profileError && !profile && (
                <EmptyState icon={User} message="Select an employee to view profile" />
              )}
            </div>
          </div>
        </>
      )}

      {/* Empty right panel when no employee selected */}
      {!selectedEmpId && (
        <div className="w-80 shrink-0 bg-white rounded-xl shadow-sm border border-stone-200 flex items-center justify-center max-lg:hidden">
          <div className="text-center p-6">
            <User className="w-10 h-10 text-stone-200 mx-auto mb-3" />
            <p className="text-sm text-stone-400">Select an employee</p>
            <p className="text-xs text-stone-300 mt-1">to view their profile</p>
          </div>
        </div>
      )}
    </div>
  )
}
