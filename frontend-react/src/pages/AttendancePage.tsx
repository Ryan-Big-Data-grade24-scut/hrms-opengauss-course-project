import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CalendarDays, Clock, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'

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

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  present: { label: '正常', color: 'bg-green-100 text-green-700' },
  late: { label: '迟到', color: 'bg-amber-100 text-amber-700' },
  early_leave: { label: '早退', color: 'bg-orange-100 text-orange-700' },
  absent: { label: '缺勤', color: 'bg-red-100 text-red-700' },
  overtime: { label: '加班', color: 'bg-blue-100 text-blue-700' },
}

export default function AttendancePage() {
  const { setTitle } = useOutletContext() as any
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  // Correction modal
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any>(null)
  const [retroDate, setRetroDate] = useState('')
  const [retroTime, setRetroTime] = useState('')
  const [retroReason, setRetroReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<'idle' | 'success' | 'error'>('idle')

  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  const employeeId = profile.employee_id

  useEffect(() => { setTitle('考勤记录') }, [])

  useEffect(() => {
    if (!employeeId) return
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const dateFrom = `${year}-${month}-01`
        const dateTo = `${year}-${month}-${new Date(year, now.getMonth() + 1, 0).getDate()}`
        const res = await get(`/attendance/records?employee_id=${employeeId}&date_from=${dateFrom}&date_to=${dateTo}&page_size=50`)
        setRecords(res.data?.rows || res.data || [])
      } catch (e: any) {
        setError(e.message || '加载考勤记录失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [employeeId])

  function openCorrection(record: any) {
    setSelectedRecord(record)
    setRetroDate(record.work_date || '')
    setRetroTime('')
    setRetroReason('')
    setSubmitResult('idle')
    setCorrectionOpen(true)
  }

  async function handleSubmitCorrection() {
    if (!selectedRecord || !retroDate || !retroTime) return
    setSubmitting(true)
    try {
      await post('/approval-requests', {
        action_type: 'ATTENDANCE_CORRECTION',
        target_id: selectedRecord.employee_id,
        payload: {
          attendance_id: selectedRecord.attendance_id,
          work_date: retroDate,
          correct_time: retroTime,
          reason: retroReason,
        },
      })
      setSubmitResult('success')
      setFeedback('补卡申请已提交')
      setTimeout(() => { setFeedback(''); setCorrectionOpen(false) }, 1500)
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

      {/* Current month label */}
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-4 h-4 text-stone-500" />
        <span className="text-sm text-stone-500">
          {new Date().getFullYear()}年{new Date().getMonth() + 1}月考勤记录
        </span>
        <span className="text-xs text-stone-400">({records.length} 条)</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Clock className="w-12 h-12 text-stone-200 mb-3" />
            <p className="text-sm text-stone-400">本月暂无考勤记录</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="text-left px-4 py-3 font-medium text-stone-600">日期</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">上班签到</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">下班签退</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">状态</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">时长(h)</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">类型</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: any) => {
                const statusCfg = STATUS_MAP[r.status] || { label: r.status, color: 'bg-stone-100 text-stone-600' }
                return (
                  <tr key={r.attendance_id} className="border-b border-stone-50 hover:bg-stone-50 transition">
                    <td className="px-4 py-3 text-stone-700">{r.work_date?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-stone-600">{r.clock_in?.slice(11, 19) || '-'}</td>
                    <td className="px-4 py-3 text-stone-600">{r.clock_out?.slice(11, 19) || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{r.duration_hours ?? '-'}</td>
                    <td className="px-4 py-3 text-stone-600">{r.clock_type || 'normal'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openCorrection(r)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition font-medium"
                      >
                        补卡
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Correction modal */}
      {correctionOpen && selectedRecord && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setCorrectionOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            {submitResult === 'success' ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-stone-700">补卡申请已提交</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-stone-800">补卡申请</h3>
                  <button onClick={() => setCorrectionOpen(false)} className="p-1 text-stone-400 hover:text-stone-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-stone-500 mb-4">
                  原日期: {selectedRecord.work_date?.slice(0, 10)}
                  {selectedRecord.clock_in && <> | 签到: {selectedRecord.clock_in?.slice(11, 19)}</>}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">补卡日期</label>
                    <input type="date" value={retroDate} onChange={e => setRetroDate(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">补卡时间</label>
                    <input type="time" value={retroTime} onChange={e => setRetroTime(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">申请说明</label>
                    <textarea value={retroReason} onChange={e => setRetroReason(e.target.value)} rows={3} placeholder="请简述补卡原因..."
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition resize-none" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setCorrectionOpen(false)}
                    className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition">取消</button>
                  <button onClick={handleSubmitCorrection} disabled={submitting || !retroDate || !retroTime}
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
