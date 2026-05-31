import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { X, ChevronRight, User, Target, Briefcase } from 'lucide-react'

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

export default function OrgManagement() {
  const { setTitle } = useOutletContext() as any

  const [departments, setDepartments] = useState<any[]>([])
  const [deptLoading, setDeptLoading] = useState(true)
  const [deptError, setDeptError] = useState('')

  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null)
  const [positions, setPositions] = useState<any[]>([])
  const [posLoading, setPosLoading] = useState(false)
  const [posError, setPosError] = useState('')

  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [empLoading, setEmpLoading] = useState(false)
  const [empError, setEmpError] = useState('')

  const [selectedEmp, setSelectedEmp] = useState<any | null>(null)
  const [empSkills, setEmpSkills] = useState<any[]>([])
  const [empMatches, setEmpMatches] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  useEffect(() => { setTitle('Organization & Team') }, [])

  // Load departments on mount
  useEffect(() => {
    (async () => {
      setDeptLoading(true)
      setDeptError('')
      try {
        const res = await get('/org/departments')
        const list = res.data || []
        setDepartments(list)
        if (list.length > 0) {
          setSelectedDeptId(list[0].department_id)
        }
      } catch (e: any) {
        setDeptError(e.message || 'Failed to load departments')
      } finally {
        setDeptLoading(false)
      }
    })()
  }, [])

  // Load positions when department changes
  useEffect(() => {
    if (!selectedDeptId) return
    ;(async () => {
      setPosLoading(true)
      setPosError('')
      setSelectedPositionId(null)
      setEmployees([])
      try {
        const res = await get('/positions?department_id=' + selectedDeptId)
        const list = res.data || []
        setPositions(list)
        if (list.length > 0) {
          setSelectedPositionId(list[0].position_id)
        }
      } catch (e: any) {
        setPosError(e.message || 'Failed to load positions')
      } finally {
        setPosLoading(false)
      }
    })()
  }, [selectedDeptId])

  // Load employees when position changes
  useEffect(() => {
    if (!selectedPositionId) return
    ;(async () => {
      setEmpLoading(true)
      setEmpError('')
      setSelectedEmp(null)
      try {
        const res = await get('/employees?position_id=' + selectedPositionId)
        setEmployees(res.data?.list || [])
      } catch (e: any) {
        setEmpError(e.message || 'Failed to load employees')
      } finally {
        setEmpLoading(false)
      }
    })()
  }, [selectedPositionId])

  // Load employee detail when selected (bundle API: single call)
  useEffect(() => {
    if (!selectedEmp) return
    ;(async () => {
      setDetailLoading(true)
      setDetailError('')
      try {
        const bundle = await get('/org/employee/' + selectedEmp.employee_id)
        const d = bundle.data || {}
        setEmpSkills(d.skills || [])
        setEmpMatches(d.position_match || [])
      } catch (e: any) {
        setDetailError(e.message || 'Failed to load details')
      } finally {
        setDetailLoading(false)
      }
    })()
  }, [selectedEmp])

  const selectedDept = departments.find(d => d.department_id === selectedDeptId)

  return (
    <div className="flex gap-5 h-full max-w-6xl relative">
      {/* Left: Departments */}
      <div className="w-56 shrink-0 bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100">
          <h3 className="font-semibold text-sm text-stone-700">Departments</h3>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {deptLoading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
            </div>
          )}
          {deptError && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-red-500">{deptError}</p>
            </div>
          )}
          {!deptLoading && !deptError && departments.length === 0 && (
            <p className="text-xs text-stone-400 text-center py-6">No departments</p>
          )}
          {!deptLoading && !deptError && departments.map(d => (
            <button
              key={d.department_id}
              onClick={() => setSelectedDeptId(d.department_id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition ${
                selectedDeptId === d.department_id
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <div className="font-medium">{d.department_name}</div>
              <div className={`text-xs mt-0.5 ${selectedDeptId === d.department_id ? 'text-stone-400' : 'text-stone-400'}`}>
                {d.headcount || 0} members
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Positions + Employees */}
      <div className="flex-1 flex flex-col gap-5 min-w-0">
        {/* Positions */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200">
          <div className="px-5 py-3 border-b border-stone-100">
            <h3 className="font-semibold text-sm text-stone-700">
              {selectedDept ? selectedDept.department_name : 'Positions'}
            </h3>
          </div>
          <div className="p-3">
            {posLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              </div>
            )}
            {posError && <p className="text-xs text-red-500 text-center py-4">{posError}</p>}
            {!posLoading && !posError && positions.length === 0 && (
              <p className="text-xs text-stone-400 text-center py-4">No positions in this department</p>
            )}
            {!posLoading && !posError && positions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {positions.map(p => (
                  <button
                    key={p.position_id}
                    onClick={() => setSelectedPositionId(p.position_id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      selectedPositionId === p.position_id
                        ? 'bg-stone-800 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {p.position_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Employees */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100">
            <h3 className="font-semibold text-sm text-stone-700">Team Members</h3>
          </div>
          <div className="overflow-auto p-3">
            {empLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              </div>
            )}
            {empError && <p className="text-xs text-red-500 text-center py-8">{empError}</p>}
            {!empLoading && !empError && employees.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <User className="w-8 h-8 text-stone-300 mb-2" />
                <p className="text-sm text-stone-400">No employees for this position</p>
              </div>
            )}
            {!empLoading && !empError && employees.length > 0 && (
              <div className="space-y-1">
                {employees.map(e => (
                  <button
                    key={e.employee_id}
                    onClick={() => setSelectedEmp(e)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition ${
                      selectedEmp?.employee_id === e.employee_id
                        ? 'bg-stone-100'
                        : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center">
                        <User className="w-4 h-4 text-stone-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-700">{e.full_name}</p>
                        <p className="text-xs text-stone-400">{e.position_name}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide-out panel */}
      {selectedEmp && (
        <>
          <div className="fixed inset-0 bg-black/20 z-10" onClick={() => setSelectedEmp(null)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white rounded-xl shadow-lg border border-stone-200 z-20 overflow-auto">
            <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-stone-700">Employee Details</h3>
              <button onClick={() => setSelectedEmp(null)} className="p-1 rounded hover:bg-stone-100 transition">
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Profile */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center">
                  <User className="w-5 h-5 text-stone-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-stone-800">{selectedEmp.full_name}</h4>
                  <p className="text-sm text-stone-500">{selectedEmp.position_name}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-stone-600">
                <div className="flex justify-between">
                  <span className="text-stone-400">Department</span>
                  <span>{selectedEmp.department_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Status</span>
                  <span className="text-green-600 font-medium">{selectedEmp.employment_status}</span>
                </div>
              </div>

              {/* Skills */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-stone-500" />
                  <h4 className="font-semibold text-sm text-stone-700">Skills</h4>
                </div>
                {detailLoading && (
                  <div className="flex justify-center py-4">
                    <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                  </div>
                )}
                {detailError && <p className="text-xs text-red-500">{detailError}</p>}
                {!detailLoading && !detailError && empSkills.length === 0 && (
                  <p className="text-xs text-stone-400">No skills data</p>
                )}
                {!detailLoading && !detailError && empSkills.length > 0 && (
                  <div className="space-y-3">
                    {empSkills.map(s => (
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

              {/* Best-fit roles */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="w-4 h-4 text-stone-500" />
                  <h4 className="font-semibold text-sm text-stone-700">Best-Fit Roles</h4>
                </div>
                {detailLoading && (
                  <div className="flex justify-center py-4">
                    <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                  </div>
                )}
                {!detailLoading && empMatches.length === 0 && (
                  <p className="text-xs text-stone-400">No matching data</p>
                )}
                {!detailLoading && empMatches.length > 0 && (
                  <div className="space-y-2">
                    {empMatches.slice(0, 5).map(m => (
                      <div key={m.position_id} className="flex items-center justify-between py-1.5 border-b border-stone-50 last:border-0">
                        <span className="text-xs font-medium text-stone-600">{m.position_name}</span>
                        <span className={`text-xs font-semibold ${
                          m.match_pct > 70 ? 'text-green-600' : m.match_pct > 40 ? 'text-amber-600' : 'text-stone-400'
                        }`}>
                          {m.match_pct}%
                        </span>
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
