import { Outlet } from 'react-router-dom'
import NavBar from './NavBar'

function AppLayout() {
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
