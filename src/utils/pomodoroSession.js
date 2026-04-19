export const POMODORO_TIMER_SESSION_KEY = 'pomodoroTimerSession'

export function loadPomodoroTimerSession() {
  try {
    const raw = localStorage.getItem(POMODORO_TIMER_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function savePomodoroTimerSession(session) {
  localStorage.setItem(POMODORO_TIMER_SESSION_KEY, JSON.stringify(session))
}

export function isPomodoroSessionLocked() {
  const session = loadPomodoroTimerSession()
  if (!session) return false
  return Boolean(session.sessionLocked) || session.status === 'running' || session.status === 'paused'
}
