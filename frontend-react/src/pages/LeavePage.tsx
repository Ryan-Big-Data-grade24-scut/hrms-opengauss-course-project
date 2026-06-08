import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CalendarDays, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'

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

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: '年假',
  SICK: '病假',
  PERSONAL: '事假',
  MARRIAGE: '婚假',
  MATERNITY: '产假',
  PATERNITY: '陪产假',
  COMPASSIONATE: '丧假',
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待审批', color: 'bg-blue-100 text-blue-700' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-700' },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-700' },
  cancelled: { label: '已取消', color: 'bg-stone-100 text-stone-600' },
}

export default function LeavePage() {
  const { setTitle } = useOutletContext() as any
  const [leaves, setLeaves] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  // Apply modal
  const [applyOpen, setApplyOpen] = useState(false)
  const [selectedLeave, setSelectedLeave] = useState<any>(null)
  const [leaveReason, setLeaveReason] = useState('')
  const [leaveType, setLeaveType] = useState('ANNUAL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<'idle' | 'success' | 'error'>('idle')
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { return () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current) } }, [])

  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  const employeeId = profile.employee_id

  useEffect(() => { setTitle('请假记录') }, [])

  useEffect(() => {
    if (!employeeId) return
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await get(`/leaves?employee_id=${employeeId}&page_size=50`)
        setLeaves(res.data?.list || res.data?.rows || res.data || [])
      } catch (e: any) {
        setError(e.message || '加载请假记录失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [employeeId])

  function openApply(leave: any) {
    setSelectedLeave(leave)
    setStartDate(leave.start_date?.slice(0, 10) || '')
    setEndDate(leave.end_date?.slice(0, 10) || '')
    setLeaveReason('')
    setSubmitResult('idle')
    setApplyOpen(true)
  }

  function openNewApply() {
    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    setSelectedLeave(null)
    setLeaveType('ANNUAL')
    setStartDate(today)
    setEndDate(today)
    setLeaveReason('')
    setSubmitResult('idle')
    setApplyOpen(true)
  }

  async function handleSubmitApply() {
    if (!leaveReason || !startDate || !endDate) return
    if (endDate < startDate) { setError('结束日期不能早于开始日期'); return }
    setSubmitting(true)
    try {
      const ltId = ({ANNUAL:1,SICK:2,PERSONAL:3,MARRIAGE:4,MATERNITY:5,PATERNITY:6,COMPASSIONATE:7} as any)[leaveType] || 1
      await post('/approval-requests', {
        operation_type: 'LEAVE_REQUEST',
        target_id: selectedLeave?.employee_id || employeeId,
        payload: {
          employee_id: selectedLeave?.employee_id || employeeId,
          leave_type_id: ltId,
          start_date: startDate,
          end_date: endDate,
          reason: leaveReason,
        },
      })
      setSubmitResult('success')
      setFeedback('请假申请已提交')
      feedbackTimer.current = setTimeout(() => { setFeedback(''); setApplyOpen(false) }, 1500)
    } catch (e: any) {
      setSubmitResult('error')
      setFeedback(e.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (!employeeId) {
    return <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">无法获取当前用户信息</div>
  }

  return (
    <div className="max-w-6xl">
      {feedback && (
        <div className={`mb-4 text-sm px-4 py-2 rounded-lg ${submitResult === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {feedback}
        </div>
      )}

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-200">{error}</div>}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-stone-500" />
          <span className="text-sm text-stone-500">请假记录</span>
          <span className="text-xs text-stone-400">({leaves.length} 条)</span>
        </div>
        <button onClick={openNewApply}
          className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition font-medium">
          新建申请
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          </div>
        ) : leaves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <CalendarDays className="w-12 h-12 text-stone-200 mb-3" />
            <p className="text-sm text-stone-400">暂无请假记录</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="text-left px-4 py-3 font-medium text-stone-600">员工</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">类型</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">开始日期</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">结束日期</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">原因</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">状态</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((l: any) => {
                const statusCfg = STATUS_MAP[l.approval_status] || { label: l.approval_status, color: 'bg-stone-100 text-stone-600' }
                const typeLabel = LEAVE_TYPE_LABELS[l.leave_type] || l.leave_type
                return (
                  <tr key={l.leave_id} className="border-b border-stone-50 hover:bg-stone-50 transition">
                    <td className="px-4 py-3 text-stone-700">{l.full_name}</td>
                    <td className="px-4 py-3 text-stone-600">{typeLabel}</td>
                    <td className="px-4 py-3 text-stone-600">{l.start_date?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-stone-600">{l.end_date?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-stone-500 max-w-[200px] truncate">{l.reason || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openApply(l)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition font-medium"
                      >
                        申请
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Apply modal */}
      {applyOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setApplyOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            {submitResult === 'success' ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-stone-700">请假申请已提交</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-stone-800">{selectedLeave ? '重新申请' : '新建请假申请'}</h3>
                  <button onClick={() => setApplyOpen(false)} className="p-1 text-stone-400 hover:text-stone-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {selectedLeave && (
                  <p className="text-xs text-stone-500 mb-4">
                    {selectedLeave.full_name} &middot; {LEAVE_TYPE_LABELS[selectedLeave.leave_type] || selectedLeave.leave_type}
                  </p>
                )}
                <div className="space-y-3">
                  {!selectedLeave && (
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">请假类型</label>
                      <select value={leaveType} onChange={e => setLeaveType(e.target.value)}
                        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 bg-white">
                        {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">开始日期</label>
                    <input type="date" value={selectedLeave ? selectedLeave.start_date?.slice(0, 10) : startDate}
                      disabled={!!selectedLeave}
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 disabled:bg-stone-50 disabled:text-stone-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">结束日期</label>
                    <input type="date" value={selectedLeave ? selectedLeave.end_date?.slice(0, 10) : endDate}
                      disabled={!!selectedLeave}
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 disabled:bg-stone-50 disabled:text-stone-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">申请说明</label>
                    <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} rows={3} placeholder="请简述请假原因..."
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition resize-none" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setApplyOpen(false)}
                    className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition">取消</button>
                  <button onClick={handleSubmitApply} disabled={submitting || !leaveReason}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition disabled:opacity-50">
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    提交申请
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
