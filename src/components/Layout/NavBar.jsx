import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { load, save } from '../../utils/storage'

const LOGIN_HINT_KEY = 'authLoginHintDismissed'

function getNavItemClass(isActive = false) {
  return `shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-orange-300'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
  }`
}

function NavBar({ authReady, onOpenAuth }) {
  const { logout, user } = useAuth()
  const { isEnglish } = useLanguage()
  const [showLoginHint, setShowLoginHint] = useState(false)

  const text = isEnglish
    ? {
        brand: 'LGUide',
        navItems: [
          { to: '/', label: 'Home', end: true },
          { to: '/assignments', label: 'Assignments' },
          { to: '/pomodoro', label: 'Pomodoro' },
          { to: '/resources', label: 'Resources' },
          {
            href: 'https://blog.nero-lithos.com/courseai/',
            label: 'Course Helper',
            external: true,
          },
          {
            href: 'https://md.nero-lithos.com/',
            label: 'Editor Assistant',
            external: true,
          },
          { to: '/schedule', label: 'Schedule' },
          { to: '/settings', label: 'Settings' },
        ],
        logout: 'Log out',
        login: 'Log in',
        loading: 'Loading...',
        loginHint: 'Log in to keep your pomodoro history from being lost over time.',
        close: 'Close',
        closeLoginHint: 'Close login hint',
      }
    : {
        brand: 'LGUide',
        navItems: [
          { to: '/', label: '首页', end: true },
          { to: '/assignments', label: '作业管理' },
          { to: '/pomodoro', label: '番茄钟' },
          { to: '/resources', label: '资料' },
          {
            href: 'https://blog.nero-lithos.com/courseai/',
            label: '选课助手',
            external: true,
          },
          {
            href: 'https://md.nero-lithos.com/',
            label: '编辑助手',
            external: true,
          },
          { to: '/schedule', label: '课表' },
          { to: '/settings', label: '设置' },
        ],
        logout: '退出登录',
        login: '登录',
        loading: '加载中...',
        loginHint: '为防止长期用户丢失番茄记录，请登录',
        close: '关闭',
        closeLoginHint: '关闭登录提示',
      }

  useEffect(() => {
    if (!authReady) {
      return
    }

    setShowLoginHint(!user && !load(LOGIN_HINT_KEY, false))
  }, [authReady, user])

  function dismissLoginHint() {
    setShowLoginHint(false)
    save(LOGIN_HINT_KEY, true)
  }

  function handleAuthButtonClick() {
    if (user) {
      logout()
      return
    }

    dismissLoginHint()
    onOpenAuth()
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950/92">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex h-14 items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <span className="font-bold text-indigo-600 text-lg dark:text-orange-300">{text.brand}</span>
            <nav className="flex gap-1">
              {text.navItems.map(item => {
                if (item.external) {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={getNavItemClass()}
                    >
                      {item.label}
                    </a>
                  )
                }

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => getNavItemClass(isActive)}
                  >
                    {item.label}
                  </NavLink>
                )
              })}
            </nav>
          </div>

          <div className="relative flex items-center gap-3">
            {user && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-slate-900 dark:text-slate-300">
                {user.username}
              </span>
            )}
            <button
              type="button"
              onClick={handleAuthButtonClick}
              disabled={!authReady}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              {user ? text.logout : authReady ? text.login : text.loading}
            </button>

            {showLoginHint && (
              <div className="absolute right-0 top-[calc(100%+14px)] z-20 w-72 rounded-2xl border border-black bg-white px-4 py-3 text-sm text-black shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:border-slate-700 dark:bg-white dark:text-black">
                <div className="absolute -top-2 right-6 h-4 w-4 rotate-45 border-l border-t border-black bg-white dark:border-slate-700" />
                <div className="flex items-start justify-between gap-3">
                  <p className="leading-6">{text.loginHint}</p>
                  <button
                    type="button"
                    onClick={dismissLoginHint}
                    className="shrink-0 text-xs font-semibold text-black/60 transition-colors hover:text-black"
                    aria-label={text.closeLoginHint}
                  >
                    {text.close}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default NavBar
