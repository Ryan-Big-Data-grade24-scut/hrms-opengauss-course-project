import { useEffect, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
  import {
  FileEdit,
  CalendarDays,
  Clock,
  ClipboardList,
  Send,
  CheckCircle2,
  XCircle,
  Clock as ClockIcon,
  AlertCircle,
  Loader2,
  ChevronRight,
  Fingerprint,
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

type FormMode = 'SKILL_CHANGE' | 'LEAVE_REQUEST' | 'ATTENDANCE_CORRECTION' | 'CLOCK_IN_OUT'

interface SkillItem {
  skill_id: number
  skill_name: string
  category_name: string
}

interface LeaveTypeItem {
  leave_type_id: number
  type_name: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function hasAnyPerm(...patterns: string[]): boolean {
  let profile: any = {}
  try { profile = JSON.parse(localStorage.getItem('profile') || '{}') } catch {}
  const perms: string[] = profile.permissions || []
  return patterns.length === 0 || patterns.some(p =>
    perms.some(perm => perm === p || perm === 'admin' || perm.endsWith('.all'))
  )
}

function parsePayload(raw: any): any {
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return {} } }
  if (raw && typeof raw === 'object') return raw
  return {}
}

const CARD_CONFIG: { mode: FormMode; label: string; desc: string; icon: any; perm: string[] }[] = [
  { mode: 'SKILL_CHANGE', label: '技能变更', desc: '新增、修改或移除技能及等级', icon: FileEdit, perm: ['skill.manage', 'skill.manage.all', 'skill.manage.team'] },
  { mode: 'LEAVE_REQUEST', label: '请假申请', desc: '提交请假或调休申请', icon: CalendarDays, perm: ['leave.manage'] },
  { mode: 'ATTENDANCE_CORRECTION', label: '考勤补卡', desc: '补打卡或修正出勤记录', icon: Clock, perm: ['attendance.manage', 'attendance.view', 'attendance.view.self'] },
  { mode: 'CLOCK_IN_OUT', label: '上下班打卡', desc: '上班签到 / 下班签退', icon: Fingerprint, perm: [] },
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
function getPayloadSummary(op: string, raw: any): string {
  const payload = parsePayload(raw)
  if (!payload) return ''
  switch (op) {
    case 'SKILL_CHANGE':
      return `技能${payload.operation === 'add' ? '新增' : payload.operation === 'remove' ? '移除' : '更新'}: ${payload.skill_name || `ID:${payload.skill_id}`}${payload.proficiency ? `, 等级 ${payload.proficiency}` : ''}`
    case 'LEAVE_REQUEST':
      return `${payload.leave_type_name || `类型:${payload.leave_type_id}`}, ${payload.start_date} ~ ${payload.end_date}, 共 ${calcDays(payload.start_date, payload.end_date)} 天`
    case 'ATTENDANCE_CORRECTION':
      return `${payload.date}, 时段: ${payload.period === 'morning' ? '上午' : payload.period === 'afternoon' ? '下午' : '全天'}`
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

  // Common fields
  const [reason, setReason] = useState('')

  // Skill change
  const [skillAction, setSkillAction] = useState<'add' | 'update' | 'remove'>('add')
  const [selectedSkillId, setSelectedSkillId] = useState<number | ''>('')
  const [customSkillName, setCustomSkillName] = useState('')
  const [proficiency, setProficiency] = useState('')
  const [mySkills, setMySkills] = useState<any[]>([])

  // Target employee selector (org-tree scoped)
  const [targetEmpId, setTargetEmpId] = useState<number | ''>('')
  const [orgEmployees, setOrgEmployees] = useState<any[]>([])
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  const perms: string[] = profile.permissions || []
  const hasMgmt = perms.some(p => p === 'employee.manage' || p === 'skill.manage')

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

  // Load data on mount
  useEffect(() => {
    if (mode === 'SKILL_CHANGE') {
      setSkillsLoading(true)
      get('/skills').then(r => {
        setSkillsList(r.data || r || [])
      }).catch(() => setError('加载技能数据失败')).finally(() => setSkillsLoading(false))
      // Load org-tree scoped employees for managers
      const empId = profile.employee_id
      if (hasMgmt && empId) {
        get(`/employees?page=1&page_size=100&subtree_of=${empId}`)
          .then(res => setOrgEmployees(res.data?.list || []))
          .catch(() => {})
      }
      // 获取当前员工已有的技能（用于 update 模式）
      try {
        if (empId) {
          get(`/employees/${empId}/skills`)
            .then(res => setMySkills(res.data || res || []))
            .catch(() => setError('加载已有技能失败'))
        }
      } catch {}
    }
    if (mode === 'LEAVE_REQUEST') {
      get('/leave-types')
        .then(res => setLeaveTypesList(res.data || res || []))
        .catch(() => setError('加载请假类型失败'))
    }
  }, [mode])

  // Group skills by category
  const groupedSkills: Record<string, SkillItem[]> = {}
  skillsList.forEach(s => {
    const cat = s.category_name || '未分类'
    if (!groupedSkills[cat]) groupedSkills[cat] = []
    groupedSkills[cat].push(s)
  })

  const getTodayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

  const buildPayload = () => {
    switch (mode) {
      case 'SKILL_CHANGE': {
        const skill = skillsList.find(s => s.skill_id === selectedSkillId)
        const p: any = {
          action: skillAction,
          skill_id: selectedSkillId || undefined,
          skill_name: skill?.skill_name || customSkillName.trim() || '',
          reason,
        }
        if (skillAction !== 'remove') p.proficiency_level = Number(proficiency) || undefined
        if (customSkillName.trim() && !selectedSkillId) p.custom_skill_name = customSkillName.trim()
        return p
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
    }
  }

  const handleSubmit = async () => {
    setError('')

    // Form validation
    if (!reason.trim()) {
      setError('请填写申请说明')
      return
    }
    if (mode === 'SKILL_CHANGE') {
      if (skillAction === 'remove' || skillAction === 'update') {
        if (!selectedSkillId) {
          setError('请从列表中选择现有技能')
          return
        }
      } else if (skillAction === 'add') {
        if (!selectedSkillId && !customSkillName.trim()) {
          setError('请选择或输入技能名称')
          return
        }
        if (customSkillName.trim() && customSkillName.trim().length < 2) {
          setError('技能名称至少 2 个字符')
          return
        }
      }
    }
    if (mode === 'LEAVE_REQUEST') {
      if (!leaveTypeId) {
        setError('请选择请假类型')
        return
      }
      if (!startDate) {
        setError('请选择开始日期')
        return
      }
      if (!endDate) {
        setError('请选择结束日期')
        return
      }
      if (endDate < startDate) {
        setError('结束日期不能早于开始日期')
        return
      }
    }
    if (mode === 'ATTENDANCE_CORRECTION' && !corrDate) {
      setError('请选择补卡日期')
      return
    }
    setSubmitting(true)
    try {
      const body: any = {
        operation_type: mode,
        payload: buildPayload(),
      }
      if (targetEmpId) body.target_id = targetEmpId
      await post('/approval-requests', body)
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
            {/* Employee selector for managers */}
            {hasMgmt && orgEmployees.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">目标员工</label>
                <select
                  value={targetEmpId}
                  onChange={e => setTargetEmpId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
                >
                  <option value="">选择员工（默认为本人）</option>
                  {orgEmployees.map((e: any) => (
                    <option key={e.employee_id} value={e.employee_id}>{e.full_name} - {e.position_name || e.department_name || ''}</option>
                  ))}
                </select>
              </div>
            )}
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
            {/* Add/remove mode: direct skill picker */}
            {skillAction !== 'update' && (<>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">选择技能</label>
                <select
                  value={selectedSkillId}
                  onChange={e => setSelectedSkillId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
                >
                  <option value="">从列表中选择...</option>
                  {skillsList.map((s: any) => (
                    <option key={s.skill_id} value={s.skill_id}>
                      {s.skill_name}{s.category_name ? ` (${s.category_name})` : ''}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={customSkillName}
                  onChange={e => { setCustomSkillName(e.target.value); setSelectedSkillId('') }}
                  placeholder="或直接输入技能名称..."
                  className="mt-2 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
                />
              </div>
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
                {leaveTypesList.map((lt: any) => (
                  <option key={lt.leave_type_id} value={lt.leave_type_id}>
                    {lt.leave_name || lt.type_name || lt.leave_code}
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
/*  Payload Details — structured key-value view                        */
/* ------------------------------------------------------------------ */

function PayloadView({ op, payload: raw }: { op: string; payload: any }) {
  const payload = parsePayload(raw)
  if (!payload) return null

  const rows: { label: string; value: string }[] = []

  switch (op) {
    case 'SKILL_CHANGE': {
      const actionMap: Record<string, string> = { add: '新增', update: '更新', remove: '移除', delete: '移除' }
      rows.push({ label: '操作', value: actionMap[payload.action || payload.operation] || payload.action || payload.operation })
      if (payload.skill_name) rows.push({ label: '技能名称', value: payload.skill_name })
      if (payload.proficiency_level) rows.push({ label: '熟练等级', value: `${payload.proficiency_level} / 5` })
      break
    }
    case 'LEAVE_REQUEST': {
      if (payload.leave_type_name) rows.push({ label: '请假类型', value: payload.leave_type_name })
      rows.push({ label: '起止时间', value: `${payload.start_date} ~ ${payload.end_date}` })
      if (payload.days) rows.push({ label: '天数', value: `${payload.days} 天` })
      break
    }
    case 'ATTENDANCE_CORRECTION': {
      if (payload.date) rows.push({ label: '日期', value: payload.date })
      const periodMap: Record<string, string> = { morning: '上午', afternoon: '下午', full: '全天' }
      rows.push({ label: '时段', value: periodMap[payload.period] || payload.period })
      if (payload.clock_in) rows.push({ label: '上班打卡', value: payload.clock_in })
      if (payload.clock_out) rows.push({ label: '下班打卡', value: payload.clock_out })
      break
    }
    default:
      return <pre className="text-xs text-stone-500 whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>
  }

  if (payload.reason) rows.push({ label: '申请说明', value: payload.reason })

  return (
    <div className="space-y-1">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-stone-400 shrink-0 w-16">{r.label}</span>
          <span className="text-stone-700">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Clock In / Out Modal                                               */
/* ------------------------------------------------------------------ */

function ClockInOutModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const doClock = async (type: 'in' | 'out') => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      let profile: any = {}
      try { profile = JSON.parse(localStorage.getItem('profile') || '{}') } catch {}
      const token = localStorage.getItem('token')
      const res = await fetch('/api/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          employee_id: profile.employee_id,
          clock_type: type === 'in' ? 'normal' : 'normal',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || '打卡失败')
      setResult(data.data || data)
    } catch (e: any) {
      setError(e.message || '打卡失败')
    } finally {
      setLoading(false)
    }
  }

  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-stone-800 mb-1">上下班打卡</h3>
        <p className="text-xs text-stone-400 mb-5">当前时间: {now.toLocaleDateString('zh-CN')} {timeStr}</p>

        {result ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-stone-700">
              {result.action === 'clock_in' ? `签到成功 — ${new Date(result.clock_in).toLocaleTimeString('zh-CN')}` : `签退成功`}
            </p>
            {result.duration_hours && (
              <p className="text-xs text-stone-400 mt-1">本次工作时长: {result.duration_hours} 小时</p>
            )}
            <button onClick={() => { onClose(); window.location.hash = '#/attendance' }}
              className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition font-medium">
              查看考勤记录
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => doClock('in')}
              disabled={loading}
              className="flex-1 py-3 rounded-xl border-2 border-stone-200 hover:border-green-400 hover:bg-green-50 transition disabled:opacity-50 text-sm font-medium text-stone-700"
            >
              上班打卡
            </button>
            <button
              onClick={() => doClock('out')}
              disabled={loading}
              className="flex-1 py-3 rounded-xl border-2 border-stone-200 hover:border-blue-400 hover:bg-blue-50 transition disabled:opacity-50 text-sm font-medium text-stone-700"
            >
              下班打卡
            </button>
          </div>
        )}

        {loading && <p className="text-xs text-stone-400 text-center mt-3">处理中...</p>}
        {error && <p className="text-xs text-red-500 text-center mt-3">{error}</p>}

        <div className="flex justify-center mt-5">
          <button onClick={onClose} className="text-xs text-stone-400 hover:text-stone-600 transition">
            {result ? '关闭' : '取消'}
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
              <div className="bg-stone-50 rounded-lg p-3 text-xs text-stone-600 space-y-1.5">
                <PayloadView op={request.operation_type} payload={payload} />
              </div>
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
          {CARD_CONFIG.filter(card => hasAnyPerm(...card.perm)).map(card => (
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
      {/* Apply form modal (for approval-based operations)                */}
      {/* ================================================================ */}
      {formMode && formMode !== 'CLOCK_IN_OUT' && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setFormMode(null)}>
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <ApplyForm mode={formMode} onClose={() => setFormMode(null)} />
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Clock In/Out modal (direct API, no approval flow)               */}
      {/* ================================================================ */}
      {formMode === 'CLOCK_IN_OUT' && (
        <ClockInOutModal onClose={() => setFormMode(null)} />
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
