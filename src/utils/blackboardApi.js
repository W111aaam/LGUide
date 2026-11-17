import { load } from './storage'

const PRODUCTION_API_BASE = 'https://lguide-pomodoro-api.zhuan0140.workers.dev'
const API_BASE = (import.meta.env.VITE_POMODORO_API_BASE || (import.meta.env.DEV ? '' : PRODUCTION_API_BASE)).replace(/\/$/, '')

async function request(path, options = {}) {
  const sessionToken = load('pomodoroSessionToken', '') || ''
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `Request failed with ${response.status}`)
    error.status = response.status
    throw error
  }
  return data
}

export const fetchBlackboardStatus = () => request('/api/blackboard/status')
export const fetchBlackboardData = () => request('/api/blackboard/data')
export const createBlackboardSyncToken = () => request('/api/blackboard/connect-token', { method: 'POST', body: '{}' })
export const createBlackboardPairingCode = () => request('/api/blackboard/pairing-code', { method: 'POST', body: '{}' })
export const disconnectBlackboard = () => request('/api/blackboard/disconnect', { method: 'DELETE' })
