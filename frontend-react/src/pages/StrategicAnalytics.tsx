import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  AlertTriangle,
  TrendingUp,
  Users,
  Target,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
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

const FACTOR_MAP = [
  { key: 'engagement_risk', label: 'Eng', color: 'bg-blue-400' },
  { key: 'attendance_risk', label: 'Att', color: 'bg-cyan-400' },
  { key: 'performance_risk', label: 'Perf', color: 'bg-emerald-400' },
  { key: 'promotion_risk', label: 'Prom', color: 'bg-violet-400' },
  { key: 'overtime_risk', label: 'OT', color: 'bg-amber-400' },
]

function getRiskLabels(a: any): { text: string; color: string }[] {
  const labels: { text: string; color: string }[] = []
  if ((a.engagement_score ?? 0) < 50) labels.push({ text: '敬业度低', color: 'bg-blue-100 text-blue-700' })
  if ((a.attendance_late_count ?? 0) > 5) labels.push({ text: '频繁迟到', color: 'bg-orange-100 text-orange-700' })
  if ((a.last_promotion_months ?? 0) > 24) labels.push({ text: '长期未晋升', color: 'bg-purple-100 text-purple-700' })
  if ((a.overtime_count ?? 0) > 15) labels.push({ text: '过度加班', color: 'bg-yellow-100 text-yellow-700' })
  if ((a.manager_changes ?? 0) > 2) labels.push({ text: '管理变动频繁', color: 'bg-cyan-100 text-cyan-700' })
  return labels
}

/* ------------------------------------------------------------------ */
/*  Pagination component                                               */
/* ------------------------------------------------------------------ */

