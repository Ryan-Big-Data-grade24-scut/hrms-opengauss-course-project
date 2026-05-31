import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BarChart3, Star, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'

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
  draft: { label: '草稿', color: 'bg-stone-100 text-stone-600' },
  submitted: { label: '已提交', color: 'bg-blue-100 text-blue-700' },
  acknowledged: { label: '已确认', color: 'bg-green-100 text-green-700' },
}

export default function PerformancePage() {
  const { setTitle } = useOutletContext() as any
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  // Rating modal
  const [ratingOpen, setRatingOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState<any>(null)
  const [rating, setRating] = useState(3)
  const [score, setScore] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<'idle' | 'success' | 'error'>('idle')

  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  const employeeId = profile.employee_id

  useEffect(() => { setTitle('绩效评分') }, [])

  useEffect(() => {
    if (!employeeId) return
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await get(`/performance/reviews?employee_id=${employeeId}&page_size=50`)
        setReviews(res.data?.rows || res.data || [])
      } catch (e: any) {
        setError(e.message || '加载绩效记录失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [employeeId])

  function openRating(review: any) {
    setSelectedReview(review)
    setRating(review.rating || 3)
    setScore(review.score?.toString() || '')
    setComment('')
    setSubmitResult('idle')
    setRatingOpen(true)
  }

  async function handleSubmitRating() {
    if (!selectedReview) return
    setSubmitting(true)
    try {
      await post('/approval-requests', {
        action_type: 'PERFORMANCE_REVIEW',
        target_id: selectedReview.employee_id,
        payload: {
          review_id: selectedReview.review_id,
          review_period: selectedReview.review_period,
          rating,
          score: score ? Number(score) : null,
          comment,
        },
      })
      setSubmitResult('success')
      setFeedback('绩效评分已提交审批')
      setTimeout(() => { setFeedback(''); setRatingOpen(false) }, 1500)
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

      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-stone-500" />
        <span className="text-sm text-stone-500">季度绩效列表</span>
        <span className="text-xs text-stone-400">({reviews.length} 条)</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="w-12 h-12 text-stone-200 mb-3" />
            <p className="text-sm text-stone-400">暂无绩效记录</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="text-left px-4 py-3 font-medium text-stone-600">评估周期</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">员工</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">评分</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">状态</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">评审人</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">提交时间</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r: any) => {
                const statusCfg = STATUS_MAP[r.status] || { label: r.status, color: 'bg-stone-100 text-stone-600' }
                return (
                  <tr key={r.review_id} className="border-b border-stone-50 hover:bg-stone-50 transition">
                    <td className="px-4 py-3 text-stone-700 font-medium">{r.review_period}</td>
                    <td className="px-4 py-3 text-stone-600">{r.employee_name}</td>
                    <td className="px-4 py-3">
                      {r.score != null ? (
                        <span className="inline-flex items-center gap-1 text-stone-700">
                          <Star className="w-3.5 h-3.5 text-amber-400" />
                          {r.score}
                        </span>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{r.reviewer_name || '-'}</td>
                    <td className="px-4 py-3 text-stone-400 text-xs">{r.submitted_at?.slice(0, 10) || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openRating(r)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition font-medium"
                      >
                        评分
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Rating modal */}
      {ratingOpen && selectedReview && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setRatingOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            {submitResult === 'success' ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-stone-700">绩效评分已提交审批</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-stone-800">绩效评分</h3>
                  <button onClick={() => setRatingOpen(false)} className="p-1 text-stone-400 hover:text-stone-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-stone-500 mb-4">
                  {selectedReview.review_period} &middot; {selectedReview.employee_name}
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">评级</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setRating(n)}
                          className={`w-10 h-10 rounded-lg text-sm font-medium border transition ${
                            rating === n
                              ? 'bg-stone-800 text-white border-stone-800'
                              : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                          }`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">评分 (可选, 1-100)</label>
                    <input type="number" min="1" max="100" value={score} onChange={e => setScore(e.target.value)}
                      placeholder="输入评分"
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">评审意见</label>
                    <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="请输入评审意见..."
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 transition resize-none" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setRatingOpen(false)}
                    className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition">取消</button>
                  <button onClick={handleSubmitRating} disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition disabled:opacity-50">
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    提交评分
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
