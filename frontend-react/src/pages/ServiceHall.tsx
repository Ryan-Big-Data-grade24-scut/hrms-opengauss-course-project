import { useEffect, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import {
  FileEdit,
  CalendarDays,
  Clock,
  UserCog,
  ClipboardList,
  Send,
  CheckCircle2,
  XCircle,
  Clock as ClockIcon,
  AlertCircle,
  Loader2,
  ChevronRight,
  Info,
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

async function post(path: string, body: any) {
  const token = localStorage.getItem('token')
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

async function put(path: string, body?: any) {
  const token = localStorage.getItem('token')
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TabKey = 'apply' | 'pending' | 'mine'

interface ApprovalRequest {
  id: string
  operation_type: string
  applicant_id: string
  applicant_name?: string
  target_emp_id: string
  target_name?: string
  status: string
  current_node: number
  payload?: any
  chain_snapshot?: { role: string; status: string; step_order: number }[]
  created_at: string
}

type FormMode = 'SKILL_CHANGE' | 'LEAVE_REQUEST' | 'ATTENDANCE_CORRECTION' | 'PROFILE_UPDATE'

interface SkillItem {
  skill_id: number
  skill_name: string
  category_name: string
}

interface LeaveTypeItem {
  leave_type_id: number
  type_name: string
}

interface ProfileData {
  employee_id: number
  full_name: string
  phone?: string
  email?: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const CARD_CONFIG: { mode: FormMode; label: string; desc: string; icon: any }[] = [
  { mode: 'SKILL_CHANGE', label: '技能变更', desc: '新增、修改或移除技能及等级', icon: FileEdit },
  { mode: 'LEAVE_REQUEST', label: '请假申请', desc: '提交请假或调休申请', icon: CalendarDays },
  { mode: 'ATTENDANCE_CORRECTION', label: '考勤补卡', desc: '补打卡或修正出勤记录', icon: Clock },
  { mode: 'PROFILE_UPDATE', label: '信息修改', desc: '修改联系方式等个人信息', icon: UserCog },
]

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: '待审批', color: 'bg-blue-100 text-blue-700' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-700' },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-700' },
  draft: { label: '草稿', color: 'bg-stone-100 text-stone-600' },
  archived: { label: '已归档', color: 'bg-indigo-100 text-indigo-700' },
}

const OPERATION_LABELS: Record<string, string> = {
  SKILL_CHANGE: '技能变更',
  LEAVE_REQUEST: '请假申请',
  ATTENDANCE_CORRECTION: '考勤补卡',
  PROFILE_UPDATE: '信息修改',
}

function getOperationLabel(op: string) {
  return OPERATION_LABELS[op] || op
}

function formatTime(ts: string | undefined) {
  if (!ts) return ''
  return ts.slice(0, 16).replace('T', ' ')
}

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
    </div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Icon className="w-12 h-12 text-stone-200 mb-3" />
      <p className="text-sm text-stone-400">{message}</p>
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
        <p className="text-sm text-red-600">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-red-500 underline hover:text-red-700 shrink-0 ml-3">
          重试
        </button>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGES[status] || { label: status, color: 'bg-stone-100 text-stone-600' }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
      {status === 'pending' && <ClockIcon className="w-3 h-3" />}
      {status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'rejected' && <XCircle className="w-3 h-3" />}
      {cfg.label}
    </span>
  )
}

/** Display approval step progress: current step / total steps */
function StepIndicator({ chain_snapshot, current_node }: { chain_snapshot?: any[]; current_node?: number }) {
  if (!chain_snapshot || chain_snapshot.length === 0) {
    if (!current_node) return null
    return (
      <span className="text-xs text-stone-400">
        第 {current_node} 步
      </span>
    )
  }

  const total = chain_snapshot.length
  const current = current_node || 1

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {chain_snapshot.map((node, idx) => {
        const isCurrent = idx + 1 === current
        const isDone = node.status === 'approved' || node.status === 'completed'
        const isRejected = node.status === 'rejected'
        return (
          <div key={idx} className="flex items-center gap-1.5">
            {idx > 0 && <ChevronRight className="w-3 h-3 text-stone-300" />}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                isRejected
                  ? 'bg-red-100 text-red-600'
                  : isCurrent
                  ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                  : isDone
                  ? 'bg-green-100 text-green-700'
                  : 'bg-stone-100 text-stone-400'
              }`}
            >
              {node.role || `第${idx + 1}步`}
              {isCurrent && !isDone && ' (进行中)'}
              {isDone && ' (已完成)'}
              {isRejected && ' (已驳回)'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Build a human-readable summary from payload */
function getPayloadSummary(op: string, payload: any): string {
  if (!payload) return ''
  switch (op) {
    case 'SKILL_CHANGE':
      return `技能${payload.operation === 'add' ? '新增' : payload.operation === 'remove' ? '移除' : '更新'}: ${payload.skill_name || `ID:${payload.skill_id}`}${payload.proficiency ? `, 等级 ${payload.proficiency}` : ''}`
    case 'LEAVE_REQUEST':
      return `${payload.leave_type_name || `类型:${payload.leave_type_id}`}, ${payload.start_date} ~ ${payload.end_date}, 共 ${calcDays(payload.start_date, payload.end_date)} 天`
    case 'ATTENDANCE_CORRECTION':
      return `${payload.date}, 时段: ${payload.period === 'morning' ? '上午' : payload.period === 'afternoon' ? '下午' : '全天'}`
    case 'PROFILE_UPDATE':
      return `修改: ${Object.keys(payload.fields || {}).join(', ') || payload.field || '个人信息'}`
    default:
      return JSON.stringify(payload).slice(0, 60)
  }
}

/* ------------------------------------------------------------------ */
/*  Apply Form (shared across all card types)                          */
/* ------------------------------------------------------------------ */

function ApplyForm({
  mode,
  onClose,
}: {
  mode: FormMode
  onClose: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Data lists loaded from API
  const [skillsList, setSkillsList] = useState<SkillItem[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [leaveTypesList, setLeaveTypesList] = useState<LeaveTypeItem[]>([])
  const [profileData, setProfileData] = useState<ProfileData | null>(null)

  // Department → Position → Skill flow state (用于 SKILL_CHANGE)
  const [depts, setDepts] = useState<any[]>([])
  const [posList, setPosList] = useState<any[]>([])
  const [reqSkills, setReqSkills] = useState<any[]>([])
  const [selDeptId, setSelDeptId] = useState<number | ''>('')
  const [selPosId, setSelPosId] = useState<number | ''>('')

  // Common fields
  const [reason, setReason] = useState('')

  // Skill change
  const [skillAction, setSkillAction] = useState<'add' | 'update' | 'remove'>('add')
  const [selectedSkillId, setSelectedSkillId] = useState<number | ''>('')
  const [proficiency, setProficiency] = useState('')

  // Leave
  const [leaveTypeId, setLeaveTypeId] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const leaveDays = calcDays(startDate, endDate)

  // Attendance correction
  const [corrDate, setCorrDate] = useState('')
  const [corrPeriod, setCorrPeriod] = useState<'morning' | 'afternoon' | 'full'>('morning')
  const [corrClockIn, setCorrClockIn] = useState('')
  const [corrClockOut, setCorrClockOut] = useState('')

  // Profile update
  const [phoneValue, setPhoneValue] = useState('')
  const [emailValue, setEmailValue] = useState('')

  // Load data on mount
  useEffect(() => {
    if (mode === 'SKILL_CHANGE') {
      setSkillsLoading(true)
      Promise.all([
        get('/skills').then(r => r.data || r || []),
        get('/departments').then(r => r.data || r || []),
      ]).then(([skills, deptsData]) => {
        setSkillsList(skills)
        setDepts(deptsData)
      }).catch(() => {}).finally(() => setSkillsLoading(false))
      // Reset department→position selection
      setSelDeptId('')
      setSelPosId('')
      setPosList([])
      setReqSkills([])
    }
    if (mode === 'LEAVE_REQUEST') {
      get('/leave-types')
        .then(res => setLeaveTypesList(res.data || res || []))
        .catch(() => {})
    }
    if (mode === 'PROFILE_UPDATE') {
      get('/profile/self')
        .then(res => {
          const p = res.data || res
          setProfileData(p)
          setPhoneValue(p.phone || '')
          setEmailValue(p.email || '')
        })
        .catch(() => {})
    }
  }, [mode])

  // Load positions when department changes (SKILL_CHANGE)
  useEffect(() => {
    if (mode !== 'SKILL_CHANGE') return
    if (!selDeptId) { setPosList([]); setSelPosId(''); return }
    get(`/positions?department_id=${selDeptId}`)
      .then(res => setPosList(res.data || res || []))
      .catch(() => setPosList([]))
  }, [selDeptId, mode])

  // Load required skills when position changes (SKILL_CHANGE)
  useEffect(() => {
    if (mode !== 'SKILL_CHANGE') return
    if (!selPosId) { setReqSkills([]); return }
    get(`/skills/required?position_id=${selPosId}`)
      .then(res => setReqSkills(res.data || res || []))
      .catch(() => setReqSkills([]))
  }, [selPosId, mode])

  // Group skills by category
  const groupedSkills: Record<string, SkillItem[]> = {}
  skillsList.forEach(s => {
    const cat = s.category_name || '未分类'
    if (!groupedSkills[cat]) groupedSkills[cat] = []
    groupedSkills[cat].push(s)
  })

  const getTodayStr = () => new Date().toISOString().slice(0, 10)

  const buildPayload = () => {
    switch (mode) {
      case 'SKILL_CHANGE': {
        const skill = skillsList.find(s => s.skill_id === selectedSkillId)
        return {
          skill_id: selectedSkillId,
          operation: skillAction,
          proficiency: skillAction !== 'remove' ? Number(proficiency) : undefined,
          skill_name: skill?.skill_name || '',
          reason,
        }
      }
      case 'LEAVE_REQUEST': {
        const lt = leaveTypesList.find(l => l.leave_type_id === leaveTypeId)
        return {
          leave_type_id: leaveTypeId,
          start_date: startDate,
          end_date: endDate,
          days: leaveDays,
          leave_type_name: lt?.type_name || '',
          reason,
        }
      }
      case 'ATTENDANCE_CORRECTION':
        return {
          date: corrDate,
          period: corrPeriod,
          clock_in: (corrPeriod === 'morning' || corrPeriod === 'full') ? corrClockIn || null : null,
          clock_out: (corrPeriod === 'afternoon' || corrPeriod === 'full') ? corrClockOut || null : null,
          reason,
        }
      case 'PROFILE_UPDATE': {
        const fields: Record<string, string> = {}
        if (phoneValue !== profileData?.phone) fields.phone = phoneValue
        if (emailValue !== profileData?.email) fields.email = emailValue
        return { fields, reason }
      }
    }
  }

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      await post('/approval-requests', {
        operation_type: mode,
        payload: buildPayload(),
      })
      setSuccess(true)
    } catch (e: any) {
      setError(e.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-10">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="text-sm font-medium text-stone-700">提交成功</p>
        <p className="text-xs text-stone-400 mt-1">申请已提交，等待审批</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition"
        >
          关闭
        </button>
      </div>
    )
  }

  return (
    <div>
      <h3 className="font-semibold text-stone-800 mb-4">{CARD_CONFIG.find(c => c.mode === mode)?.label}</h3>
      <div className="space-y-3">
        {/* ========== SKILL_CHANGE ========== */}
        {mode === 'SKILL_CHANGE' && (
          <>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">操作类型</label>
              <select
                value={skillAction}
                onChange={e => setSkillAction(e.target.value as any)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
              >
                <option value="add">新增技能</option>
                <option value="update">修改技能等级</option>
                <option value="remove">移除技能</option>
              </select>
            </div>
            {/* Update mode: select from existing skills */}
            {skillAction === 'update' && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">选择现有技能</label>
                <select
                  value={selectedSkillId}
                  onChange={e => setSelectedSkillId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
                >
                  <option value="">请选择技能</option>
                  {mySkills.map((s: any) => (
                    <option key={s.skill_id} value={s.skill_id}>
                      {s.skill_name}（当前 {s.proficiency_level}/5）
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Add/remove mode: department + position + required skills */}
            {skillAction !== 'update' && (<>
            {/* Step 1: Select Department */}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">部门选择</label>
              <select
                value={selDeptId}
                onChange={e => { setSelDeptId(e.target.value ? Number(e.target.value) : ''); setSelPosId(''); setSelectedSkillId('') }}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
                disabled={skillsLoading}
              >
                <option value="">请选择部门</option>
                {depts.map((d: any) => (
                  <option key={d.id || d.department_id} value={d.id || d.department_id}>
                    {d.name || d.department_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Select Position (filtered by department) */}
            {selDeptId && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">岗位选择</label>
                <select
                  value={selPosId}
                  onChange={e => { setSelPosId(e.target.value ? Number(e.target.value) : ''); setSelectedSkillId('') }}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
                >
                  <option value="">请选择岗位</option>
                  {posList.map((p: any) => (
                    <option key={p.id || p.position_id} value={p.id || p.position_id}>
                      {p.name || p.position_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Step 3: Select Required Skill for this position */}
            {selPosId && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">该岗位要求的技能</label>
                {reqSkills.length === 0 ? (
                  <p className="text-xs text-stone-400">暂无岗位技能要求数据</p>
                ) : (
                  <>
                    <select
                      value={selectedSkillId}
                      onChange={e => setSelectedSkillId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition mb-2"
                    >
                      <option value="">请选择技能</option>
                      {reqSkills.map((rs: any) => (
                        <option key={rs.skill_id} value={rs.skill_id}>
                          {rs.skill_name} {rs.target_level ? `(目标: ${rs.target_level})` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-1">
                      {reqSkills.map((rs: any) => (
                        <span key={rs.skill_id}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            selectedSkillId === rs.skill_id ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500'
                          }`}>
                          {rs.skill_name}{rs.target_level ? ` Lv${rs.target_level}` : ''}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            </>)}
            {skillAction !== 'remove' && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">熟练度 (1-5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={proficiency}
                  onChange={e => setProficiency(e.target.value)}
                  placeholder="1-5"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
                />
              </div>
            )}
          </>
        )}

        {/* ========== LEAVE_REQUEST ========== */}
        {mode === 'LEAVE_REQUEST' && (
          <>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">请假类型</label>
              <select
                value={leaveTypeId}
                onChange={e => setLeaveTypeId(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
              >
                <option value="">请选择</option>
                {leaveTypesList.map(lt => (
                  <option key={lt.leave_type_id} value={lt.leave_type_id}>
                    {lt.type_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">开始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">结束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
              />
            </div>
            {startDate && endDate && (
              <div className="bg-stone-50 rounded-lg px-3 py-2 text-sm">
                <span className="text-stone-500">共 </span>
                <span className="font-semibold text-stone-700">{leaveDays}</span>
                <span className="text-stone-500"> 天</span>
              </div>
            )}
          </>
        )}

        {/* ========== ATTENDANCE_CORRECTION ========== */}
        {mode === 'ATTENDANCE_CORRECTION' && (
          <>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">补卡日期</label>
              <input
                type="date"
                value={corrDate}
                onChange={e => setCorrDate(e.target.value)}
                max={getTodayStr()}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">时段</label>
              <div className="flex gap-2">
                {(['morning', 'afternoon', 'full'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCorrPeriod(p)}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition ${
                      corrPeriod === p
                        ? 'bg-stone-800 text-white border-stone-800'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    {p === 'morning' ? '上午' : p === 'afternoon' ? '下午' : '全天'}
                  </button>
                ))}
              </div>
            </div>
            {(corrPeriod === 'morning' || corrPeriod === 'full') && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">签到时间</label>
                <input
                  type="time"
                  value={corrClockIn}
                  onChange={e => setCorrClockIn(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
                />
              </div>
            )}
            {(corrPeriod === 'afternoon' || corrPeriod === 'full') && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">签退时间</label>
                <input
                  type="time"
                  value={corrClockOut}
                  onChange={e => setCorrClockOut(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
                />
              </div>
            )}
          </>
        )}

        {/* ========== PROFILE_UPDATE ========== */}
        {mode === 'PROFILE_UPDATE' && (
          <>
            {profileData && (
              <div className="bg-stone-50 rounded-lg px-3 py-2 text-xs text-stone-500 space-y-1">
                <Info className="w-3 h-3 inline mr-1" />
                当前信息: {profileData.full_name}
                {profileData.phone && <span className="ml-2">电话: {profileData.phone}</span>}
                {profileData.email && <span className="ml-2">邮箱: {profileData.email}</span>}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">电话</label>
              <input
                value={phoneValue}
                onChange={e => setPhoneValue(e.target.value)}
                placeholder={profileData?.phone || '请输入新电话号码'}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">邮箱</label>
              <input
                value={emailValue}
                onChange={e => setEmailValue(e.target.value)}
                placeholder={profileData?.email || '请输入新邮箱'}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
              />
            </div>
          </>
        )}

        {/* ========== Reason (common) ========== */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">申请说明</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="请简述申请原因..."
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition disabled:opacity-50"
          >
            {submitting ? '提交中...' : '提交'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Detail Modal                                                       */
/* ------------------------------------------------------------------ */

function DetailModal({
  request,
  onClose,
}: {
  request: ApprovalRequest
  onClose: () => void
}) {
  const payload = request.payload
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-stone-800 mb-4">申请详情</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-400">操作类型</span>
            <span className="font-medium text-stone-700">{getOperationLabel(request.operation_type)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400">申请人</span>
            <span className="font-medium text-stone-700">{request.applicant_name || request.applicant_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400">状态</span>
            <StatusBadge status={request.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400">提交时间</span>
            <span className="text-stone-600">{formatTime(request.created_at)}</span>
          </div>
          {request.current_node && (
            <div className="flex justify-between">
              <span className="text-stone-400">当前步骤</span>
              <span className="text-stone-600">第 {request.current_node} 步</span>
            </div>
          )}
          {payload && (
            <div>
              <span className="text-stone-400 block mb-1">申请内容</span>
              <pre className="bg-stone-50 rounded-lg p-3 text-xs text-stone-600 whitespace-pre-wrap break-all">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>
          )}
          {request.chain_snapshot && request.chain_snapshot.length > 0 && (
            <div>
              <span className="text-stone-400 block mb-1">审批进度</span>
              <StepIndicator chain_snapshot={request.chain_snapshot} current_node={request.current_node} />
            </div>
          )}
        </div>
        <div className="flex justify-end mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function ServiceHall() {
  const { setTitle } = useOutletContext() as any
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab: TabKey = (searchParams.get('tab') as TabKey) || 'apply'

  /* ---- Form modal ---- */
  const [formMode, setFormMode] = useState<FormMode | null>(null)

  /* ---- Pending / Mine list ---- */
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /* ---- Detail modal ---- */
  const [detailRequest, setDetailRequest] = useState<ApprovalRequest | null>(null)

  /* ---- Action confirm ---- */
  const [actionTarget, setActionTarget] = useState<ApprovalRequest | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    setTitle('办事大厅')
  }, [])

  /* ---- Fetch list ---- */
  useEffect(() => {
    if (activeTab === 'apply') return
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const endpoint = activeTab === 'pending' ? '/approval-requests/pending' : '/approval-requests/my'
        const res = await get(endpoint)
        setRequests(res.data || [])
      } catch (e: any) {
        setError(e.message || '加载失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [activeTab])

  const switchTab = (tab: TabKey) => {
    setSearchParams(prev => { prev.set('tab', tab); return prev })
  }

  /* ---- Approve / Reject ---- */
  const submitAction = async () => {
    if (!actionTarget || !actionType) return
    if (actionType === 'reject' && !rejectReason.trim()) return
    setActionSubmitting(true)
    setActionError('')
    try {
      const endpoint = `/approval-requests/${actionTarget.id}/${actionType}`
      await put(endpoint, actionType === 'reject' ? { comment: rejectReason.trim() } : { comment: '' })
      setRequests(prev => prev.filter(r => r.id !== actionTarget.id))
      setActionTarget(null)
      setActionType(null)
      setRejectReason('')
    } catch (e: any) {
      setActionError(e.message || '操作失败')
    } finally {
      setActionSubmitting(false)
    }
  }

  /* ---- Recall ---- */
  const handleRecall = async (req: ApprovalRequest) => {
    if (!window.confirm('确定撤回该申请？')) return
    try {
      await put(`/approval-requests/${req.id}/recall`)
      setRequests(prev => prev.filter(r => r.id !== req.id))
    } catch (e: any) {
      alert(e.message || '撤回失败')
    }
  }

  const tabs = [
    { key: 'apply' as TabKey, label: '发起申请', icon: FileEdit },
    { key: 'pending' as TabKey, label: '待审批', icon: ClipboardList },
    { key: 'mine' as TabKey, label: '我的申请', icon: Send },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 mb-5">
        <div className="flex border-b border-stone-100">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition border-b-2 ${
                activeTab === tab.key
                  ? 'border-stone-800 text-stone-800'
                  : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================================================================ */}
      {/* Tab 1: 发起申请 — four cards                                     */}
      {/* ================================================================ */}
      {activeTab === 'apply' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CARD_CONFIG.map(card => (
            <button
              key={card.mode}
              onClick={() => setFormMode(card.mode)}
              className="bg-white rounded-xl shadow-sm border border-stone-200 p-5 text-left hover:shadow-md hover:border-stone-300 transition group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0 group-hover:bg-stone-200 transition">
                  <card.icon className="w-5 h-5 text-stone-600" />
                </div>
                <div>
                  <h3 className="font-medium text-sm text-stone-800">{card.label}</h3>
                  <p className="text-xs text-stone-400 mt-0.5">{card.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ================================================================ */}
      {/* Tab 2 & 3: 待审批 / 我的申请 — list                              */}
      {/* ================================================================ */}
      {(activeTab === 'pending' || activeTab === 'mine') && (
        <div className="space-y-3">
          {loading && <Spinner />}
          {error && <ErrorBanner message={error} onRetry={() => switchTab(activeTab)} />}

          {!loading && !error && requests.length === 0 && (
            <EmptyState
              icon={activeTab === 'pending' ? ClipboardList : Send}
              message={activeTab === 'pending' ? '暂无待审批申请' : '暂无申请记录'}
            />
          )}

          {!loading && !error && requests.map(req => (
            <div
              key={req.id}
              className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-700">
                      {getOperationLabel(req.operation_type)}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-xs text-stone-400">
                    {req.applicant_name || req.applicant_id}
                    {req.target_name && req.target_name !== req.applicant_name && (
                      <> &middot; {req.target_name}</>
                    )}
                  </p>
                  <p className="text-xs text-stone-400">{formatTime(req.created_at)}</p>
                  {/* Payload summary */}
                  {req.payload && (
                    <p className="text-xs text-stone-500 bg-stone-50 rounded px-2 py-1 inline-block">
                      {getPayloadSummary(req.operation_type, req.payload)}
                    </p>
                  )}
                  {/* Step progress for "我的申请" */}
                  {activeTab === 'mine' && (
                    <StepIndicator chain_snapshot={req.chain_snapshot} current_node={req.current_node} />
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* 查看详情 */}
                  <button
                    onClick={() => setDetailRequest(req)}
                    className="text-xs px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition font-medium"
                    title="查看详情"
                  >
                    详情
                  </button>
                  {activeTab === 'pending' && req.status === 'pending' && (
                    <>
                      <button
                        onClick={() => { setActionTarget(req); setActionType('approve'); setActionError('') }}
                        className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-medium"
                      >
                        批准
                      </button>
                      <button
                        onClick={() => { setActionTarget(req); setActionType('reject'); setRejectReason(''); setActionError('') }}
                        className="text-xs px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition font-medium"
                      >
                        驳回
                      </button>
                    </>
                  )}
                  {activeTab === 'mine' && req.status === 'pending' && (
                    <button
                      onClick={() => handleRecall(req)}
                      className="text-xs px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition"
                    >
                      撤回
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================================================================ */}
      {/* Apply form modal                                                */}
      {/* ================================================================ */}
      {formMode && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setFormMode(null)}>
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <ApplyForm mode={formMode} onClose={() => setFormMode(null)} />
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Detail modal                                                    */}
      {/* ================================================================ */}
      {detailRequest && (
        <DetailModal request={detailRequest} onClose={() => setDetailRequest(null)} />
      )}

      {/* ================================================================ */}
      {/* Approve / Reject confirm modal                                  */}
      {/* ================================================================ */}
      {actionTarget && actionType && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => { setActionTarget(null); setActionType(null) }}>
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-stone-800 mb-1">
              {actionType === 'approve' ? '批准申请' : '驳回申请'}
            </h3>
            <p className="text-sm text-stone-500 mb-4">
              {getOperationLabel(actionTarget.operation_type)}
              {actionTarget.applicant_name && <> &middot; {actionTarget.applicant_name}</>}
            </p>

            {actionType === 'reject' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-stone-600 mb-1">驳回原因（必填）</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="请输入驳回原因..."
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition resize-none"
                />
              </div>
            )}

            {actionError && <p className="text-xs text-red-500 mb-3">{actionError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setActionTarget(null); setActionType(null) }}
                className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition"
              >
                取消
              </button>
              <button
                onClick={submitAction}
                disabled={actionSubmitting || (actionType === 'reject' && !rejectReason.trim())}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition disabled:opacity-50 ${
                  actionType === 'approve'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {actionSubmitting ? '处理中...' : actionType === 'approve' ? '确认批准' : '确认驳回'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
