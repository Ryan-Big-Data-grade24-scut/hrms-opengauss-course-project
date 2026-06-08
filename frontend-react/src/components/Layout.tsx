import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  BarChart3, LogOut, BookOpen, Users, ClipboardList,
  Clock, TrendingUp, CalendarDays, X, Loader2, Save, User,
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

async function put(path: string, body: any) {
  const token = localStorage.getItem('token')
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

function hasAnyPerm(perms: string[], ...patterns: string[]): boolean {
  return patterns.some(p =>
    perms.some(perm => perm === p || perm === 'admin' || perm.endsWith('.all'))
  )
}

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [title, setTitle] = useState('办事大厅')
  let profile: any = {}
  try { profile = JSON.parse(localStorage.getItem('profile') || '{}') } catch {}

  const logout = () => { localStorage.clear(); navigate('/login') }
  const perms = (profile.permissions || []) as string[]

  // Self-profile modal
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileData, setProfileData] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [editing, setEditing] = useState(false)
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    if (!profileOpen || !profile.employee_id) return
    setProfileLoading(true)
    setProfileError('')
    get(`/org-people/employee/${profile.employee_id}/profile`)
      .then(res => {
        setProfileData(res.data || res)
        const b = (res.data || res).basic || {}
        setEditPhone(b.phone || '')
        setEditEmail(b.email || '')
      })
      .catch((e: any) => setProfileError(e.message || '加载失败'))
      .finally(() => setProfileLoading(false))
  }, [profileOpen, profile.employee_id])

  async function handleSaveContact() {
    setSaving(true); setSaveMsg('')
    try {
      await put('/profile/contact', {
        employee_id: profile.employee_id,
        phone: editPhone,
        email: editEmail,
      })
      setSaveMsg('已保存')
      setEditing(false)
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (e: any) {
      setSaveMsg(e.message || '保存失败')
    } finally { setSaving(false) }
  }

  const allNav = [
    { to: '/service-hall', label: '办事大厅', icon: ClipboardList, check: () => true },
    { to: '/org-people', label: '组织人员', icon: Users, check: () => hasAnyPerm(perms, 'employee.manage', 'directory.view', 'team.view', 'profile.view.all', 'profile.view.team', 'profile.view.self') },
    { to: '/skills', label: '技能管理', icon: BookOpen, check: () => hasAnyPerm(perms, 'skill.manage', 'skill.manage.all', 'skill.manage.team') },
    { to: '/attendance', label: '考勤管理', icon: Clock, check: () => hasAnyPerm(perms, 'attendance.manage', 'attendance.view', 'attendance.view.all', 'attendance.view.team', 'attendance.view.self') },
    { to: '/performance', label: '绩效管理', icon: TrendingUp, check: () => hasAnyPerm(perms, 'performance.manage', 'performance.view', 'performance.view.self') },
    { to: '/analytics', label: '数据分析', icon: BarChart3, check: () => hasAnyPerm(perms, 'analytics.view') },
  ]

  const nav = allNav.filter(n => n.check())
  const canEditContact = hasAnyPerm(perms, 'profile.edit.self', 'profile.edit.team', 'profile.edit.all')

  return (
    <div className="flex h-screen bg-stone-100">
      <aside className="w-56 bg-stone-900 text-stone-100 flex flex-col shrink-0">
        <div className="p-5 border-b border-stone-800">
          <h1 className="font-bold text-lg tracking-tight">HRMS</h1>
          <p className="text-xs text-stone-500 mt-1">Intelligence Platform</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(item => (
            <a key={item.to} href={item.to} onClick={(e) => { e.preventDefault(); setTitle(item.label); navigate(item.to) }}
              className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                location.pathname === item.to ? 'bg-stone-700 text-white' : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
              }`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </a>
          ))}
        </nav>
        <button onClick={() => setProfileOpen(true)}
          className="w-full p-4 border-t border-stone-800 text-left hover:bg-stone-800 transition">
          <p className="text-sm text-stone-300 truncate">{profile.full_name || 'User'}</p>
          <p className="text-xs text-stone-500">{profile.username}</p>
        </button>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-stone-800">{title}</h2>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-stone-400 hover:text-stone-700 transition">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </header>
        <div className="flex-1 overflow-auto p-6">
          <Outlet context={{ setTitle }} />
        </div>
      </div>

      {/* Self-profile modal */}
      {profileOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setProfileOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-lg w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-stone-500" />
                <h3 className="font-semibold text-stone-800">个人信息</h3>
              </div>
              <button onClick={() => setProfileOpen(false)} className="p-1 text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {profileLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
              ) : profileError ? (
                <p className="text-sm text-red-500">{profileError}</p>
              ) : profileData ? (
                <>
                  {/* Basic info - read-only */}
                  <div>
                    <h4 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">基本信息</h4>
                    <div className="bg-stone-50 rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-stone-500">姓名</span><span className="text-stone-800 font-medium">{profileData.basic?.full_name}</span></div>
                      <div className="flex justify-between"><span className="text-stone-500">工号</span><span className="text-stone-800">{profileData.basic?.employee_no}</span></div>
                      <div className="flex justify-between"><span className="text-stone-500">部门</span><span className="text-stone-800">{profileData.basic?.department_name}</span></div>
                      <div className="flex justify-between"><span className="text-stone-500">职位</span><span className="text-stone-800">{profileData.basic?.position_name}</span></div>
                      <div className="flex justify-between"><span className="text-stone-500">上级</span><span className="text-stone-800">{profileData.basic?.manager_name || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-stone-500">入职日期</span><span className="text-stone-800">{profileData.basic?.hire_date?.slice(0, 10)}</span></div>
                      <div className="flex justify-between"><span className="text-stone-500">状态</span><span className="text-stone-800">{profileData.basic?.employment_status}</span></div>
                    </div>
                  </div>

                  {/* Contact info - editable */}
                  <div>
                    <h4 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">联系方式</h4>
                    <div className="bg-stone-50 rounded-lg p-3 space-y-2 text-sm">
                      {editing ? (
                        <>
                          <div>
                            <label className="text-xs text-stone-500 block mb-0.5">手机</label>
                            <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                              className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-stone-400" />
                          </div>
                          <div>
                            <label className="text-xs text-stone-500 block mb-0.5">邮箱</label>
                            <input value={editEmail} onChange={e => setEditEmail(e.target.value)}
                              className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-stone-400" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between"><span className="text-stone-500">手机</span><span className="text-stone-800">{profileData.basic?.phone || '-'}</span></div>
                          <div className="flex justify-between"><span className="text-stone-500">邮箱</span><span className="text-stone-800">{profileData.basic?.email || '-'}</span></div>
                        </>
                      )}
                      {profileData.basic?.emergency_contact_name && (
                        <>
                          <div className="border-t border-stone-200 pt-2 mt-2">
                            <div className="flex justify-between"><span className="text-stone-500">紧急联系人</span><span className="text-stone-800">{profileData.basic.emergency_contact_name}</span></div>
                            <div className="flex justify-between"><span className="text-stone-500">紧急联系电话</span><span className="text-stone-800">{profileData.basic.emergency_contact_phone}</span></div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Skills - read-only */}
                  {profileData.skills && profileData.skills.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">技能 ({profileData.skills.length})</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {(profileData.skills as any[]).map((s: any) => (
                          <span key={s.skill_id} className="inline-flex text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                            {s.skill_name} <span className="text-stone-400 ml-1">{s.proficiency_level}/5</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent logs */}
                  {profileData.recent_logs && profileData.recent_logs.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">近期操作</h4>
                      <div className="space-y-1.5">
                        {(profileData.recent_logs as any[]).slice(0, 3).map((log: any) => (
                          <div key={log.audit_id} className="text-xs text-stone-500 bg-stone-50 rounded px-2.5 py-1.5">
                            <span className="text-stone-700">{log.action_detail || log.action_type}</span>
                            <span className="text-stone-400 ml-2">{log.created_at?.slice(0, 16).replace('T', ' ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {saveMsg && (
                    <div className={`text-xs text-center py-1.5 rounded ${saveMsg === '已保存' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      {saveMsg}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="px-6 py-3 border-t border-stone-100 flex items-center justify-end gap-2">
              {editing ? (
                <>
                  <button onClick={() => { setEditing(false); setEditPhone(profileData?.basic?.phone || ''); setEditEmail(profileData?.basic?.email || '') }}
                    className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition">取消</button>
                  <button onClick={handleSaveContact} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition disabled:opacity-50">
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <Save className="w-3.5 h-3.5" /> 保存
                  </button>
                </>
              ) : (
                canEditContact && (
                  <button onClick={() => setEditing(true)}
                    className="px-3 py-1.5 text-sm font-medium bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition">
                    编辑
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
