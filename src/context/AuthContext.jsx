import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  fetchPomodoroAuthSession,
  loginPomodoroUser,
  logoutPomodoroUser,
  registerPomodoroUser,
  savePomodoroSessionToken,
} from '../utils/pomodoroApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchPomodoroAuthSession()
      setUser(data.authenticated ? data.user : null)
      return data.authenticated ? data.user : null
    } catch {
      savePomodoroSessionToken('')
      setUser(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  const register = useCallback(async ({ username, password }) => {
    const data = await registerPomodoroUser({ username, password })
    savePomodoroSessionToken(data.session_token || '')
    setUser(data.user)
    return data.user
  }, [])

  const login = useCallback(async ({ username, password }) => {
    const data = await loginPomodoroUser({ username, password })
    savePomodoroSessionToken(data.session_token || '')
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    await logoutPomodoroUser()
    savePomodoroSessionToken('')
    setUser(null)
  }, [])

  const value = useMemo(() => ({
    user,
    isLoading,
    login,
    logout,
    refreshSession,
    register,
  }), [isLoading, login, logout, refreshSession, register, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}