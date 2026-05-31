import { useEffect, useState } from 'react'
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  User,
  Building2,
  FileText,
  AlertCircle,
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

type TabKey = 'pending' | 'my' | 'done'

interface ApprovalRequestSummary {
  id: string
  operation_type: string
  applicant_id: string
  applicant_name?: string
  target_emp_id: string
  target_name?: string
  status: string
  current_node: number
  chain_id: string
  payload?: any
  created_at: string
  updated_at?: string
}

interface ApprovalLogEntry {
  audit_id: number
  action: string
  actor_name?: string
  comment?: string
  created_at: string
  previous_status?: string
  new_status?: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const OPERATION_LABELS: Record<string, string> = {
  SKILL_ADD: 'Add Skill',
  SKILL_REMOVE: 'Remove Skill',
  SKILL_UPDATE: 'Update Skill',
  LEAVE_CREATE: 'Leave Request',
  LEAVE_CANCEL: 'Cancel Leave',
  PERFORMANCE_SCORE: 'Performance Review',
  ATTENDANCE_PUNCH: 'Clock In',
  ATTENDANCE_RETRO: 'Retroactive Punch',
  CONTACT_UPDATE: 'Update Contact',
  POSITION_CHANGE: 'Position Change',
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-stone-200 text-stone-600' },
  pending: { label: 'Pending', color: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  archived: { label: 'Archived', color: 'bg-indigo-100 text-indigo-700' },
}

function formatTime(ts: string | undefined) {
  if (!ts) return ''
  return ts.slice(0, 16).replace('T', ' ')
}

function getOperationLabel(op: string) {
  return OPERATION_LABELS[op] || op
}

function getSummaryText(req: ApprovalRequestSummary): string {
  if (!req.payload) return ''
  const p = req.payload
  if (req.operation_type === 'LEAVE_CREATE') {
    return `${p.leave_type_id || 'Leave'} ${p.start_date || ''} - ${p.end_date || ''}`
  }
  if (req.operation_type === 'SKILL_ADD' || req.operation_type === 'SKILL_UPDATE') {
    return `Skill ${p.skill_id || ''} proficiency ${p.proficiency || ''}`
  }
  if (req.operation_type === 'SKILL_REMOVE') {
    return `Remove skill ${p.skill_id || ''}`
  }
  return JSON.stringify(p).slice(0, 80)
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
          Retry
        </button>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGES[status] || { label: status, color: 'bg-stone-100 text-stone-600' }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
      {status === 'pending' && <Clock className="w-3 h-3" />}
      {status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'rejected' && <XCircle className="w-3 h-3" />}
      {cfg.label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ApprovalCenter() {
  const { setTitle } = useOutletContext() as any
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const activeTab: TabKey = (searchParams.get('tab') as TabKey) || 'pending'

  /* ---- Data state ---- */
  const [requests, setRequests] = useState<ApprovalRequestSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /* ---- Action modals ---- */
  const [actionTarget, setActionTarget] = useState<ApprovalRequestSummary | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  /* ---- Detail drawer ---- */
  const [detailTarget, setDetailTarget] = useState<ApprovalRequestSummary | null>(null)
  const [detailLogs, setDetailLogs] = useState<ApprovalLogEntry[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => { setTitle('Approval Center') }, [])

  /* ---- Fetch list on tab change ---- */
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      setDetailTarget(null)
      setActionTarget(null)
      try {
        const endpoint =
          activeTab === 'pending' ? '/approval-requests/pending' :
          activeTab === 'my' ? '/approval-requests/my' :
          '/approval-requests/done'
        const res = await get(endpoint)
        setRequests(res.data || [])
      } catch (e: any) {
        setError(e.message || 'Failed to load requests')
      } finally {
        setLoading(false)
      }
    })()
  }, [activeTab])

  /* ---- Switch tab ---- */
  const switchTab = (tab: TabKey) => {
    setSearchParams(prev => { prev.set('tab', tab); return prev })
  }

  /* ---- Fetch detail logs ---- */
  const openDetail = async (req: ApprovalRequestSummary) => {
    setDetailTarget(req)
    setDetailLoading(true)
    try {
      const res = await get(`/approval-requests/${req.id}/logs`)
      setDetailLogs(res.data || [])
    } catch {
      setDetailLogs([])
    } finally {
      setDetailLoading(false)
    }
  }

  /* ---- Approve / Reject ---- */
  const submitAction = async () => {
    if (!actionTarget || !actionType) return
    if (actionType === 'reject' && !rejectReason.trim()) return

    setActionSubmitting(true)
    setActionError('')
    try {
      const endpoint = `/approval-requests/${actionTarget.id}/${actionType}`
      const body = actionType === 'reject' ? { comment: rejectReason.trim() } : { comment: '' }
      await put(endpoint, body)
      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== actionTarget.id))
      setActionTarget(null)
      setActionType(null)
      setRejectReason('')
    } catch (e: any) {
      setActionError(e.message || 'Action failed')
    } finally {
      setActionSubmitting(false)
    }
  }

  /* ---- Recall ---- */
  const handleRecall = async (req: ApprovalRequestSummary) => {
    if (!confirm('Recall this request?')) return
    try {
      await put(`/approval-requests/${req.id}/recall`)
      setRequests(prev => prev.filter(r => r.id !== req.id))
    } catch (e: any) {
      alert(e.message || 'Recall failed')
    }
  }

  const tabs = [
    { key: 'pending' as TabKey, label: 'Pending', icon: ClipboardList },
    { key: 'my' as TabKey, label: 'My Requests', icon: Send },
    { key: 'done' as TabKey, label: 'Processed', icon: CheckCircle2 },
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

      {/* List */}
      <div className="space-y-3">
        {loading && <Spinner />}
        {error && <ErrorBanner message={error} onRetry={() => switchTab(activeTab)} />}

        {!loading && !error && requests.length === 0 && (
          <EmptyState
            icon={activeTab === 'pending' ? ClipboardList : activeTab === 'my' ? Send : CheckCircle2}
            message={
              activeTab === 'pending' ? 'No pending approvals' :
              activeTab === 'my' ? 'No requests yet' :
              'No processed requests'
            }
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
                <p className="text-xs text-stone-400 mb-0.5">
                  {req.applicant_name || req.applicant_id} &middot; {req.target_name || req.target_emp_id}
                </p>
                <p className="text-xs text-stone-500 mb-2">{getSummaryText(req)}</p>
                <p className="text-xs text-stone-400">{formatTime(req.created_at)}</p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openDetail(req)}
                  className="text-xs text-stone-500 hover:text-stone-700 underline transition"
                >
                  Detail
                </button>

                {activeTab === 'pending' && (
                  <>
                    <button
                      onClick={() => { setActionTarget(req); setActionType('approve'); setActionError('') }}
                      className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { setActionTarget(req); setActionType('reject'); setRejectReason(''); setActionError('') }}
                      className="text-xs px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition font-medium"
                    >
                      Reject
                    </button>
                  </>
                )}

                {activeTab === 'my' && req.status === 'pending' && (
                  <button
                    onClick={() => handleRecall(req)}
                    className="text-xs px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition"
                  >
                    Recall
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ================================================================ */}
      {/* Approve / Reject confirmation dialog */}
      {/* ================================================================ */}
      {actionTarget && actionType && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => { setActionTarget(null); setActionType(null) }}>
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-stone-800 mb-1">
              {actionType === 'approve' ? 'Approve Request' : 'Reject Request'}
            </h3>
            <p className="text-sm text-stone-500 mb-4">
              {getOperationLabel(actionTarget.operation_type)} &middot; {actionTarget.applicant_name || actionTarget.applicant_id}
            </p>

            {actionType === 'reject' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-stone-600 mb-1">Reason (required)</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Please enter reason for rejection..."
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
                Cancel
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
                {actionSubmitting ? 'Submitting...' : actionType === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Detail slide-out */}
      {/* ================================================================ */}
      {detailTarget && (
        <>
          <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setDetailTarget(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-xl border-l border-stone-200 z-40 flex flex-col">
            <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-stone-700">Request Details</h3>
              <button onClick={() => setDetailTarget(null)} className="p-1 rounded hover:bg-stone-100 transition">
                <XCircle className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-5">
              {/* Summary */}
              <div>
                <h4 className="font-semibold text-stone-800 text-base mb-1">
                  {getOperationLabel(detailTarget.operation_type)}
                </h4>
                <StatusBadge status={detailTarget.status} />
                <p className="text-xs text-stone-400 mt-1">Created: {formatTime(detailTarget.created_at)}</p>
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-400">Applicant</span>
                  <span className="text-stone-700">{detailTarget.applicant_name || detailTarget.applicant_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Target</span>
                  <span className="text-stone-700">{detailTarget.target_name || detailTarget.target_emp_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Current step</span>
                  <span className="text-stone-700">{detailTarget.current_node}</span>
                </div>
              </div>

              {/* Payload */}
              {detailTarget.payload && (
                <div>
                  <h5 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Payload</h5>
                  <pre className="text-xs bg-stone-50 border border-stone-100 rounded-lg p-3 overflow-auto max-h-40 text-stone-600">
                    {JSON.stringify(detailTarget.payload, null, 2)}
                  </pre>
                </div>
              )}

              {/* Audit logs */}
              <div>
                <h5 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Activity Log</h5>
                {detailLoading && <Spinner />}
                {!detailLoading && detailLogs.length === 0 && (
                  <p className="text-xs text-stone-400">No activity logged</p>
                )}
                {!detailLoading && detailLogs.length > 0 && (
                  <div className="space-y-2">
                    {detailLogs.map(log => (
                      <div key={log.audit_id} className="text-xs text-stone-500 border-l-2 border-stone-200 pl-3 py-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-stone-600">{log.actor_name || 'System'}</span>
                          <span className="text-stone-400">{log.action}</span>
                        </div>
                        <p className="text-stone-400">{formatTime(log.created_at)}</p>
                        {log.comment && <p className="text-stone-500 mt-0.5">{log.comment}</p>}
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
