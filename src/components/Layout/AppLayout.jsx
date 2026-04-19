import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import AuthGate from '../Auth/AuthGate'
import { useAuth } from '../../context/AuthContext'
import NavBar from './NavBar'

function AppLayout() {
  const { isLoading } = useAuth()
  const [isAuthOpen, setIsAuthOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 transition-colors duration-300 dark:bg-slate-950">
      <NavBar
        authReady={!isLoading}
        onOpenAuth={() => setIsAuthOpen(true)}
      />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
      <AuthGate
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  )
}

export default AppLayout
