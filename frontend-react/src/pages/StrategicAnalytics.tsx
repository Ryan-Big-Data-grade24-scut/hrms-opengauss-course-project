import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { AlertTriangle, TrendingUp, Users, Target } from 'lucide-react'

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

function riskLevel(score: number): { label: string; color: string; bg: string } {
  if (score >= 70) return { label: 'Critical', color: 'text-red-600', bg: 'bg-red-100' }
  if (score >= 50) return { label: 'High', color: 'text-amber-600', bg: 'bg-amber-100' }
  if (score >= 30) return { label: 'Medium', color: 'text-yellow-600', bg: 'bg-yellow-100' }
  return { label: 'Low', color: 'text-green-600', bg: 'bg-green-100' }
}

function riskBarColor(score: number): string {
  if (score >= 70) return 'bg-red-500'
  if (score >= 50) return 'bg-amber-500'
  if (score >= 30) return 'bg-yellow-500'
  return 'bg-green-500'
}

export default function StrategicAnalytics() {
  const { setTitle } = useOutletContext() as any

  const [attrition, setAttrition] = useState<any[]>([])
  const [gaps, setGaps] = useState<any[]>([])
  const [heatmap, setHeatmap] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retraining, setRetraining] = useState(false)

  useEffect(() => { setTitle('Strategic Analytics') }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [a, g, h] = await Promise.all([
        get('/attrition/risk').catch(() => ({ data: [] })),
        get('/skills/analytics/overview').catch(() => ({ data: [] })),
        get('/skills/analytics/department-comparison').catch(() => ({ data: [] })),
      ])
      setAttrition(a.data || [])
      setGaps(g.data || [])
      setHeatmap(h.data || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const retrain = async () => {
    setRetraining(true)
    try {
      const token = localStorage.getItem('token')
      await fetch(BASE + '/predict/attrition/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      await load()
    } catch { /* ignore */ }
    finally { setRetraining(false) }
  }

  // Summary counts — use risk_score_pct (0-130%) not raw risk_score (0-1.3)
  const totalAtRisk = attrition.length
  const critical = attrition.filter((a: any) => (a.risk_score_pct || 0) >= 70).length
  const high = attrition.filter((a: any) => (a.risk_score_pct || 0) >= 50 && (a.risk_score_pct || 0) < 70).length
  const medium = attrition.filter((a: any) => (a.risk_score_pct || 0) >= 30 && (a.risk_score_pct || 0) < 50).length
  const low = attrition.filter((a: any) => (a.risk_score_pct || 0) < 30).length

  const summaryCards = [
    { label: 'Total at Risk', value: totalAtRisk, icon: Users, color: 'text-stone-700', bg: 'bg-stone-100' },
    { label: 'Critical (>=70%)', value: critical, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'High (50-70%)', value: high, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Medium (30-50%)', value: medium, icon: Target, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Low (<30%)', value: low, icon: Target, color: 'text-green-600', bg: 'bg-green-50' },
  ]

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
            <p className="text-sm text-stone-400">Loading analytics...</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            {summaryCards.map((card, i) => (
              <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">{card.label}</span>
                  <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Risk table */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-stone-700">Attrition Risk Breakdown</h3>
              <button
                onClick={retrain}
                disabled={retraining}
                className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition font-medium disabled:opacity-50"
              >
                {retraining ? 'Training...' : 'Retrain model'}
              </button>
            </div>
            <div className="overflow-x-auto">
              {attrition.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertTriangle className="w-8 h-8 text-stone-300 mb-2" />
                  <p className="text-sm text-stone-400">No predictions yet. Click retrain to train the ML model.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-stone-400 border-b border-stone-50">
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Department</th>
                      <th className="px-5 py-3 font-medium">Risk %</th>
                      <th className="px-5 py-3 font-medium">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attrition.map((a: any) => {
                      const score = a.risk_score_pct ?? (a.risk_score * 100)
                      const level = riskLevel(score)
                      return (
                        <tr key={a.employee_id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50 transition">
                          <td className="px-5 py-3 text-stone-700 font-medium">{a.full_name}</td>
                          <td className="px-5 py-3 text-stone-500">{a.department_name}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-24 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${riskBarColor(score)}`}
                                  style={{ width: `${Math.min(score, 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-semibold w-8 text-right ${level.color}`}>
                                {score.toFixed(1)}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${level.bg} ${level.color}`}>
                              {level.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Skills overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
              <h3 className="font-semibold text-sm text-stone-700 mb-4">Skills Coverage</h3>
              {gaps.length === 0 ? (
                <p className="text-sm text-stone-400">No skills data</p>
              ) : (
                <div className="space-y-3">
                  {gaps.map((c: any) => (
                    <div key={c.category_name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-stone-600">{c.category_name}</span>
                        <span className="text-stone-400">{c.coverage_pct}% cov &middot; avg {c.avg_proficiency}</span>
                      </div>
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${c.coverage_pct > 40 ? 'bg-green-500' : c.coverage_pct > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${c.coverage_pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
