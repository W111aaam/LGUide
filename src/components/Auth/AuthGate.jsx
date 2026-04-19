import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

function AuthGate() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (mode === 'register' && password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'login') {
        await login({ username, password })
      } else {
        await register({ username, password })
      }
    } catch (submitError) {
      setError(submitError.message || '认证失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff2e6,transparent_50%),linear-gradient(180deg,#fffaf4_0%,#fff 46%,#f7f7fb_100%)] px-4 py-12">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-orange-100 bg-white/92 p-6 shadow-[0_30px_120px_rgba(154,52,18,0.12)] backdrop-blur sm:p-10">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-orange-400">LGUide Account</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-gray-900 sm:text-5xl">登录后继续同步你的番茄历史</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-gray-600">
              现在番茄记录会跟账号绑定，而不是跟浏览器本地 UUID 绑定。清空浏览器记录后只需要重新登录，任何设备上都能看到同一份热力图和统计。
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-900">用户名密码保存在 D1</div>
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900">密码仅存哈希与盐值</div>
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">登录会话使用 HttpOnly Cookie</div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="grid grid-cols-2 rounded-full bg-gray-100 p-1 text-sm font-semibold text-gray-500">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError('')
                }}
                className={`rounded-full px-4 py-2 transition-colors ${mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'hover:text-gray-800'}`}
              >
                登录
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register')
                  setError('')
                }}
                className={`rounded-full px-4 py-2 transition-colors ${mode === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'hover:text-gray-800'}`}
              >
                注册
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">用户名</span>
                <input
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-colors focus:border-orange-300 focus:bg-white"
                  placeholder="3-24 位，字母/数字/_/-"
                  autoComplete={mode === 'login' ? 'username' : 'new-username'}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">密码</span>
                <input
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-colors focus:border-orange-300 focus:bg-white"
                  placeholder="至少 8 位"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
              </label>

              {mode === 'register' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">确认密码</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-colors focus:border-orange-300 focus:bg-white"
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                    required
                  />
                </label>
              )}

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSubmitting ? '提交中...' : mode === 'login' ? '登录并继续' : '创建账号并继续'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthGate