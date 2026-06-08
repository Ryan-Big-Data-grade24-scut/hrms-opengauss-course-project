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
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [error, setError] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addSkillId, setAddSkillId] = useState<number | null>(null)
  const [addLevel, setAddLevel] = useState(3)
  const [addMode, setAddMode] = useState<'all' | 'required'>('all')
  const [editSkillOpen, setEditSkillOpen] = useState<number | null>(null)
  const [editLevel, setEditLevel] = useState(3)
  const [jobOpen, setJobOpen] = useState(false)
  const [jobForm, setJobForm] = useState({ project_name: '', role: '', start_date: '', end_date: '', tech_stack: '' })
  const [editingJob, setEditingJob] = useState<{project_id: number} | null>(null)
  const [inferring, setInferring] = useState(false)
  const [feedback, setFeedback] = useState('')

  // Department → Position → Skill flow state
  const [departments, setDepartments] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [requiredSkills, setRequiredSkills] = useState<any[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState<number | ''>('')
  const [selectedPosId, setSelectedPosId] = useState<number | ''>('')

  useEffect(() => { setTitle('Skills Management') }, [])

  useEffect(() => {
    (async () => {
      try {
        let profile: any = {}
        try { profile = JSON.parse(localStorage.getItem('profile') || '{}') } catch {}
        const perms: string[] = profile.permissions || []
        const empId = profile.employee_id
        const isAdmin = perms.some((p: string) => p === 'employee.manage')
        const [sk, depts] = await Promise.all([api.allSkills(), api.departments()])
        setAllSkills(sk.data || [])
        setDepartments(depts.data || [])

        if (isAdmin) {
          const emps = await api.employees(`page=1&page_size=50&subtree_of=${empId}`)
          const filtered = (emps.data?.list || []).filter((e: any) => e.employment_status === 'active')
          setEmployees(filtered)
          if (filtered.length > 0 && !selectedEmp) setSelectedEmp(filtered[0].employee_id)
        } else {
          // Non-admin users can only see their own skills
          const ownEmpId = profile.employee_id
          if (ownEmpId) {
            setEmployees([{employee_id: ownEmpId, full_name: profile.full_name || 'Me', position_name: ''}])
            setSelectedEmp(ownEmpId)
          }
        }
      } catch { setError('Failed to load data') }
      finally { setLoading(false) }
    })()
  }, [])

  useEffect(() => {
    if (!selectedEmp) {
      setSkills([])
      setJobHistory([])
      return
    }
    let cancelled = false
    setSkillsLoading(true)
    ;(async () => {
      try {
        const [sk, pr] = await Promise.all([api.employeeSkills(selectedEmp), api.employeeProjects(selectedEmp)])
        if (!cancelled) {
          setSkills(sk.data || [])
          setJobHistory(pr.data || [])
          setError('')
        }
      } catch {
        if (!cancelled) { setSkills([]); setJobHistory([]) }
      }
      finally { if (!cancelled) setSkillsLoading(false) }
    })()
    return () => { cancelled = true }
  }, [selectedEmp])

  // Load positions when department changes
  useEffect(() => {
    if (!selectedDeptId) { setPositions([]); setSelectedPosId(''); return }
    ;(async () => {
      try {
        const res = await api.positions(selectedDeptId as number)
        setPositions(res.data || [])
      } catch { setPositions([]) }
    })()
  }, [selectedDeptId])

  // Load required skills when position changes
  useEffect(() => {
    if (!selectedPosId) { setRequiredSkills([]); return }
    ;(async () => {
      try {
        const res = await api.skillsRequired(selectedPosId as number)
        setRequiredSkills(res.data || [])
      } catch { setRequiredSkills([]) }
    })()
  }, [selectedPosId])

  const empName = employees.find(e => e.employee_id === selectedEmp)?.full_name || ''

  async function handleAddSkill() {
    if (!selectedEmp || !addSkillId) return
    try {
      await api.addEmployeeSkill(selectedEmp, addSkillId, addLevel)
      const sk = await api.employeeSkills(selectedEmp)
      setSkills(sk.data || [])
      setFeedback('技能变更申请已提交')
      setAddOpen(false); setAddSkillId(null); setAddLevel(3)
      setTimeout(() => setFeedback(''), 3000)
    } catch (e: any) { setFeedback('提交失败: ' + (e.message || '未知错误')) }
  }

  async function handleUpdateSkill(skillId: number, level: number) {
    if (!selectedEmp) return
    try {
      await api.updateEmployeeSkill(selectedEmp, skillId, level)
      const sk = await api.employeeSkills(selectedEmp)
      setSkills(sk.data || [])
      setFeedback('技能变更申请已提交')
      setEditSkillOpen(null)
      setTimeout(() => setFeedback(''), 3000)
    } catch (e: any) { setFeedback('提交失败: ' + (e.message || '未知错误')) }
  }

  async function handleDeleteSkill(skillId: number) {
    if (!selectedEmp) return
    try {
      await api.deleteEmployeeSkill(selectedEmp, skillId)
      const sk = await api.employeeSkills(selectedEmp)
      setSkills(sk.data || [])
      setFeedback('技能移除申请已提交')
      setTimeout(() => setFeedback(''), 3000)
    } catch (e: any) { setFeedback('提交失败: ' + (e.message || '未知错误')) }
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
      setFeedback('履历已添加')
      setJobOpen(false); setJobForm({ project_name: '', role: '', start_date: '', end_date: '', tech_stack: '' })
      setTimeout(() => setFeedback(''), 2000)
    } catch { setFeedback('添加履历失败') }
  }

  async function handleUpdateJob() {
    if (!selectedEmp || !editingJob || !jobForm.project_name) return
    try {
      await api.updateEmployeeProject(selectedEmp, editingJob.project_id, {
        project_name: jobForm.project_name,
        role: jobForm.role,
        start_date: jobForm.start_date,
        end_date: jobForm.end_date,
        description: jobForm.tech_stack,
      })
      const jh = await api.employeeProjects(selectedEmp)
      setJobHistory(jh.data || [])
      setFeedback('履历已更新')
      setEditingJob(null); setJobOpen(false); setJobForm({ project_name: '', role: '', start_date: '', end_date: '', tech_stack: '' })
      setTimeout(() => setFeedback(''), 2000)
    } catch { setFeedback('更新履历失败') }
  }

  async function handleDeleteJob(projectId: number) {
    if (!selectedEmp) return
    try {
      await api.deleteEmployeeProject(selectedEmp, projectId)
      const jh = await api.employeeProjects(selectedEmp)
      setJobHistory(jh.data || [])
      setFeedback('履历已删除')
      setTimeout(() => setFeedback(''), 2000)
    } catch { setFeedback('删除履历失败') }
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
  const filteredRequiredSkills = requiredSkills.filter(rs => !skills.some(s => s.skill_id === rs.skill_id))

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

          {/* Add skill form — two modes: All Skills or Department→Position→Required */}
          {addOpen && (
            <div className="mb-4 p-4 bg-stone-50 rounded-lg border border-stone-200 space-y-3">
              {/* Mode Toggle */}
              <div className="flex gap-2 mb-1">
                <button onClick={() => { setAddMode('all'); setSelectedDeptId(''); setSelectedPosId(''); setAddSkillId(null) }}
                  className={`text-xs px-3 py-1.5 rounded-full transition ${addMode === 'all' ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 border border-stone-200'}`}>
                  All Skills
                </button>
                <button onClick={() => { setAddMode('required'); setAddSkillId(null) }}
                  className={`text-xs px-3 py-1.5 rounded-full transition ${addMode === 'required' ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 border border-stone-200'}`}>
                  Position Required
                </button>
              </div>

              {addMode === 'all' ? (
                /* Mode A: Pick from all available skills */
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">Select a skill to add</label>
                  <select id="skills-add-all" value={addSkillId || ''} onChange={e => setAddSkillId(Number(e.target.value))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 bg-white">
                    <option value="">Choose a skill...</option>
                    {availableSkills.map(s => (
                      <option key={s.skill_id} value={s.skill_id}>{s.skill_name}</option>
                    ))}
                    {availableSkills.length === 0 && <option value="" disabled>No more skills to add</option>}
                  </select>
                </div>
              ) : (
                /* Mode B: Department → Position → Required Skill */
                <>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">Department</label>
                    <select id="skills-add-dept" value={selectedDeptId} onChange={e => { setSelectedDeptId(e.target.value ? Number(e.target.value) : ''); setSelectedPosId(''); setAddSkillId(null) }}
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 bg-white">
                      <option value="">Select a department...</option>
                      {departments.map(d => (
                        <option key={d.id || d.department_id} value={d.id || d.department_id}>{d.name || d.department_name}</option>
                      ))}
                    </select>
                  </div>
                  {selectedDeptId && (
                    <div>
                      <label className="text-xs text-stone-500 mb-1 block">Position</label>
                      <select id="skills-add-pos" value={selectedPosId} onChange={e => { setSelectedPosId(e.target.value ? Number(e.target.value) : ''); setAddSkillId(null) }}
                        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 bg-white">
                        <option value="">Select a position...</option>
                        {positions.map(p => (
                          <option key={p.id || p.position_id} value={p.id || p.position_id}>{p.name || p.position_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {selectedPosId && (
                    <div>
                      <label className="text-xs text-stone-500 mb-1 block">Required Skill</label>
                      <select id="skills-add-select" value={addSkillId || ''} onChange={e => setAddSkillId(Number(e.target.value))}
                        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 bg-white">
                        <option value="">Select a required skill...</option>
                        {filteredRequiredSkills.map(rs => (
                          <option key={rs.skill_id} value={rs.skill_id}>
                            {rs.skill_name} {rs.target_level ? `(target: ${rs.target_level})` : ''}
                          </option>
                        ))}
                        {filteredRequiredSkills.length === 0 && (
                          <option value="" disabled>No missing required skills for this position</option>
                        )}
                      </select>
                      {requiredSkills.length > 0 && (
                        <div className="mt-2 bg-white rounded p-2 border border-stone-100">
                          <p className="text-[10px] text-stone-400 mb-1">Skills required for this position:</p>
                          <div className="flex flex-wrap gap-1">
                            {requiredSkills.map(rs => {
                              const hasSkill = skills.some(s => s.skill_id === rs.skill_id)
                              return (
                                <span key={rs.skill_id}
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                    hasSkill ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'
                                  }`}>
                                  {rs.skill_name} {hasSkill ? '(done)' : ''}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Proficiency slider (shown when skill selected) */}
              {addSkillId && (
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">Proficiency (1-5)</label>
                  <input id="skills-add-level" type="range" min="1" max="5" value={addLevel} onChange={e => setAddLevel(Number(e.target.value))}
                    className="w-full accent-stone-900" />
                  <div className="flex justify-between text-xs text-stone-400 mt-0.5">
                    <span>1</span>
                    <span className={`font-semibold ${addLevel >= 4 ? 'text-green-600' : addLevel >= 2 ? 'text-amber-600' : 'text-stone-400'}`}>{addLevel}/5</span>
                    <span>5</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={handleAddSkill} disabled={!addSkillId}
                  className="flex-1 text-xs px-3 py-2 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition disabled:opacity-50">
                  Submit Approval Request
                </button>
                <button onClick={() => { setAddOpen(false); setSelectedDeptId(''); setSelectedPosId(''); setAddSkillId(null) }}
                  className="text-xs px-3 py-2 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition">Cancel</button>
              </div>
            </div>
          )}

          {/* Skills list */}
          {skillsLoading ? (
            <div className="text-sm text-stone-400 py-8 text-center">Loading skills...</div>
          ) : skills.length === 0 ? (
            <div className="text-sm text-stone-400 py-8 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 text-stone-200" />
              No skills yet. Add one or use AI Infer.
            </div>
          ) : (
            <div className="space-y-2">
              {skills.map(s => (
                <div key={s.approval_id || s.skill_id} className="py-2 px-3 rounded-lg hover:bg-stone-50 transition group">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <span className="font-medium text-stone-700 truncate">{s.skill_name}</span>
                        <span className="text-xs text-stone-400 shrink-0">{s.proficiency_level}/5</span>
                        {s.approval_status === 'pending' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">审批中</span>
                        )}
                        {s.approval_status === 'approved' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium shrink-0">已通过</span>
                        )}
                        {s.approval_status === 'rejected' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium shrink-0">已拒绝</span>
                        )}
                      </div>
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-stone-500 transition-all" style={{ width: `${s.proficiency_level * 20}%` }} />
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition">
                      {(s.approval_status === 'approved' || !s.approval_status) && (
                        <>
                          <button onClick={() => { setEditSkillOpen(s.skill_id); setEditLevel(s.proficiency_level) }} title="修改等级"
                            className="p-1.5 rounded-md text-stone-300 hover:text-amber-500 hover:bg-amber-50 transition">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => handleDeleteSkill(s.skill_id)} title="移除技能"
                            className="p-1.5 rounded-md text-stone-300 hover:text-red-500 hover:bg-red-50 transition">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Inline edit level */}
                  {editSkillOpen === s.skill_id && (
                    <div className="mt-2 p-3 bg-stone-50 rounded-lg border border-stone-200">
                      <label className="text-xs text-stone-500 mb-1 block">修改等级为 {editLevel}/5</label>
                      <input type="range" min="1" max="5" value={editLevel} onChange={e => setEditLevel(Number(e.target.value))}
                        className="w-full accent-stone-900" />
                      <div className="flex justify-between text-xs text-stone-400 mt-0.5">
                        <span>1</span>
                        <span>5</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleUpdateSkill(s.skill_id, editLevel)}
                          className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition">提交变更申请</button>
                        <button onClick={() => setEditSkillOpen(null)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition">取消</button>
                      </div>
                    </div>
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

          {/* Add/Edit job form */}
          {jobOpen && (
            <div className="mb-4 p-4 bg-stone-50 rounded-lg border border-stone-200 space-y-3">
              <p className="text-xs font-medium text-stone-500">{editingJob ? '编辑履历' : '新增履历'}</p>
              <input id="job-project-name" name="projectName" placeholder="项目名称 *" value={jobForm.project_name} onChange={e => setJobForm(p => ({ ...p, project_name: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              <input id="job-role" name="role" placeholder="角色（如 全栈开发）" value={jobForm.role} onChange={e => setJobForm(p => ({ ...p, role: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              <div className="grid grid-cols-2 gap-2">
                <input id="job-start-date" name="startDate" type="date" value={jobForm.start_date} onChange={e => setJobForm(p => ({ ...p, start_date: e.target.value }))}
                  className="border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
                <input id="job-end-date" name="endDate" type="date" value={jobForm.end_date} onChange={e => setJobForm(p => ({ ...p, end_date: e.target.value }))}
                  className="border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              </div>
              <input id="job-tech-stack" name="techStack" placeholder="技术栈（逗号分隔，如 Python, SQL, Docker）" value={jobForm.tech_stack} onChange={e => setJobForm(p => ({ ...p, tech_stack: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
              <div className="flex gap-2">
                <button onClick={editingJob ? handleUpdateJob : handleAddJob} disabled={!jobForm.project_name}
                  className="flex-1 text-xs px-3 py-2 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition disabled:opacity-50">
                  {editingJob ? '保存修改' : '添加'}
                </button>
                <button onClick={() => { setJobOpen(false); setEditingJob(null); setJobForm({ project_name: '', role: '', start_date: '', end_date: '', tech_stack: '' }) }}
                  className="text-xs px-3 py-2 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition">取消</button>
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
              {jobHistory.map((j: any, idx: number) => (
                <div key={j.project_id || idx} className="p-4 bg-stone-50 rounded-lg border border-stone-100 group">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-medium text-stone-800 text-sm">{j.project_name}</h4>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-stone-400">{j.start_date?.slice(0, 7) || '?'} - {j.end_date?.slice(0, 7) || '至今'}</span>
                      <button onClick={() => { setEditingJob({project_id: j.project_id}); setJobForm({project_name: j.project_name, role: j.role || '', start_date: j.start_date?.slice(0,10) || '', end_date: j.end_date?.slice(0,10) || '', tech_stack: typeof j.description === 'string' ? j.description : ''}); setJobOpen(true) }}
                        className="ml-2 p-1 rounded text-stone-300 hover:text-amber-500 hover:bg-amber-50 opacity-0 group-hover:opacity-100 transition">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={() => { if (confirm('确认删除此履历？')) handleDeleteJob(j.project_id) }}
                        className="p-1 rounded text-stone-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {j.role && <p className="text-xs text-stone-500 mb-2">{j.role}</p>}
                  {(j.description || j.tech_stack) && (
                    <div className="flex flex-wrap gap-1">
                      {(typeof (j.description || j.tech_stack) === 'string' ? (j.description || j.tech_stack) : '').split(',').map((t: string, i: number) => (
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
