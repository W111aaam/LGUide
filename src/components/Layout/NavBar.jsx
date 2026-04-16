import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: '首页', end: true },
  { to: '/assignments', label: '作业管理' },
  { to: '/pomodoro', label: '番茄钟' },
  { to: '/schedule', label: '课表' },
  { to: '/settings', label: '设置' },
]

function NavBar() {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center h-14 gap-6">
          <span className="font-bold text-indigo-600 text-lg">LGUide</span>
          <nav className="flex gap-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}

export default NavBar
