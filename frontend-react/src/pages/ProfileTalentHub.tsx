import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../api/client'
import { User, Briefcase, TrendingUp, Target } from 'lucide-react'

export default function ProfileTalentHub() {
  const { setTitle } = useOutletContext() as any
  const [skills, setSkills] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedEmp, setSelectedEmp] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { setTitle('Profile & Talent Hub') }, [])

  useEffect(() => {
    (async () => {
      try {
        const [, emps] = await Promise.all([api.profile(), api.employees('page=1&page_size=50')])
        const filtered = (emps.data?.list || []).filter((e: any) => e.employment_status === 'active')
        setEmployees(filtered)
        setSelectedEmp(filtered[0]?.employee_id || null)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    })()
  }, [])

  useEffect(() => {
    if (!selectedEmp) return
    setLoading(true)
    api.getEmployeeBundle(selectedEmp)
      .then(bundle => {
        setSkills(bundle.data?.skills || [])
        setMatches(bundle.data?.position_match || [])
      })
      .catch(() => { setSkills([]); setMatches([]) })
      .finally(() => setLoading(false))
  }, [selectedEmp])

  const emp = employees.find(e => e.employee_id === selectedEmp)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Employee selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-stone-500 font-medium">Employee:</span>
        <select id="profile-employee" name="employee" value={selectedEmp || ''} onChange={e => setSelectedEmp(Number(e.target.value))}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 bg-white">
          {employees.map(e => (
            <option key={e.employee_id} value={e.employee_id}>{e.full_name} - {e.position_name}</option>
          ))}
        </select>
      </div>

      {/* Profile card + Skills */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center">
              <User className="w-5 h-5 text-stone-500" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-800">{emp?.full_name || 'Select an employee'}</h3>
              <p className="text-sm text-stone-500">{emp?.position_name}</p>
            </div>
          </div>
          {emp && (
            <div className="space-y-2 text-sm text-stone-600">
              <div className="flex justify-between"><span className="text-stone-400">Department</span><span>{emp.department_name}</span></div>
              <div className="flex justify-between"><span className="text-stone-400">Status</span><span className="text-green-600 font-medium">{emp.employment_status}</span></div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-stone-500" />
            <h3 className="font-semibold text-stone-800">Skills</h3>
          </div>
          {loading ? <p className="text-sm text-stone-400">Loading...</p> : skills.length === 0 ? <p className="text-sm text-stone-400">No skills data</p> : (
            <div className="space-y-3">
              {skills.map(s => (
                <div key={s.skill_id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-stone-700">{s.skill_name}</span>
                    <span className="text-stone-400">{s.proficiency_level}/5</span>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${s.proficiency_level * 20}%`, backgroundColor: s.is_core ? '#d97706' : '#78716c' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Talent matching */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-4 h-4 text-stone-500" />
          <h3 className="font-semibold text-stone-800">Best-Fit Roles</h3>
        </div>
        {matches.length === 0 ? <p className="text-sm text-stone-400">No matching data</p> : (
          <div className="space-y-2">
            {matches.slice(0, 5).map(m => (
              <div key={m.position_id} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                <span className="text-sm font-medium text-stone-700">{m.position_name}</span>
                <span className={`text-sm font-semibold ${m.match_pct > 70 ? 'text-green-600' : m.match_pct > 40 ? 'text-amber-600' : 'text-stone-400'}`}>
                  {m.match_pct}% match
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
