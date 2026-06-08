import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Shield, Users, UserCircle, Building2, Briefcase } from 'lucide-react'

const ROLES = [
  {
    key: 'ceo',
    label: 'CEO',
    desc: '全部权限：员工/考勤/绩效/技能/审批/数据分析/审计',
    icon: Shield,
    username: 'ceo',
    password: '123456',
    color: 'from-red-600 to-red-700',
  },
  {
    key: 'vp',
    label: 'VP 副总裁',
    desc: '员工管理、考勤管理、绩效管理、技能管理、数据分析',
    icon: Users,
    username: 'vp_eng',
    password: '123456',
    color: 'from-blue-600 to-blue-700',
  },
  {
    key: 'manager',
    label: '部门经理',
    desc: '团队查看、考勤查看、绩效查看、请假管理、技能管理',
    icon: Briefcase,
    username: 'dept_mgr',
    password: '123456',
    color: 'from-amber-600 to-amber-700',
  },
  {
    key: 'employee',
    label: '普通员工',
    desc: '个人档案查看/编辑、请假申请',
    icon: UserCircle,
    username: 'employee',
    password: '123456',
    color: 'from-emerald-600 to-emerald-700',
  },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleRoleLogin(role: typeof ROLES[number]) {
    setLoading(role.key)
    setError('')
    try {
      const res = await api.login(role.username, role.password)
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('profile', JSON.stringify(res.data.profile))
      navigate('/service-hall')
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-tight">HRMS</h1>
          <p className="text-stone-400 mt-2 text-sm">Intelligence Platform — 选择角色快速登录体验</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ROLES.map(role => {
            const Icon = role.icon
            const isPending = loading === role.key
            return (
              <button
                key={role.key}
                onClick={() => handleRoleLogin(role)}
                disabled={loading !== null}
                className="group relative bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-left hover:bg-white/15 transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:border-white/20"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-1">{role.label}</h3>
                <p className="text-stone-400 text-xs leading-relaxed min-h-[2.5rem]">{role.desc}</p>
                <div className="mt-4 flex items-center gap-2 text-xs">
                  {isPending ? (
                    <span className="text-stone-400 animate-pulse">登录中...</span>
                  ) : (
                    <>
                      <span className="text-stone-500">demo 账号</span>
                      <code className="px-1.5 py-0.5 rounded bg-white/5 text-stone-300 font-mono text-[10px]">{role.username}</code>
                    </>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="mt-6 text-center">
            <p className="text-red-400 text-sm bg-red-900/30 rounded-lg px-4 py-2 inline-block">{error}</p>
          </div>
        )}

        <p className="text-center text-stone-600 text-xs mt-8">
          选择角色即自动登录，无需输入密码 · 密码统一为 <code className="text-stone-500">123456</code>
        </p>
      </div>
    </div>
  )
}
