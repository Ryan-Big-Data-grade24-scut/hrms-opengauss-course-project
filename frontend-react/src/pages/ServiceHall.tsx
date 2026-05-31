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
  created_at: string
}

type FormMode = 'SKILL_CHANGE' | 'LEAVE_APPLY' | 'ATTENDANCE_RETRO' | 'INFO_UPDATE'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const CARD_CONFIG: { mode: FormMode; label: string; desc: string; icon: any }[] = [
  { mode: 'SKILL_CHANGE', label: '技能变更', desc: '新增、修改或移除技能及等级', icon: FileEdit },
  { mode: 'LEAVE_APPLY', label: '请假申请', desc: '提交请假或调休申请', icon: CalendarDays },
  { mode: 'ATTENDANCE_RETRO', label: '考勤补卡', desc: '补打卡或修正出勤记录', icon: Clock },
  { mode: 'INFO_UPDATE', label: '信息修改', desc: '修改联系方式等个人信息', icon: UserCog },
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
  LEAVE_APPLY: '请假申请',
  ATTENDANCE_RETRO: '考勤补卡',
  INFO_UPDATE: '信息修改',
}

function getOperationLabel(op: string) {
  return OPERATION_LABELS[op] || op
}

function formatTime(ts: string | undefined) {
  if (!ts) return ''
  return ts.slice(0, 16).replace('T', ' ')
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

  // Common fields
  const [reason, setReason] = useState('')

  // Skill change
  const [skillName, setSkillName] = useState('')
  const [skillAction, setSkillAction] = useState<'add' | 'update' | 'remove'>('add')
  const [proficiency, setProficiency] = useState('')

  // Leave
  const [leaveType, setLeaveType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Attendance retro
  const [retroDate, setRetroDate] = useState('')
  const [retroTime, setRetroTime] = useState('')

  // Info update
  const [infoField, setInfoField] = useState('')
  const [infoValue, setInfoValue] = useState('')

  const buildPayload = () => {
    switch (mode) {
      case 'SKILL_CHANGE':
        return { action: skillAction, skill_name: skillName, proficiency, reason }
      case 'LEAVE_APPLY':
        return { leave_type_id: leaveType, start_date: startDate, end_date: endDate, reason }
      case 'ATTENDANCE_RETRO':
        return { date: retroDate, time: retroTime, reason }
      case 'INFO_UPDATE':
        return { field: infoField, value: infoValue, reason }
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
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">技能名称</label>
              <input
                value={skillName}
                onChange={e => setSkillName(e.target.value)}
                placeholder="如: Python"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
              />
            </div>
            {skillAction !== 'remove' && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">熟练度</label>
                <input
                  value={proficiency}
                  onChange={e => setProficiency(e.target.value)}
                  placeholder="1-5"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
                />
              </div>
            )}
          </>
        )}

        {/* ========== LEAVE_APPLY ========== */}
        {mode === 'LEAVE_APPLY' && (
          <>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">请假类型</label>
              <select
                value={leaveType}
                onChange={e => setLeaveType(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
              >
                <option value="">请选择</option>
                <option value="ANNUAL">年假</option>
                <option value="SICK">病假</option>
                <option value="PERSONAL">事假</option>
                <option value="MARRIAGE">婚假</option>
                <option value="MATERNITY">产假</option>
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
          </>
        )}

        {/* ========== ATTENDANCE_RETRO ========== */}
        {mode === 'ATTENDANCE_RETRO' && (
          <>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">补卡日期</label>
              <input
                type="date"
                value={retroDate}
                onChange={e => setRetroDate(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">补卡时间</label>
              <input
                type="time"
                value={retroTime}
                onChange={e => setRetroTime(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
              />
            </div>
          </>
        )}

        {/* ========== INFO_UPDATE ========== */}
        {mode === 'INFO_UPDATE' && (
          <>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">修改字段</label>
              <select
                value={infoField}
                onChange={e => setInfoField(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition"
              >
                <option value="">请选择</option>
                <option value="phone">手机号码</option>
                <option value="email">电子邮箱</option>
                <option value="address">家庭地址</option>
                <option value="emergency_contact">紧急联系人</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">新值</label>
              <input
                value={infoValue}
                onChange={e => setInfoValue(e.target.value)}
                placeholder="请输入新值"
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
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-stone-700">
                      {getOperationLabel(req.operation_type)}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-xs text-stone-400 mb-1">
                    {req.applicant_name || req.applicant_id}
                    {req.target_name && req.target_name !== req.applicant_name && (
                      <> &middot; {req.target_name}</>
                    )}
                  </p>
                  <p className="text-xs text-stone-400">{formatTime(req.created_at)}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <ApplyForm mode={formMode} onClose={() => setFormMode(null)} />
          </div>
        </div>
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
