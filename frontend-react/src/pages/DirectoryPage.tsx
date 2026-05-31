import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  X,
  Search,
  User,
  Briefcase,
  ChevronRight,
  Phone,
  Mail,
  Building2,
  Target,
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

interface DepartmentNode {
  department_name: string
  headcount: number
  employees: EmployeeSummary[]
}

interface EmployeeSummary {
  employee_id: number
  full_name: string
  position_name?: string
  department_name?: string
  phone?: string
  email?: string
  employment_status?: string
}

interface SkillData {
  skill_id: number
  skill_name: string
  proficiency_level: number
  is_core: boolean
}

interface FilterItem {
  department_id?: number
  department_name?: string
  position_id?: number
  position_name?: string
}

interface FilterData {
  departments: FilterItem[]
  positions: FilterItem[]
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
    </div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Icon className="w-8 h-8 text-stone-300 mb-2" />
      <p className="text-sm text-stone-400">{message}</p>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
      <p className="text-sm text-red-600">{message}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function DirectoryPage() {
  const { setTitle } = useOutletContext() as any

  /* ---- Tree / department data ---- */
  const [tree, setTree] = useState<DepartmentNode[]>([])
  const [treeLoading, setTreeLoading] = useState(true)
  const [treeError, setTreeError] = useState('')
  const [selectedDept, setSelectedDept] = useState<string | null>(null)

  /* ---- Search ---- */
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ---- Search results ---- */
  const [searchResults, setSearchResults] = useState<EmployeeSummary[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  /* ---- Filters ---- */
  const [filters, setFilters] = useState<FilterData>({ departments: [], positions: [] })
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null)
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string | null>(null)

  /* ---- Slide-out detail ---- */
  const [selectedEmp, setSelectedEmp] = useState<EmployeeSummary | null>(null)
  const [empSkills, setEmpSkills] = useState<SkillData[]>([])
  const [empDetail, setEmpDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  /* ---- Derived mode ---- */
  const isSearching = debouncedQuery.trim().length > 0

  /* ---- Set title ---- */
  useEffect(() => {
    setTitle('Directory')
  }, [])

  /* ---- Fetch tree on mount ---- */
  useEffect(() => {
    ;(async () => {
      setTreeLoading(true)
      setTreeError('')
      try {
        const res = await get('/directory/tree')
        const list: DepartmentNode[] = res.data || []
        setTree(list)
        if (list.length > 0) {
          setSelectedDept(list[0].department_name)
        }
      } catch (e: any) {
        setTreeError(e.message || 'Failed to load directory')
      } finally {
        setTreeLoading(false)
      }
    })()
  }, [])

  /* ---- Fetch filters on mount ---- */
  useEffect(() => {
    ;(async () => {
      try {
        const res = await get('/directory/filters')
        setFilters(res.data || { departments: [], positions: [] })
      } catch {
        // non-critical
      }
    })()
  }, [])

  /* ---- Debounce search input ---- */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  /* ---- Execute search ---- */
  useEffect(() => {
    if (!isSearching) {
      setSearchResults([])
      return
    }
    ;(async () => {
      setSearchLoading(true)
      setSearchError('')
      try {
        const res = await get('/directory/search?q=' + encodeURIComponent(debouncedQuery))
        setSearchResults(res.data || [])
      } catch (e: any) {
        setSearchError(e.message || 'Search failed')
      } finally {
        setSearchLoading(false)
      }
    })()
  }, [debouncedQuery])

  /* ---- Fetch employee details when slide-out opens (bundle API) ---- */
  useEffect(() => {
    if (!selectedEmp) return
    ;(async () => {
      setDetailLoading(true)
      setDetailError('')
      try {
        const bundle = await get('/org/employee/' + selectedEmp.employee_id)
        const d = bundle.data || {}
        setEmpSkills(d.skills || [])
        setEmpDetail({
          phone: d.employee?.phone,
          email: d.employee?.email,
          full_name: d.employee?.full_name,
          position_name: d.employee?.position_name,
          department_name: d.employee?.department_name,
          manager_name: d.employee?.manager_name,
          hire_date: d.employee?.hire_date,
          attrition_risk: d.attrition_risk,
          position_match: d.position_match,
          reporting: d.reporting,
        })
      } catch (e: any) {
        setDetailError(e.message || 'Failed to load details')
      } finally {
        setDetailLoading(false)
      }
    })()
  }, [selectedEmp])

  /* ---- Derived employee list ---- */
  const employees: EmployeeSummary[] = isSearching
    ? searchResults.filter((e) => {
        if (selectedDeptFilter && e.department_name !== selectedDeptFilter) return false
        if (selectedPosition && e.position_name !== selectedPosition) return false
        return true
      })
    : tree.find((d) => d.department_name === selectedDept)?.employees || []

  /* ---- Handlers ---- */
  const handleSelectDept = (name: string) => {
    setSelectedDept(name)
    setQuery('')
    setDebouncedQuery('')
    setSelectedDeptFilter(null)
    setSelectedPosition(null)
  }

  const handleClearSearch = () => {
    setQuery('')
    setDebouncedQuery('')
    setSelectedDeptFilter(null)
    setSelectedPosition(null)
  }

  const handleCloseDetail = () => {
    setSelectedEmp(null)
    setEmpSkills([])
  }

  /* ---- Determine search mode status for UI ---- */
  const effectiveDept = isSearching ? selectedDeptFilter : selectedDept
  const activeFiltersCount =
    (selectedDeptFilter ? 1 : 0) + (selectedPosition ? 1 : 0)

  return (
    <div className="flex gap-5 h-full max-w-7xl relative">
      {/* LEFT: Department list */}
      <div className="w-56 shrink-0 bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100">
          <h3 className="font-semibold text-sm text-stone-700">Departments</h3>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {treeLoading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
            </div>
          )}
          {treeError && (
            <ErrorBanner message={treeError} />
          )}
          {!treeLoading && !treeError && tree.length === 0 && (
            <p className="text-xs text-stone-400 text-center py-6">No departments</p>
          )}
          {!treeLoading &&
            !treeError &&
            tree.map((d) => (
              <button
                key={d.department_name}
                onClick={() => handleSelectDept(d.department_name)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition ${
                  selectedDept === d.department_name && !isSearching
                    ? 'bg-stone-800 text-white'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <div className="font-medium">{d.department_name}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    selectedDept === d.department_name && !isSearching
                      ? 'text-stone-400'
                      : 'text-stone-400'
                  }`}
                >
                  {d.headcount} members
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* CENTER: Search + filters + employee grid */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Search bar */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200">
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                id="dir-search" name="search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, department, or position..."
                className="w-full pl-9 pr-8 py-2 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400 transition bg-stone-50"
              />
              {query && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-stone-200 transition"
                >
                  <X className="w-3.5 h-3.5 text-stone-400" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter chips */}
        {isSearching && (
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-stone-400 uppercase tracking-wider mr-1">
                Filters
              </span>

              {/* Department chips */}
              {filters.departments.map((dept) => {
                const name = dept.department_name || dept
                return (
                  <button
                    key={name}
                    onClick={() =>
                      setSelectedDeptFilter(
                        selectedDeptFilter === name ? null : name
                      )
                    }
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                      selectedDeptFilter === name
                        ? 'bg-stone-800 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}

              {/* Position chips */}
              {filters.positions.map((pos) => {
                const name = pos.position_name || pos
                return (
                  <button
                    key={name}
                    onClick={() =>
                      setSelectedPosition(
                        selectedPosition === name ? null : name
                      )
                    }
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                      selectedPosition === name
                        ? 'bg-stone-800 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}

              {/* Active filter count */}
              {activeFiltersCount > 0 && (
                <span className="text-xs text-stone-400 ml-1">
                  ({activeFiltersCount} active)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Title bar */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-700">
            {isSearching
              ? `Search Results (${searchResults.length})`
              : effectiveDept
              ? `${effectiveDept} (${employees.length})`
              : 'All Employees'}
          </h3>
        </div>

        {/* Employee cards */}
        {searchLoading && <Spinner />}
        {searchError && <ErrorBanner message={searchError} />}
        {!searchLoading && !searchError && isSearching && searchResults.length === 0 && (
          <EmptyState
            icon={Search}
            message="No employees match your search"
          />
        )}
        {!isSearching && tree.length > 0 && employees.length === 0 && (
          <EmptyState icon={User} message="No employees in this department" />
        )}
        {!searchLoading &&
          !searchError &&
          employees.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {employees.map((emp) => (
                <button
                  key={emp.employee_id}
                  onClick={() => setSelectedEmp(emp)}
                  className={`bg-white rounded-xl shadow-sm border border-stone-200 p-4 text-left transition hover:shadow-md ${
                    selectedEmp?.employee_id === emp.employee_id
                      ? 'ring-2 ring-stone-400'
                      : ''
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
                  {emp.department_name && (
                    <div className="flex items-center gap-1.5 mt-2.5 text-xs text-stone-400">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{emp.department_name}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
      </div>

      {/* RIGHT: Slide-out employee detail panel */}
      {selectedEmp && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/20 z-10"
            onClick={handleCloseDetail}
          />
          {/* Drawer */}
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white rounded-xl shadow-lg border border-stone-200 z-20 overflow-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-3 flex items-center justify-between z-10">
              <h3 className="font-semibold text-sm text-stone-700">Employee Details</h3>
              <button
                onClick={handleCloseDetail}
                className="p-1 rounded hover:bg-stone-100 transition"
              >
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Identity */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-stone-500" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-stone-800 truncate">
                    {selectedEmp.full_name}
                  </h4>
                  <p className="text-sm text-stone-500 truncate">
                    {selectedEmp.position_name || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Contact & info — use empDetail (bundle API) when available */}
              <div className="space-y-2.5 text-sm text-stone-600">
                {selectedEmp.department_name && (
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-stone-400 shrink-0" />
                    <span>{selectedEmp.department_name}</span>
                  </div>
                )}
                {(empDetail?.phone || selectedEmp.phone) && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-stone-400 shrink-0" />
                    <span>{empDetail?.phone || selectedEmp.phone}</span>
                  </div>
                )}
                {(empDetail?.email || selectedEmp.email) && (
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-stone-400 shrink-0" />
                    <span className="truncate">{empDetail?.email || selectedEmp.email}</span>
                  </div>
                )}
                {empDetail?.manager_name && (
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="w-4 h-4 text-stone-400 shrink-0" />
                    <span>Manager: {empDetail.manager_name}</span>
                  </div>
                )}
                {selectedEmp.employment_status && (
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="w-4 h-4 text-stone-400 shrink-0" />
                    <span
                      className={
                        selectedEmp.employment_status === 'active'
                          ? 'text-green-600 font-medium'
                          : undefined
                      }
                    >
                      {selectedEmp.employment_status}
                    </span>
                  </div>
                )}
              </div>

              {/* Attrition risk */}
              {empDetail?.attrition_risk && (
                <div className="p-3 rounded-lg bg-stone-50 border border-stone-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-stone-500 font-medium">Attrition Risk</span>
                    <span className={`text-xs font-bold ${
                      empDetail.attrition_risk.risk_level === 'critical' ? 'text-red-600' :
                      empDetail.attrition_risk.risk_level === 'high' ? 'text-amber-600' :
                      empDetail.attrition_risk.risk_level === 'medium' ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>{empDetail.attrition_risk.risk_level?.toUpperCase()}</span>
                  </div>
                  <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${
                      (empDetail.attrition_risk.risk_score_pct || 0) >= 70 ? 'bg-red-500' :
                      (empDetail.attrition_risk.risk_score_pct || 0) >= 50 ? 'bg-amber-500' :
                      (empDetail.attrition_risk.risk_score_pct || 0) >= 30 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`} style={{ width: `${Math.min(empDetail.attrition_risk.risk_score_pct || 0, 100)}%` }} />
                  </div>
                  <p className="text-xs text-stone-400 mt-1">
                    Score: {empDetail.attrition_risk.risk_score_pct?.toFixed(1) || 'N/A'}%
                  </p>
                </div>
              )}

              {/* Skills */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-stone-500" />
                  <h4 className="font-semibold text-sm text-stone-700">
                    Skills
                  </h4>
                </div>
                {detailLoading && (
                  <div className="flex justify-center py-6">
                    <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                  </div>
                )}
                {detailError && <p className="text-xs text-red-500">{detailError}</p>}
                {!detailLoading && !detailError && empSkills.length === 0 && (
                  <p className="text-xs text-stone-400">No skills data</p>
                )}
                {!detailLoading &&
                  !detailError &&
                  empSkills.length > 0 && (
                    <div className="space-y-3">
                      {empSkills.map((s) => (
                        <div key={s.skill_id}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-stone-600">
                              {s.skill_name}
                            </span>
                            <span className="text-stone-400">
                              {s.proficiency_level}/5
                            </span>
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
            </div>
          </div>
        </>
      )}
    </div>
  )
}
