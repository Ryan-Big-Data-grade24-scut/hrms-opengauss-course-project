import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../api/client'
import { Plus, X, Briefcase, Target, BookOpen, Sparkles, Trash2 } from 'lucide-react'

export default function SkillsPage() {
  const { setTitle } = useOutletContext() as any
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedEmp, setSelectedEmp] = useState<number | null>(null)
  const [skills, setSkills] = useState<any[]>([])
  const [allSkills, setAllSkills] = useState<any[]>([])
  const [jobHistory, setJobHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addSkillId, setAddSkillId] = useState<number | null>(null)
  const [addLevel, setAddLevel] = useState(3)
  const [jobOpen, setJobOpen] = useState(false)
  const [jobForm, setJobForm] = useState({ project_name: '', role: '', start_date: '', end_date: '', tech_stack: '' })
  const [inferring, setInferring] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => { setTitle('Skills Management') }, [])

  useEffect(() => {
    (async () => {
      try {
        const [, emps, sk] = await Promise.all([
          api.profile(),
          api.employees('page=1&page_size=50'),
          api.allSkills(),
        ])
        const filtered = (emps.data?.list || []).filter((e: any) => e.employment_status === 'active')
        setEmployees(filtered)
        setAllSkills(sk.data || [])
        setSelectedEmp(filtered[0]?.employee_id || null)
      } catch { setError('Failed to load employees') }
      finally { setLoading(false) }
    })()
  }, [])

  useEffect(() => {
    if (!selectedEmp) return
    (async () => {
      setLoading(true)
      try {
        const [sk, pr] = await Promise.all([api.employeeSkills(selectedEmp), api.employeeProjects(selectedEmp)])
        setSkills(sk.data || [])
        setJobHistory(pr.data || [])
        setError('')
      } catch { setSkills([]); setJobHistory([]) }
      finally { setLoading(false) }
    })()
  }, [selectedEmp])

  const empName = employees.find(e => e.employee_id === selectedEmp)?.full_name || ''

  async function handleAddSkill() {
    if (!selectedEmp || !addSkillId) return
    try {
      await api.addEmployeeSkill(selectedEmp, addSkillId, addLevel)
      const sk = await api.employeeSkills(selectedEmp)
      setSkills(sk.data || [])
      setFeedback('已提交审批')
      setAddOpen(false); setAddSkillId(null); setAddLevel(3)
      setTimeout(() => setFeedback(''), 3000)
    } catch { setFeedback('提交审批失败') }
  }

  async function handleDeleteSkill(skillId: number) {
    if (!selectedEmp) return
    try {
      await api.deleteEmployeeSkill(selectedEmp, skillId)
      const sk = await api.employeeSkills(selectedEmp)
      setSkills(sk.data || [])
      setFeedback('已提交审批')
      setTimeout(() => setFeedback(''), 3000)
    } catch { setFeedback('提交审批失败') }
  }

  async function handleAddJob() {
    if (!selectedEmp || !jobForm.project_name) return
    try {
      await api.addEmployeeProject(selectedEmp, {
        project_name: jobForm.project_name,
        role: jobForm.role,
        start_date: jobForm.start_date,
        end_date: jobForm.end_date,
        description: jobForm.tech_stack,
      })
      const jh = await api.employeeProjects(selectedEmp)
      setJobHistory(jh.data || [])
      setFeedback('Job history added')
      setJobOpen(false); setJobForm({ project_name: '', role: '', start_date: '', end_date: '', tech_stack: '' })
      setTimeout(() => setFeedback(''), 2000)
    } catch { setFeedback('Failed to add job history') }
  }

  async function handleInfer() {
    if (!selectedEmp) return
    setInferring(true)
    setFeedback('')
    // AI inference: extract skill keywords from description (tech stack) in project history
    const techs = jobHistory
      .flatMap(j => (j.description || j.tech_stack || '').split(',').map((t: string) => t.trim().toLowerCase()))
      .filter(Boolean)
    const unique = [...new Set(techs)]
    if (unique.length === 0) {
      setFeedback('No tech stack found in job history. Add work history first.')
      setInferring(false)
      return
    }
    // Match inferred skills against the skill catalog
    const catalog = allSkills.filter(s =>
      unique.some(t => s.skill_name.toLowerCase().includes(t) || t.includes(s.skill_name.toLowerCase()))
    )
    for (const skill of catalog) {
      if (!skills.some(s => s.skill_id === skill.skill_id)) {
        try {
          await api.addEmployeeSkill(selectedEmp, skill.skill_id, 2)
        } catch { /* skip conflicts */ }
      }
    }
    const sk = await api.employeeSkills(selectedEmp)
    setSkills(sk.data || [])
    setFeedback(`Inferred ${catalog.length} skill(s) from work history`)
    setInferring(false)
  }

  if (loading && employees.length === 0) {
    return <div className="flex items-center justify-center h-64 text-stone-400">Loading...</div>
  }

  const availableSkills = allSkills.filter(s => !skills.some(es => es.skill_id === s.skill_id))

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-500 font-medium">Employee:</span>
          <select id="skills-employee" name="employee" value={selectedEmp || ''} onChange={e => setSelectedEmp(Number(e.target.value))}
            className="border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 bg-white min-w-[200px]">
            {employees.map(e => (
              <option key={e.employee_id} value={e.employee_id}>{e.full_name} - {e.position_name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {feedback && <span className="text-xs text-stone-500 bg-stone-100 px-3 py-1 rounded-full">{feedback}</span>}
          <button onClick={handleInfer} disabled={inferring}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition disabled:opacity-50">
            <Sparkles className="w-3.5 h-3.5" />
            {inferring ? 'Inferring...' : 'AI Infer Skills'}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>}

      <div className="grid gap-6 md:grid-cols-2">
        {/* ===== Left panel: Skills CRUD ===== */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-stone-500" />
              <h3 className="font-semibold text-stone-800">Skills</h3>
              <span className="text-xs text-stone-400 ml-1">({skills.length})</span>
            </div>
            <button onClick={() => { setAddOpen(true); setAddSkillId(null); setAddLevel(3) }}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition">
              <Plus className="w-3 h-3" /> Add Skill
            </button>
          </div>

          {/* Add skill form */}
          {addOpen && (
            <div className="mb-4 p-4 bg-stone-50 rounded-lg border border-stone-200 space-y-3">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Skill</label>
                <select id="skills-add-select" name="addSkillId" value={addSkillId || ''} onChange={e => setAddSkillId(Number(e.target.value))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 bg-white">
                  <option value="">Select a skill...</option>
                  {availableSkills.map(s => (
                    <option key={s.skill_id} value={s.skill_id}>{s.skill_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Proficiency (1-5)</label>
                <input id="skills-add-level" name="addLevel" type="range" min="1" max="5" value={addLevel} onChange={e => setAddLevel(Number(e.target.value))}
                  className="w-full accent-stone-900" />
                <div className="flex justify-between text-xs text-stone-400 mt-0.5">
                  <span>1</span><span className={`font-semibold ${addLevel >= 4 ? 'text-green-600' : addLevel >= 2 ? 'text-amber-600' : 'text-stone-400'}`}>{addLevel}/5</span><span>5</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddSkill} disabled={!addSkillId}
                  className="flex-1 text-xs px-3 py-2 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition disabled:opacity-50">Confirm</button>
                <button onClick={() => setAddOpen(false)}
                  className="text-xs px-3 py-2 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition">Cancel</button>
              </div>
            </div>
          )}

          {/* Skills list */}
          {loading ? (
            <div className="text-sm text-stone-400 py-8 text-center">Loading skills...</div>
          ) : skills.length === 0 ? (
            <div className="text-sm text-stone-400 py-8 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 text-stone-200" />
              No skills yet. Add one or use AI Infer.
            </div>
          ) : (
            <div className="space-y-2">
              {skills.map(s => (
                <div key={s.approval_id || s.skill_id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-stone-50 transition group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <span className="font-medium text-stone-700 truncate">{s.skill_name}</span>
                      <span className="text-xs text-stone-400 shrink-0">{s.proficiency_level}/5</span>
                      {s.approval_status === 'pending' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">pending</span>
                      )}
                      {s.approval_status === 'approved' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium shrink-0">approved</span>
                      )}
                      {s.approval_status === 'rejected' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium shrink-0">rejected</span>
                      )}
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-stone-500 transition-all" style={{ width: `${s.proficiency_level * 20}%` }} />
                    </div>
                  </div>
                  {(s.approval_status === 'approved' || !s.approval_status) && (
                    <button onClick={() => handleDeleteSkill(s.skill_id)} title="Remove skill"
                      className="ml-3 p-1.5 rounded-md text-stone-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== Right panel: Work History ===== */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-stone-500" />
              <h3 className="font-semibold text-stone-800">Work History</h3>
              <span className="text-xs text-stone-400 ml-1">({jobHistory.length})</span>
            </div>
            <button onClick={() => setJobOpen(true)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition">
              <Plus className="w-3 h-3" /> Add Entry
            </button>
          </div>

          {/* Add job form */}
          {jobOpen && (
            <div className="mb-4 p-4 bg-stone-50 rounded-lg border border-stone-200 space-y-3">
              <input id="job-project-name" name="projectName" placeholder="Project name *" value={jobForm.project_name} onChange={e => setJobForm(p => ({ ...p, project_name: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              <input id="job-role" name="role" placeholder="Role (e.g. Full Stack Developer)" value={jobForm.role} onChange={e => setJobForm(p => ({ ...p, role: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              <div className="grid grid-cols-2 gap-2">
                <input id="job-start-date" name="startDate" type="date" value={jobForm.start_date} onChange={e => setJobForm(p => ({ ...p, start_date: e.target.value }))}
                  className="border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
                <input id="job-end-date" name="endDate" type="date" value={jobForm.end_date} onChange={e => setJobForm(p => ({ ...p, end_date: e.target.value }))}
                  className="border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              </div>
              <input id="job-tech-stack" name="techStack" placeholder="Tech stack (comma-separated, e.g. Python, SQL, Docker)" value={jobForm.tech_stack} onChange={e => setJobForm(p => ({ ...p, tech_stack: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              <div className="flex gap-2">
                <button onClick={handleAddJob} disabled={!jobForm.project_name}
                  className="flex-1 text-xs px-3 py-2 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition disabled:opacity-50">Save</button>
                <button onClick={() => setJobOpen(false)}
                  className="text-xs px-3 py-2 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition">Cancel</button>
              </div>
            </div>
          )}

          {/* Job history list */}
          {jobHistory.length === 0 ? (
            <div className="text-sm text-stone-400 py-8 text-center">
              <Briefcase className="w-8 h-8 mx-auto mb-2 text-stone-200" />
              No work history entries yet.
            </div>
          ) : (
            <div className="space-y-3">
              {jobHistory.map((j, idx) => (
                <div key={idx} className="p-4 bg-stone-50 rounded-lg border border-stone-100">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-medium text-stone-800 text-sm">{j.project_name}</h4>
                    <span className="text-xs text-stone-400">{j.start_date?.slice(0, 7) || '?'} - {j.end_date?.slice(0, 7) || 'Present'}</span>
                  </div>
                  {j.role && <p className="text-xs text-stone-500 mb-2">{j.role}</p>}
                  {(j.description || j.tech_stack) && (
                    <div className="flex flex-wrap gap-1">
                      {(j.description || j.tech_stack).split(',').map((t: string, i: number) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">{t.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
