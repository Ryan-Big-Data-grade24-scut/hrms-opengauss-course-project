import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { User, Building2, BarChart3, LogOut, BookOpen } from 'lucide-react'

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [title, setTitle] = useState('Profile & Talent')
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')

  const logout = () => { localStorage.clear(); navigate('/login') }
  const nav = [
    { to: '/profile', label: 'Profile & Talent', icon: User },
    { to: '/directory', label: 'Directory', icon: User },
    { to: '/org', label: 'Organization', icon: Building2 },
    { to: '/skills', label: 'Skills', icon: BookOpen },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  ]

  return (
    <div className="flex h-screen bg-stone-100">
      <aside className="w-56 bg-stone-900 text-stone-100 flex flex-col shrink-0">
        <div className="p-5 border-b border-stone-800">
          <h1 className="font-bold text-lg tracking-tight">HRMS</h1>
          <p className="text-xs text-stone-500 mt-1">Intelligence Platform</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(item => (
            <a key={item.to} href={item.to} onClick={(e) => { e.preventDefault(); setTitle(item.label); navigate(item.to) }}
              className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                location.pathname === item.to ? 'bg-stone-700 text-white' : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
              }`}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </a>
          ))}
        </nav>
        <div className="p-4 border-t border-stone-800">
          <p className="text-sm text-stone-300 truncate">{profile.full_name || 'User'}</p>
          <p className="text-xs text-stone-500">{profile.username}</p>
        </div>
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
    </div>
  )
}