function Pagination({
  current,
  total,
  pageSize,
  onChange,
}: {
  current: number
  total: number
  pageSize: number
  onChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null

  const pages: (number | string)[] = []
  const range = 2
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= current - range && i <= current + range)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-stone-100">
      <span className="text-xs text-stone-400">
        共 {total} 条，第 {current}/{totalPages} 页
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(current - 1)}
          disabled={current <= 1}
          className="p-1 rounded hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-4 h-4 text-stone-500" />
        </button>
        {pages.map((p, i) =>
          typeof p === 'string' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-stone-300">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`min-w-[28px] h-7 text-xs font-medium rounded transition ${
                p === current
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(current + 1)}
          disabled={current >= totalPages}
          className="p-1 rounded hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="w-4 h-4 text-stone-500" />
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sortable table header                                              */
/* ------------------------------------------------------------------ */

type SortDir = 'asc' | 'desc' | null

function SortHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string
  active: boolean
  direction: SortDir
  onClick: () => void
}) {
  return (
    <th
      className="px-5 py-3 font-medium cursor-pointer select-none hover:text-stone-600 transition"
      onClick={onClick}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {active && direction === 'asc' && <ArrowUp className="w-3 h-3" />}
        {active && direction === 'desc' && <ArrowDown className="w-3 h-3" />}
        {!active && <ArrowUpDown className="w-3 h-3 text-stone-300" />}
      </div>
    </th>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function StrategicAnalytics() {
  const { setTitle } = useOutletContext() as any

  // Tabs
  const TABS = [
    { key: 'attrition', label: '离职风险', icon: AlertTriangle },
    { key: 'skillsGap', label: '技能缺口', icon: Target },
    { key: 'deptMatrix', label: '部门矩阵', icon: Users },
    { key: 'attPerf', label: '出勤绩效', icon: TrendingUp },
    { key: 'health', label: '综合健康', icon: TrendingUp },
  ] as const
  type TabKey = (typeof TABS)[number]['key']
  const [activeTab, setActiveTab] = useState<TabKey>('attrition')

  // Data from main load
  const [attrition, setAttrition] = useState<any[]>([])
  const [gaps, setGaps] = useState<any[]>([])
  const [heatmap, setHeatmap] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retraining, setRetraining] = useState(false)

  // Lazy-loaded data for attendance & performance tab
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null)
  const [perfSummary, setPerfSummary] = useState<any>(null)
  const [attPerfLoading, setAttPerfLoading] = useState(false)
  const [attPerfError, setAttPerfError] = useState('')

  // Lazy-loaded data for health tab
  const [deptHealth, setDeptHealth] = useState<any[]>([])
  const [criticalPersons, setCriticalPersons] = useState<any[]>([])
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState('')
  const [drillDeptId, setDrillDeptId] = useState('')
  const [drillData, setDrillData] = useState<any[]>([])
  const [expandedEmpId, setExpandedEmpId] = useState<number | null>(null)
  const [expandedData, setExpandedData] = useState<{attendance: any; performance: any} | null>(null)

  // ---- Pagination state ----
  const PAGE_SIZE = 20
  const [page, setPage] = useState(1)

  // ---- Department filter ----
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([])
  const [deptFilter, setDeptFilter] = useState<number | ''>('')

  // ---- Sort state for risk table ----
  const [sortKey, setSortKey] = useState<string>('risk_score_pct')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // ---- Skills gap: category filter & sort ----
  const [gapCategoryFilter, setGapCategoryFilter] = useState<string>('')
  const [gapSortKey, setGapSortKey] = useState<'category_name' | 'coverage_pct' | 'avg_proficiency'>('category_name')
  const [gapSortDir, setGapSortDir] = useState<SortDir>('asc')

  useEffect(() => { setTitle('Strategic Analytics') }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [a, g, h, d] = await Promise.allSettled([
        get('/attrition/risk'),
        get('/skills/analytics/overview'),
        get('/skills/analytics/department-comparison'),
        get('/departments'),
      ])
      if (a.status === 'fulfilled') {
        setAttrition(a.value.data || a.value || [])
      }
      if (g.status === 'fulfilled') {
        setGaps(g.value.data || g.value || [])
      }
      if (h.status === 'fulfilled') {
        setHeatmap(h.value.data || h.value || [])
      }
      if (d.status === 'fulfilled') {
        setDepartments(d.value.data || d.value || [])
      }
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

  /* ---- Lazy load attendance & performance data ---- */
  useEffect(() => {
    if (activeTab !== 'attPerf') return
    if (attendanceSummary && perfSummary) return // already loaded
    setAttPerfLoading(true)
    setAttPerfError('')
    Promise.allSettled([
      get('/attendance/summary').then(r => setAttendanceSummary(r.data || r)),
      get('/performance/summary').then(r => setPerfSummary(r.data || r)),
    ]).then(results => {
      const errors = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
      if (errors.length > 0) setAttPerfError('部分出勤/绩效数据加载失败')
    }).finally(() => setAttPerfLoading(false))
  }, [activeTab])

  /* ---- Risk drill-down expand ---- */
  const loadExpandedData = async (empId: number) => {
    setExpandedData(null)
    try {
      const [att, perf] = await Promise.allSettled([
        get(`/attendance/records?employee_id=${empId}&page_size=10`),
        get(`/performance/reviews?employee_id=${empId}&page_size=5`),
      ])
      setExpandedData({
        attendance: att.status === 'fulfilled' ? (att.value.data || att.value) : null,
        performance: perf.status === 'fulfilled' ? ((perf.value.data?.rows || perf.value.data || [])[0] ?? null) : null,
      })
    } catch { setExpandedData({ attendance: null, performance: null }) }
  }

  /* ---- Lazy load health data ---- */
  useEffect(() => {
    if (activeTab !== 'health') return
    if (deptHealth.length > 0 && criticalPersons.length > 0) return
    setHealthLoading(true)
    setHealthError('')
    Promise.allSettled([
      get('/analytics/department-health').then(r => setDeptHealth(r.data || r || [])),
      get('/analytics/critical-persons').then(r => setCriticalPersons(r.data || r || [])),
    ]).then(results => {
      const errors = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
      if (errors.length > 0) setHealthError('部分健康数据加载失败')
    }).finally(() => setHealthLoading(false))
  }, [activeTab])

  /* ---- Derived: filtered + sorted + paginated attrition ---- */

  const filteredAttrition = useMemo(() => {
    let list = [...attrition]
    // Department filter
    if (deptFilter !== '') {
      list = list.filter((a: any) => a.department_id === deptFilter || a.department_name === departments.find((d: any) => (d.department_id || d.id) === deptFilter)?.department_name)
    }
    // Sort
    list.sort((a: any, b: any) => {
      const aVal = a[sortKey] ?? 0
      const bVal = b[sortKey] ?? 0
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return list
  }, [attrition, deptFilter, departments, sortKey, sortDir])

  const totalFiltered = filteredAttrition.length
  const pagedAttrition = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredAttrition.slice(start, start + PAGE_SIZE)
  }, [filteredAttrition, page])

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1) }, [deptFilter])

  /* ---- Derived: filtered + sorted gaps ---- */

  const filteredGaps = useMemo(() => {
    let list = [...gaps]
    if (gapCategoryFilter) {
      list = list.filter((g: any) => g.category_name === gapCategoryFilter)
    }
    list.sort((a: any, b: any) => {
      const aVal = a[gapSortKey] ?? ''
      const bVal = b[gapSortKey] ?? ''
      if (typeof aVal === 'string') {
        return gapSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return gapSortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return list
  }, [gaps, gapCategoryFilter, gapSortKey, gapSortDir])

  const gapCategories = useMemo(() => {
    return [...new Set(gaps.map((g: any) => g.category_name).filter(Boolean))] as string[]
  }, [gaps])

  /* ---- Sort toggle helper ---- */
  const toggleSort = (key: string) => {
    setSortDir(prev => {
      if (sortKey !== key) return 'asc'
      return prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'
    })
    setSortKey(key)
  }

  const toggleGapSort = (key: 'category_name' | 'coverage_pct' | 'avg_proficiency') => {
    setGapSortDir(prev => {
      if (gapSortKey !== key) return 'asc'
      return prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'
    })
    setGapSortKey(key)
  }

  // ---- Summary counts ----
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
          {/* ============================================================ */}
          {/* TabBar — 5 tabs                                                */}
          {/* ============================================================ */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200">
            <div className="flex border-b border-stone-100 overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition border-b-2 whitespace-nowrap ${
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

          {/* ============================================================ */}
          {/* Tab 1: Attrition Risk                                         */}
          {/* ============================================================ */}
          {activeTab === 'attrition' && (
            <>
              {/* Summary cards + Department filter */}
              <div className="flex items-end justify-between gap-4">
                <div className="grid grid-cols-5 gap-4 flex-1">
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
              </div>

              {/* Risk table */}
              <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-sm text-stone-700">Attrition Risk Breakdown</h3>
                    <select
                      value={deptFilter}
                      onChange={e => setDeptFilter(e.target.value ? Number(e.target.value) : '')}
                      className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 outline-none focus:border-stone-400 transition"
                    >
                      <option value="">全部部门</option>
                      {departments.map((d: any) => (
                        <option key={d.department_id || d.id} value={d.department_id || d.id}>{d.department_name || d.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={retrain}
                    disabled={retraining}
                    className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition font-medium disabled:opacity-50"
                  >
                    {retraining ? 'Training...' : 'Retrain model'}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  {filteredAttrition.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <AlertTriangle className="w-8 h-8 text-stone-300 mb-2" />
                      <p className="text-sm text-stone-400">No predictions yet. Click retrain to train the ML model.</p>
                    </div>
                  ) : (
                    <>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-stone-400 border-b border-stone-50">
                            <SortHeader label="Name" active={sortKey === 'full_name'} direction={sortKey === 'full_name' ? sortDir : null} onClick={() => toggleSort('full_name')} />
                            <SortHeader label="Department" active={sortKey === 'department_name'} direction={sortKey === 'department_name' ? sortDir : null} onClick={() => toggleSort('department_name')} />
                            <SortHeader label="Risk %" active={sortKey === 'risk_score_pct'} direction={sortKey === 'risk_score_pct' ? sortDir : null} onClick={() => toggleSort('risk_score_pct')} />
                            <th className="px-5 py-3 font-medium">Level</th>
                            <th className="px-5 py-3 font-medium">Risk Factors</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedAttrition.map((a: any) => {
                            const score = a.risk_score_pct ?? (a.risk_score * 100)
                            const level = riskLevel(score)
                            const isExpanded = expandedEmpId === a.employee_id
                            return (
                              <React.Fragment key={a.employee_id}>
                              <tr className="border-b border-stone-50 last:border-0 hover:bg-stone-50 transition cursor-pointer"
                                onClick={() => {
                                  if (isExpanded) { setExpandedEmpId(null); setExpandedData(null) }
                                  else { setExpandedEmpId(a.employee_id); loadExpandedData(a.employee_id, a.full_name) }
                                }}>
                                <td className="px-5 py-3 text-stone-700 font-medium flex items-center gap-2">
                                  <ChevronRight className={`w-3.5 h-3.5 text-stone-300 transition ${isExpanded ? 'rotate-90' : ''}`} />
                                  {a.full_name}
                                </td>
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
                                <td className="px-5 py-3 min-w-[180px]">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex h-2 bg-stone-100 rounded-full overflow-hidden">
                                      {(() => {
                                        const factors = FACTOR_MAP.map(f => ({ ...f, value: a[f.key] ?? 0 }))
                                        const total = factors.reduce((s, f) => s + f.value, 0)
                                        return total > 0
                                          ? factors.map(f => (
                                              <div
                                                key={f.key}
                                                className={`${f.color} h-full transition-all`}
                                                style={{ width: `${(f.value / total) * 100}%` }}
                                                title={`${f.label}: ${(f.value).toFixed(3)}`}
                                              />
                                            ))
                                          : <div className="bg-stone-200 h-full w-full rounded-full" />
                                      })()}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {getRiskLabels(a).map((l, i) => (
                                        <span key={i} className={`text-[10px] px-1.5 py-[1px] rounded font-medium ${l.color}`}>
                                          {l.text}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && expandedData && (
                                <tr key={`${a.employee_id}-detail`}>
                                  <td colSpan={5} className="px-5 py-4 bg-stone-50 border-b border-stone-100">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-xs font-medium text-stone-500 mb-2">出勤摘要</p>
                                        {expandedData.attendance ? (
                                          <div className="space-y-1 text-xs text-stone-600">
                                            <p>出勤率: {(expandedData.attendance.attendance_rate ?? 0).toFixed(1)}%</p>
                                            <p>迟到次数: {expandedData.attendance.late_count ?? 0}</p>
                                            <p>缺勤次数: {expandedData.attendance.absent_count ?? 0}</p>
                                          </div>
                                        ) : (
                                          <p className="text-xs text-stone-400">加载中...</p>
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-xs font-medium text-stone-500 mb-2">绩效摘要</p>
                                        {expandedData.performance ? (
                                          <div className="space-y-1 text-xs text-stone-600">
                                            <p>平均分: {expandedData.performance.avg_score ?? '-'}</p>
                                            <p>评级: {expandedData.performance.rating ?? '-'}</p>
                                            <p>评估周期: {expandedData.performance.review_period ?? '-'}</p>
                                          </div>
                                        ) : (
                                          <p className="text-xs text-stone-400">加载中...</p>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}
                        </tbody>
                      </table>
                      <Pagination current={page} total={totalFiltered} pageSize={PAGE_SIZE} onChange={setPage} />
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ============================================================ */}
          {/* Tab 2: Skills Gap                                             */}
          {/* ============================================================ */}
          {activeTab === 'skillsGap' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="font-semibold text-sm text-stone-700">Skills Coverage</h3>
                  <div className="flex items-center gap-2">
                    {gapCategories.length > 0 && (
                      <select
                        value={gapCategoryFilter}
                        onChange={e => setGapCategoryFilter(e.target.value)}
                        className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 outline-none focus:border-stone-400 transition"
                      >
                        <option value="">全部分类</option>
                        {gapCategories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                    <div className="flex items-center gap-1 text-xs text-stone-400">
                      <span>排序:</span>
                      <button
                        onClick={() => toggleGapSort('category_name')}
                        className={`px-2 py-1 rounded transition ${
                          gapSortKey === 'category_name' ? 'bg-stone-100 text-stone-700' : 'hover:bg-stone-50'
                        }`}
                      >
                        名称 {gapSortKey === 'category_name' && (gapSortDir === 'asc' ? '↑' : gapSortDir === 'desc' ? '↓' : '')}
                      </button>
                      <button
                        onClick={() => toggleGapSort('coverage_pct')}
                        className={`px-2 py-1 rounded transition ${
                          gapSortKey === 'coverage_pct' ? 'bg-stone-100 text-stone-700' : 'hover:bg-stone-50'
                        }`}
                      >
                        覆盖率 {gapSortKey === 'coverage_pct' && (gapSortDir === 'asc' ? '↑' : gapSortDir === 'desc' ? '↓' : '')}
                      </button>
                    </div>
                  </div>
                </div>
                {filteredGaps.length === 0 ? (
                  <p className="text-sm text-stone-400">No skills data</p>
                ) : (
                  <div className="space-y-3">
                    {filteredGaps.map((c: any) => (
                      <div key={c.category_name}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-stone-600">{c.category_name}</span>
                          <span className="text-stone-400">
                            {c.coverage_pct}% cov &middot; avg {c.avg_proficiency}
                            {c.target_level != null && (
                              <> &middot; target {c.target_level} &middot; gap {c.gap != null ? c.gap.toFixed(1) : '-'}</>
                            )}
                            {c.severity != null && (
                              <span className={`ml-1 ${c.severity === 'high' ? 'text-red-500' : c.severity === 'medium' ? 'text-amber-500' : 'text-green-500'}`}>
                                [{c.severity}]
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${c.coverage_pct > 40 ? 'bg-green-500' : c.coverage_pct > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${c.coverage_pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Department Skill Gaps */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
                <h3 className="font-semibold text-sm text-stone-700 mb-4">部门技能缺口</h3>
                <p className="text-xs text-stone-400 mb-3">选择部门查看具体哪些技能未达到岗位要求。</p>
                <select
                  value={drillDeptId}
                  onChange={e => {
                    const val = e.target.value
                    setDrillDeptId(val)
                    if (val) {
                      get(`/skills/gap/department/${val}`).then(r => setDrillData(r.data || [])).catch(() => setDrillData([]))
                    } else {
                      setDrillData([])
                    }
                  }}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-400 mb-4">
                  <option value="">选择部门...</option>
                  {departments.map((d: any) => (
                    <option key={d.department_id || d.id} value={d.department_id || d.id}>{d.department_name || d.name}</option>
                  ))}
                </select>
                {drillDeptId && drillData.length > 0 ? (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {drillData.sort((a:any,b:any) => Math.abs(b.gap) - Math.abs(a.gap)).map((item: any, i: number) => {
                      const gapAbs = Math.abs(item.gap)
                      const gapWidth = Math.min(gapAbs / 5 * 100, 100)
                      return (
                        <div key={i} className="px-3 py-2 bg-stone-50 rounded-lg">
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="font-medium text-stone-700">{item.skill_name}</span>
                            <span className={`font-semibold ${item.gap < -1 ? 'text-red-500' : item.gap < 0 ? 'text-amber-500' : 'text-green-600'}`}>
                              {item.current_avg?.toFixed(1) || '-'}/{item.target_level || '?'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-current"
                                style={{ width: `${Math.min((item.current_avg || 0) / (item.target_level || 5) * 100, 100)}%`, backgroundColor: item.gap < -1 ? '#ef4444' : item.gap < 0 ? '#f59e0b' : '#22c55e' }} />
                            </div>
                            <span className="text-[10px] text-stone-400 w-8 text-right">{item.staff_with_skill}/{item.dept_size}人</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : drillDeptId ? (
                  <div className="bg-stone-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-stone-400">该部门暂无缺口数据。</p>
                  </div>
                ) : (
                  <div className="bg-stone-50 rounded-lg p-4 text-center">
                    <Target className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="text-xs text-stone-400">选择部门查看技能缺口详情。</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* Tab 3: Department Matrix (heatmap)                            */}
          {/* ============================================================ */}
          {activeTab === 'deptMatrix' && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
              <h3 className="font-semibold text-sm text-stone-700 mb-4">Department Skills Matrix</h3>
              {heatmap.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertTriangle className="w-8 h-8 text-stone-300 mb-2" />
                  <p className="text-sm text-stone-400">No department comparison data available.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {(() => {
                    // Group flat heatmap rows by department
                    const deptMap: Record<string, any[]> = {}
                    heatmap.forEach((h: any) => {
                      const dn = h.department_name
                      if (!deptMap[dn]) deptMap[dn] = []
                      deptMap[dn].push(h)
                    })
                    const groupedDepts = Object.entries(deptMap).map(([name, rows]) => ({
                      department_name: name,
                      categories: rows.map(r => ({
                        category_name: r.category_name,
                        avg_level: r.avg_level,
                        staff_count: r.staff_count,
                        coverage_pct: r.staff_count && rows.length > 0
                          ? Math.round((r.staff_count / Math.max(...rows.map(x => x.staff_count))) * 100)
                          : 0
                      }))
                    }))
                    // All unique category names for column headers
                    const allCategories = [...new Set(heatmap.map((h: any) => h.category_name).filter(Boolean))]

                    return (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-stone-400 border-b border-stone-100">
                            <th className="px-4 py-2 font-medium">Department</th>
                            {allCategories.map(cat => (
                              <th key={cat} className="px-4 py-2 font-medium text-xs">{cat}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {groupedDepts.map((dept: any, idx: number) => (
                            <tr key={idx} className="border-b border-stone-50 last:border-0 hover:bg-stone-50 transition">
                              <td className="px-4 py-2 text-stone-700 font-medium text-xs">{dept.department_name}</td>
                              {allCategories.map((catName, ci) => {
                                const match = dept.categories.find((c: any) => c.category_name === catName)
                                const coverage = match ? match.coverage_pct : 0
                                const intensity = coverage / 100
                                return (
                                  <td key={ci} className="px-4 py-2">
                                    <div className="w-8 h-8 rounded flex items-center justify-center text-[9px] font-medium"
                                      style={{
                                        backgroundColor: intensity > 0.7 ? '#1e3a5f' : intensity > 0.4 ? '#5b8fc9' : intensity > 0.1 ? '#b3cde3' : '#f0f0f0',
                                        color: intensity > 0.4 ? 'white' : '#666'
                                      }}
                                      title={`${dept.department_name}: ${catName} - avg ${match?.avg_level || '-'}/5`}>
                                      {match?.avg_level || '-'}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* Tab 4: Attendance & Performance                               */}
          {/* ============================================================ */}
          {activeTab === 'attPerf' && (
            <div className="space-y-5">
              {attPerfError && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-amber-700">{attPerfError}</p>
                </div>
              )}
              {attPerfLoading ? (
                <div className="bg-white rounded-xl p-10 shadow-sm border border-stone-200 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                    <p className="text-xs text-stone-400">Loading attendance & performance data...</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* C7: Attendance by Department */}
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
                    <h3 className="font-semibold text-sm text-stone-700 mb-3">出勤率（按部门）</h3>
                    {attendanceSummary ? (
                      <div className="space-y-3">
                        {(Array.isArray(attendanceSummary) ? attendanceSummary : [attendanceSummary]).map((dept: any, i: number) => (
                          <div key={i}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-stone-500">{dept.department_name || 'Total'}</span>
                              <span className="font-medium text-stone-700">{(dept.attendance_rate ?? dept.rate ?? 0).toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-green-500" style={{ width: `${dept.attendance_rate ?? dept.rate ?? 0}%` }} />
                            </div>
                            <div className="flex gap-3 text-[10px] text-stone-400 mt-0.5">
                              <span>迟到: {(dept.late_count ?? 0)}</span>
                              <span>缺勤: {(dept.absent_count ?? 0)}</span>
                              <span>人数: {(dept.total_headcount ?? 0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400">暂无出勤数据</p>
                    )}
                  </div>

                  {/* C8: Performance by Department */}
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
                    <h3 className="font-semibold text-sm text-stone-700 mb-3">绩效评分（按部门）</h3>
                    {perfSummary ? (
                      <div className="space-y-3">
                        {(Array.isArray(perfSummary) ? perfSummary : [perfSummary]).map((dept: any, i: number) => (
                          <div key={i}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-stone-500">{dept.department_name || 'Total'}</span>
                              <div className="flex gap-2">
                                <span className="font-medium text-stone-700">{dept.avg_score ? dept.avg_score.toFixed(1) : '-'}</span>
                                <span className="text-stone-400">评分</span>
                              </div>
                            </div>
                            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${(dept.avg_score || 0) / 100 * 100}%` }} />
                            </div>
                            <div className="flex gap-3 text-[10px] text-stone-400 mt-0.5">
                              <span>优秀(4+): {dept.high_performers ?? 0}</span>
                              <span>中等(3): {dept.mid_performers ?? 0}</span>
                              <span>待提升({'<='}2): {dept.low_performers ?? 0}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400">暂无绩效数据</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* Tab 5: Health                                                 */}
          {/* ============================================================ */}
          {activeTab === 'health' && (
            <div className="space-y-5">
              {healthError && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-amber-700">{healthError}</p>
                </div>
              )}
              {healthLoading ? (
                <div className="bg-white rounded-xl p-10 shadow-sm border border-stone-200 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                    <p className="text-xs text-stone-400">Loading health data...</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Department Health */}
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
                    <h3 className="font-semibold text-sm text-stone-700 mb-3">Department Health Scores</h3>
                    {deptHealth.length > 0 ? (
                      <div className="space-y-3">
                        {deptHealth.map((d: any, i: number) => (
                          <div key={i}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-stone-600">{d.department_name || d.name || `Dept ${i}`}</span>
                              <span className={`font-semibold ${(d.composite_health_score ?? d.health_score ?? d.score ?? 0) >= 70 ? 'text-green-600' : (d.composite_health_score ?? d.health_score ?? d.score ?? 0) >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                {(d.composite_health_score ?? d.health_score ?? d.score ?? 0).toFixed(1)}
                              </span>
                            </div>
                            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${(d.composite_health_score ?? d.health_score ?? d.score ?? 0) >= 70 ? 'bg-green-500' : (d.composite_health_score ?? d.health_score ?? d.score ?? 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(d.composite_health_score ?? d.health_score ?? d.score ?? 0, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400">No health data</p>
                    )}
                  </div>

                  {/* Critical Persons */}
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-stone-200">
                    <h3 className="font-semibold text-sm text-stone-700 mb-3">Critical Persons</h3>
                    {criticalPersons.length > 0 ? (
                      <div className="space-y-2">
                        {criticalPersons.map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between py-2 px-3 bg-stone-50 rounded-lg">
                            <div>
                              <p className="text-xs font-medium text-stone-700">{p.full_name || p.name || `Person ${i}`}</p>
                              <p className="text-[10px] text-stone-400">{p.position_name || p.position || ''}</p>
                            </div>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${(p.risk_score ?? 0) > 60 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {Number(p.risk_score ?? 0).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400">No critical persons data</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
