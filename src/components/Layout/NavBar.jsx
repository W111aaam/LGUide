import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/', label: '首页', end: true },
  { to: '/assignments', label: '作业管理' },
  { to: '/pomodoro', label: '番茄钟' },
  { to: '/schedule', label: '课表' },
  { to: '/settings', label: '设置' },
]

function NavBar() {
  const { logout, user } = useAuth()

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950/92">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex h-14 items-center justify-between gap-6">
          <div className="flex items-center gap-6">
          <span className="font-bold text-indigo-600 text-lg dark:text-orange-300">LGUide</span>
          <nav className="flex gap-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-orange-300'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-slate-900 dark:text-slate-300">
              {user?.username}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default NavBar
