import { ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Props {
  permission?: string
  permissions?: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

function hasAnyPerm(userPerms: string[], patterns: string[]): boolean {
  return patterns.some(p =>
    userPerms.some(perm => perm === p || perm.endsWith('.all') || perm === 'admin')
  )
}

export default function RequirePermission({ permission, permissions, children, fallback }: Props) {
  const navigate = useNavigate()
  let profile: any = {}
  try { profile = JSON.parse(localStorage.getItem('profile') || '{}') } catch {}
  const userPerms: string[] = profile.permissions || []

  const patterns = permissions || (permission ? [permission] : [])
  if (patterns.length === 0 || hasAnyPerm(userPerms, patterns)) {
    return <>{children}</>
  }

  if (fallback) return <>{fallback}</>

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <ShieldAlert className="w-12 h-12 text-stone-300" />
      <h3 className="text-base font-semibold text-stone-600">权限不足</h3>
      <p className="text-sm text-stone-400 text-center max-w-sm">
        你没有访问此功能的权限。如需开通请联系管理员。
      </p>
      <button onClick={() => navigate(-1)}
        className="text-sm px-4 py-2 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition">
        返回
      </button>
    </div>
  )
}
