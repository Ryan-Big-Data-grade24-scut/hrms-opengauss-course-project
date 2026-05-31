import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('123456')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await api.login(username, password)
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('profile', JSON.stringify(res.data.profile))
      navigate('/profile')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="w-96 bg-white rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-stone-900 text-center">HRMS</h1>
        <p className="text-sm text-stone-500 text-center mt-1">Sign in to your account</p>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <input id="login-username" name="username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400 transition" placeholder="Username" />
          </div>
          <div>
            <input id="login-password" name="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} type="password"
              className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400 transition" placeholder="Password" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-stone-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-stone-800 transition disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="text-xs text-stone-400 text-center mt-6">admin/123456 &middot; hr_manager/hr123</p>
      </div>
    </div>
  )
}
