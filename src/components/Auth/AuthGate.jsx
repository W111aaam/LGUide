import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'

function AuthGate({ isOpen, onClose }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isBouncing, setIsBouncing] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setError('')
      setIsSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

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
      onClose()
    } catch (submitError) {
      setError(submitError.message || '认证失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 py-8 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-[2rem] border border-gray-200 bg-white p-6 shadow-[0_30px_120px_rgba(0,0,0,0.18)] sm:p-8"
        onClick={event => event.stopPropagation()}
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-center">
          <div className="flex flex-col items-center justify-center rounded-[1.75rem] border border-gray-200 bg-[radial-gradient(circle_at_top,#fff0df,transparent_58%),linear-gradient(180deg,#fffdf9_0%,#fff5ea_100%)] px-6 py-10 text-center">
            <button
              type="button"
              onClick={() => setIsBouncing(true)}
              onAnimationEnd={() => setIsBouncing(false)}
              className={`auth-tomato relative text-[7rem] leading-none drop-shadow-[0_18px_26px_rgba(154,52,18,0.24)] ${isBouncing ? 'is-bouncing' : ''}`}
              aria-label="点击番茄"
            >
              🍅
            </button>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-black sm:text-4xl">登录后同步番茄记录</h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">点一下番茄，再登录或注册。</p>
          </div>

          <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Account</p>
                <h3 className="mt-2 text-2xl font-black text-black">登录 / 注册</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-black"
              >
                关闭
              </button>
            </div>

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
                {isSubmitting ? '提交中...' : mode === 'login' ? '登录' : '创建账号'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthGate