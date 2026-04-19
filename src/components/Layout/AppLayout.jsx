import { Outlet } from 'react-router-dom'
import AuthGate from '../Auth/AuthGate'
import { useAuth } from '../../context/AuthContext'
import NavBar from './NavBar'

function AppLayout() {
  const { isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm font-medium text-gray-500 dark:bg-slate-950 dark:text-slate-400">
        正在恢复登录状态...
      </div>
    )
  }

  if (!user) {
    return <AuthGate />
  }

  return (
    <div className="min-h-screen bg-gray-50 transition-colors duration-300 dark:bg-slate-950">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
